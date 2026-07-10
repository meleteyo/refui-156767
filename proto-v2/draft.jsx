// draft.jsx — 21 기안 작성 (주문 수정/환불/재결제/단가변경) · IDEA-10/11 + IDEA-08 간이 예상
// 금액 입력 즉시 반영 예상(매출/외주비/손익 before→after)·승인선(MG1002) 실시간 갱신,
// 환불 가능 잔액 인라인 검증(BS0009), 상신≠반영 고정 스트립(MG1001), 상신 후 회수(UC21-1)
const { useState, useMemo, useEffect } = React;

const DRAFT_TYPES = [
  { key: "ORDER_EDIT",     label: "주문수정", desc: "주문 금액·조건 변경" },
  { key: "PARTIAL_REFUND", label: "부분환불", desc: "일부 금액 환불 (−)" },
  { key: "FULL_REFUND",    label: "전체환불", desc: "잔액 전액 환불 (−)" },
  { key: "REPAYMENT",      label: "재결제",   desc: "환불 후 재결제 (+)" },
  { key: "RATE_CHANGE",    label: "단가변경", desc: "프리랜서 기준 단가" },
  { key: "SETTLEMENT_ADJUST", label: "정산조정", desc: "확정 정산 조정 이벤트" },
];

// 빈발 사유 칩 (IDEA-10 제로타이핑)
const REASON_CHIPS = {
  ORDER_EDIT:     ["수량 변경에 따른 금액 수정", "계약 조건 변경", "옵션 추가 합의"],
  PARTIAL_REFUND: ["고객 단순변심 — 미진행분 환불", "미진행분 환불 (건수 × 단가)", "계약 조건 변경"],
  FULL_REFUND:    ["고객사 일정 취소 — 전체환불", "계약 해지 합의", "품질 이슈 — 협의 환불"],
  REPAYMENT:      ["환불 후 추가 진행 합의 — 재결제", "사양 변경 후 재계약", "누락분 재청구"],
  RATE_CHANGE:    ["품질 지표 상승 — 단가 인상", "시장 단가 조정", "업무 범위 확대"],
  SETTLEMENT_ADJUST: ["확정 정산 소급 조정", "환불 반영 누락 정정", "외주비 재계산 반영"],
};

const currentSalesOf = (orderId) =>
  SALES_EVENTS.filter((e) => e.orderId === orderId).reduce((s, e) => s + e.amount, 0);

// 승인선 규칙 선택 (MG1002): threshold '이하' 규칙 우선, null = 상한 없음
const pickRule = (docType, amt) => {
  const rules = APPROVAL_LINE_RULES.filter((r) => r.docType === docType)
    .sort((a, b) => (a.threshold == null ? Infinity : a.threshold) - (b.threshold == null ? Infinity : b.threshold));
  return rules.find((r) => r.threshold == null || amt <= r.threshold) || rules[rules.length - 1] || null;
};

const resolveApprover = (role, order) => {
  if (role === "FINANCE") return EMPLOYEES.find((e) => e.role === "FINANCE" && e.active);
  if (role === "EXEC")    return EMPLOYEES.find((e) => e.role === "EXEC" && e.active);
  if (role === "TEAM_LEAD") {
    const dept = order ? DEPARTMENTS.find((d) => d.id === order.deptId) : null;
    const head = dept && EMPLOYEES.find((e) => e.id === dept.headId && e.role === "TEAM_LEAD" && e.active);
    return head || EMPLOYEES.find((e) => e.role === "TEAM_LEAD" && e.active);
  }
  return null;
};

function Draft({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, Money, ConfirmDialog, fmt, toast } = window;
  const payload = route.payload || {};
  const policyMode = tweaks.policyMode || "PRIORITY";

  const [docType, setDocType] = useState(payload.type || "PARTIAL_REFUND");
  const [orderId, setOrderId] = useState(payload.orderId || null);
  const [settlementId, setSettlementId] = useState(payload.settlementId || null);
  const [q, setQ] = useState("");
  const [freelancerId, setFreelancerId] = useState("FR-104");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState("");
  const [payoutPolicy, setPayoutPolicy] = useState("KEEP"); // BS0002 정책 파라미터: KEEP=차감 없음 | PRORATA=비례 차감
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { id, line }

  const isRate = docType === "RATE_CHANGE";
  const isSettle = docType === "SETTLEMENT_ADJUST";
  const isRefund = docType === "PARTIAL_REFUND" || docType === "FULL_REFUND";
  const order = ORDERS.find((o) => o.id === orderId) || null;
  const settlement = SETTLEMENTS.find((s) => s.id === settlementId) || null;
  const freelancer = FREELANCERS.find((f) => f.id === freelancerId) || null;
  const curSales = useMemo(() => (order ? currentSalesOf(order.id) : 0), [order]);
  const refundable = order ? order.amount - order.refundedAmount : 0; // BS0009

  // 전체환불 → 환불 가능 잔액 자동 표시·수정 불가
  useEffect(() => {
    if (docType === "FULL_REFUND" && order) setAmountStr(String(refundable));
  }, [docType, orderId]);

  const amt = docType === "FULL_REFUND" ? refundable : Number(String(amountStr).replace(/[^0-9]/g, "")) || 0;

  // BS0009 인라인 검증
  const amtError = useMemo(() => {
    if (!amountStr && amt === 0) return null; // 미입력은 필수 안내로만
    if (amt <= 0) return "요청 금액은 0보다 커야 합니다";
    if (isRefund && order && amt > refundable) return `환불 가능 잔액 ₩${fmt(refundable)}을 초과할 수 없습니다 (BS0009)`;
    if (docType === "REPAYMENT" && order && amt > order.refundedAmount) return `재결제는 기환불 누계 ₩${fmt(order.refundedAmount)} 이내에서만 가능합니다`;
    return null;
  }, [amountStr, amt, isRefund, order, refundable, docType]);

  // 승인선 미리보기 (MG1002) — 유형×금액 자동 결정 + 승인권자 공석 검증
  const rule = useMemo(() => pickRule(docType, amt), [docType, amt]);
  const lineSteps = useMemo(() => {
    if (!rule) return [];
    return rule.line.map((role, i) => ({ step: i + 1, role, emp: resolveApprover(role, order) }));
  }, [rule, order]);
  const vacancy = lineSteps.some((s) => !s.emp);
  const escalation = APPROVAL_LINE_RULES.find((r) => r.docType === docType && r.threshold != null);

  // 반영 예상 (IDEA-08 간이) — 입력 즉시 재계산
  const preview = useMemo(() => {
    if (isSettle) {
      if (!settlement) return null;
      const snap = settlement.snapshot;
      return { kind: "money", rows: [
        { label: "외주비", before: snap.outsourcingCost, after: snap.outsourcingCost + amt },
        { label: "손익",   before: snap.profit, after: snap.profit - amt },
      ], note: "확정 정산은 덮어쓰지 않고 조정 이벤트로만 반영됩니다 (MG1003 · BS0007)" };
    }
    if (isRate) {
      if (!freelancer) return null;
      const after = amt > 0 ? amt : freelancer.rate;
      return { kind: "rate", rows: [{ label: `기준 단가 (${freelancer.id} ${freelancer.name})`, before: freelancer.rate, after }],
        note: "기존 배정의 rateSnapshot은 유지됩니다 — 배정 시점 단가 고정 (BS0008)" };
    }
    if (!order) return null;
    let salesAfter = curSales, outAfter = order.outsourcingCost;
    if (docType === "PARTIAL_REFUND") {
      salesAfter = curSales - amt;
      outAfter = payoutPolicy === "PRORATA" && curSales > 0 ? Math.round(order.outsourcingCost * Math.max(0, salesAfter) / curSales) : order.outsourcingCost;
    } else if (docType === "FULL_REFUND") {
      salesAfter = curSales - amt;
      const keep = order.taskCount ? order.doneTaskCount / order.taskCount : 0;
      outAfter = Math.floor(order.outsourcingCost * keep);
    } else if (docType === "REPAYMENT") salesAfter = curSales + amt;
    else if (docType === "ORDER_EDIT") salesAfter = curSales + (amt - order.amount);
    return { kind: "money", rows: [
      { label: "매출",   before: curSales, after: salesAfter },
      { label: "외주비", before: order.outsourcingCost, after: outAfter },
      { label: "손익",   before: curSales - order.fee - order.outsourcingCost, after: salesAfter - order.fee - outAfter },
    ]};
  }, [isRate, isSettle, settlement, freelancer, order, curSales, docType, amt, payoutPolicy]);

  const targetOk = isSettle ? !!settlement : isRate ? !!freelancer : !!order;
  const canSubmit = targetOk && amt > 0 && !amtError && reason.trim().length > 0 && !vacancy && !submitted;
  const missing = [];
  if (!targetOk) missing.push(isSettle ? "대상 정산" : isRate ? "대상 프리랜서" : "대상 주문");
  if (!(amt > 0) || amtError) missing.push("요청 금액");
  if (!reason.trim()) missing.push("사유");
  if (vacancy) missing.push("승인권자 공석 해소");

  // 주문 검색 후보 — 진행 중 결재가 있는 주문은 선택 불가 (이중 기안 차단)
  const candidates = ORDERS.filter((o) => {
    if (o.status === "CANCELLED") return false;
    if (!q) return true;
    return o.id.includes(q) || o.clientName.includes(q) || o.item.includes(q);
  }).slice(0, 6);

  const risk = docType === "FULL_REFUND" || (escalation && amt > escalation.threshold) ? "high" : "mid";
  const typeLabel = (DRAFT_TYPES.find((t) => t.key === docType) || {}).label;

  const doSubmit = () => {
    setConfirmOpen(false);
    setSubmitted({ id: "APR-2026-00148", line: lineSteps });
    toast(`APR-2026-00148 상신 완료 — 데이터는 변경되지 않았습니다 (MG1001)`, {
      actionLabel: "결재함에서 진행 확인 →", onAction: () => navigate("inbox"),
    });
  };
  const withdraw = () => {
    setSubmitted(null);
    toast("기안을 회수했습니다 — 데이터 변경 없음 (BS0006 · UC21-1)", { tone: "warn" });
  };

  const arrow = <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500 shrink-0" />;

  return (
    <div className="space-y-5">
      <PageHeader label="APPROVAL · DRAFT (21)" labelColor="purple" title="기안 작성"
        desc="유형 선택 → 대상 지정 → 금액 입력 즉시 반영 예상과 승인선이 실시간 갱신됩니다 (IDEA-08·10·11)"
        actions={<button onClick={() => navigate("inbox")} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5"><Icon name="inbox" className="w-3.5 h-3.5" />결재함으로</button>} />

      {/* 상신≠반영 고정 스트립 (MG1001, IDEA-11) */}
      <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-4 py-2.5 flex items-center gap-2.5 text-sm text-cyan-200 sticky top-0 z-10 backdrop-blur">
        <Icon name="info" className="w-4 h-4 shrink-0" />
        <span>상신해도 데이터는 변경되지 않습니다 — <b>최종 승인 시에만</b> 7연쇄 반영이 실행됩니다</span>
        <span className="ml-auto text-[10px] font-mono text-cyan-400/70 shrink-0">MG1001</span>
      </div>

      <div className={`grid grid-cols-12 gap-4 ${submitted ? "opacity-70 pointer-events-none select-none" : ""}`}>
        {/* ── 좌: 입력 폼 ── */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <Card className="p-5 space-y-3">
            <SectionLabel color="purple">결재 유형 *</SectionLabel>
            <div className="grid grid-cols-6 gap-2">
              {DRAFT_TYPES.map((t) => {
                const on = docType === t.key;
                return (
                  <button key={t.key} onClick={() => { setDocType(t.key); setAmountStr(""); }}
                    className={`p-2.5 rounded-lg border text-center transition ${on ? "bg-purple-500/15 border-purple-500/40" : "bg-slate-950/50 border-slate-700/60 hover:border-slate-600"}`}>
                    <div className={`text-sm font-semibold ${on ? "text-purple-200" : "text-slate-300"}`}>{t.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 대상 선택 */}
          {isSettle ? (
            <Card className="p-5 space-y-3">
              <SectionLabel color="purple">대상 정산 *</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {SETTLEMENTS.map((s) => {
                  const on = settlementId === s.id;
                  return (
                    <button key={s.id} onClick={() => setSettlementId(s.id)}
                      className={`p-3 rounded-lg border text-left transition ${on ? "bg-purple-500/15 border-purple-500/40" : "bg-slate-950/50 border-slate-700/60 hover:border-slate-600"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{s.target} <span className="text-[10px] font-mono text-slate-500">{s.period}</span></span>
                        <EnumPill status={s.status} />
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{s.id} · 손익 ₩{fmt(s.snapshot.profit)}</div>
                    </button>
                  );
                })}
              </div>
              {settlement && (
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">정산 ID</span><span className="font-mono text-xs">{settlement.id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">정산 기간</span><span className="text-xs font-medium">{settlement.period} · {settlement.target}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">외주비</span><Money value={settlement.snapshot.outsourcingCost} /></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">손익</span><Money value={settlement.snapshot.profit} /></div>
                  <div className="col-span-2 text-[10px] text-slate-500 border-t border-slate-800 pt-2">
                    확정 정산은 덮어쓰지 않습니다 — 승인 시 조정 이벤트로만 반영 <span className="font-mono text-slate-600">MG1003</span>
                  </div>
                </div>
              )}
            </Card>
          ) : isRate ? (
            <Card className="p-5 space-y-3">
              <SectionLabel color="purple">대상 프리랜서 *</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {FREELANCERS.filter((f) => f.active).map((f) => {
                  const on = freelancerId === f.id;
                  return (
                    <button key={f.id} onClick={() => setFreelancerId(f.id)}
                      className={`p-3 rounded-lg border text-left transition ${on ? "bg-purple-500/15 border-purple-500/40" : "bg-slate-950/50 border-slate-700/60 hover:border-slate-600"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{f.name} <span className="text-[10px] font-mono text-slate-500">{f.id}</span></span>
                        <span className="text-xs font-mono tabular-nums text-slate-300">₩{fmt(f.rate)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{f.specialty} · 진행 {f.activeTasks}건</div>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel color="purple">대상 주문 *</SectionLabel>
                <span className="text-[10px] text-slate-500">진행 중 결재가 있는 주문은 선택 불가 — 이중 기안 차단</span>
              </div>
              <div className="relative">
                <Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="주문번호 · 고객사 · 주문명 검색"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:border-purple-500/60 outline-none" />
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {candidates.map((o) => {
                  const sel = orderId === o.id;
                  const blocked = !!o.activeApprovalId;
                  return (
                    <button key={o.id} disabled={blocked} onClick={() => setOrderId(o.id)}
                      title={blocked ? `진행 중 결재 ${o.activeApprovalId} — 종결 후 기안할 수 있어요` : ""}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition ${
                        blocked ? "bg-slate-950/30 border-slate-800 opacity-60 cursor-not-allowed"
                        : sel ? "bg-purple-500/15 border-purple-500/40" : "bg-slate-950/50 border-slate-700/60 hover:border-slate-600"}`}>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">{o.id}</span>
                      <span className="text-sm truncate flex-1">{o.clientName} · {o.item}</span>
                      {blocked
                        ? <span className="shrink-0 inline-flex items-center gap-1 rounded-md border bg-amber-500/15 text-amber-300 border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono">결재 진행 중 {o.activeApprovalId}</span>
                        : <EnumPill status={o.status} />}
                      <span className="font-mono tabular-nums text-xs text-slate-300 shrink-0 w-24 text-right">₩{fmt(o.amount)}</span>
                    </button>
                  );
                })}
              </div>

              {order && (
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">주문 번호</span><span className="font-mono text-xs">{order.id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">플랫폼</span><span className="text-xs">{order.platform}</span></div>
                  <div className="col-span-2 flex justify-between"><span className="text-slate-500">주문명</span><span className="text-xs font-medium truncate">{order.clientName} · {order.item}</span></div>
                  <div className="col-span-2 border-t border-slate-800 my-1"></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">원 주문 금액 <span className="text-[10px] font-mono text-slate-600">BS0001</span></span><Money value={order.amount} locked /></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">기환불 누계</span>{order.refundedAmount > 0 ? <Money value={-order.refundedAmount} /> : <span className="text-slate-600">—</span>}</div>
                  <div className="col-span-2 flex justify-between items-center rounded-md bg-emerald-500/5 border border-emerald-500/20 px-3 py-1.5">
                    <span className="text-emerald-300 text-xs font-medium">환불 가능 잔액 <span className="text-[10px] font-mono text-emerald-500/70">BS0009</span></span>
                    <Money value={refundable} size="md" className="text-emerald-200" />
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card className="p-5 space-y-4">
            <div>
              <SectionLabel color="purple">요청 금액 *</SectionLabel>
              <div className="flex items-center gap-2 mt-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₩</span>
                  <input type="text" inputMode="numeric" value={amt ? fmt(amt) : amountStr}
                    disabled={docType === "FULL_REFUND"}
                    onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={isRate ? "새 기준 단가" : isSettle ? "조정 금액" : "요청 금액"}
                    className={`w-full pl-8 pr-3 py-2.5 rounded-lg bg-slate-950/60 border text-lg font-bold font-mono tabular-nums outline-none transition disabled:opacity-60 ${
                      amtError ? "border-rose-500/60 text-rose-300" : "border-slate-700 focus:border-purple-500/60"}`} />
                </div>
                {docType === "PARTIAL_REFUND" && order && (
                  <div className="flex gap-1.5 shrink-0">
                    {[["25%", Math.floor(refundable * 0.25)], ["50%", Math.floor(refundable * 0.5)],
                      ["미진행분", Math.floor(order.amount * (order.taskCount - order.doneTaskCount) / (order.taskCount || 1))]].map(([l, v]) => (
                      <button key={l} onClick={() => setAmountStr(String(v))}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-purple-500/40 text-xs whitespace-nowrap">{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {docType === "FULL_REFUND" && <p className="text-[11px] text-slate-500 mt-1.5">전체환불 — 환불 가능 잔액이 자동 표시되며 수정할 수 없습니다</p>}
              {amtError && (
                <p className="text-xs text-rose-300 mt-1.5 flex items-center gap-1.5"><Icon name="alert" className="w-3.5 h-3.5" />{amtError}</p>
              )}
            </div>

            <div>
              <SectionLabel color="purple">사유 *</SectionLabel>
              <div className="flex items-center gap-1.5 flex-wrap mt-2 mb-2">
                <span className="text-[11px] text-slate-500">빈발 사유</span>
                {(REASON_CHIPS[docType] || []).map((c) => (
                  <button key={c} onClick={() => setReason(c)}
                    className="px-2.5 py-1 rounded-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 hover:border-purple-500/40 hover:text-purple-200 transition">{c}</button>
                ))}
              </div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                placeholder="예: 체험단 20건 중 6건 미진행 — 고객 요청 부분환불"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:border-purple-500/60 outline-none resize-none" />
            </div>

            <div className="flex items-center gap-2">
              <SectionLabel color="slate">첨부파일</SectionLabel>
              <span className="text-xs text-slate-400 flex-1 truncate">{fileName || "선택된 파일 없음 (최대 10MB)"}</span>
              <button onClick={() => { setFileName("고객요청_메일.pdf"); toast("고객요청_메일.pdf 첨부 완료"); }}
                className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700">파일 선택</button>
            </div>
          </Card>
        </div>

        {/* ── 우: 반영 예상 + 승인선 미리보기 ── */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-3 border-dashed border-amber-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SectionLabel color="amber">반영 예상</SectionLabel>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">PREVIEW</span>
              </div>
              <span className="text-[10px] text-slate-500">입력 즉시 갱신</span>
            </div>
            {!preview ? (
              <p className="text-sm text-slate-500 py-4 text-center">{isSettle ? "정산을" : isRate ? "프리랜서를" : "주문을"} 먼저 선택하면 반영 예상이 계산돼요</p>
            ) : (
              <div className="space-y-2.5">
                {preview.rows.map((r) => {
                  const d = r.after - r.before;
                  return (
                    <div key={r.label} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0">
                      <span className="text-sm text-slate-400 w-14 shrink-0">{r.label}</span>
                      <span className="flex items-center gap-2 font-mono tabular-nums text-sm">
                        <span className="text-slate-500 line-through decoration-slate-600">₩{fmt(r.before)}</span>
                        {arrow}
                        <span className="font-bold text-slate-100">₩{fmt(r.after)}</span>
                        <span className={`text-xs w-24 text-right ${d < 0 ? "text-rose-300" : d > 0 ? "text-emerald-300" : "text-slate-600"}`}>
                          {d === 0 ? "±0" : `${d < 0 ? "−" : "+"}₩${fmt(Math.abs(d))}`}
                        </span>
                      </span>
                    </div>
                  );
                })}
                {preview.note && <p className="text-[11px] text-slate-500">{preview.note}</p>}
                {docType === "PARTIAL_REFUND" && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500">외주비 차감 기준 <span className="font-mono text-slate-600">BS0002 · 정책 파라미터</span></span>
                    {[["KEEP", "차감 없음"], ["PRORATA", "비례 차감"]].map(([k, l]) => (
                      <button key={k} onClick={() => setPayoutPolicy(k)}
                        className={`px-2 py-0.5 rounded-full text-[11px] border transition ${payoutPolicy === k ? "bg-amber-500/15 text-amber-200 border-amber-500/40" : "bg-slate-800/60 text-slate-500 border-slate-700"}`}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-slate-500 flex items-start gap-1.5 pt-1 border-t border-slate-800">
              <Icon name="clock" className="w-3 h-3 mt-0.5 shrink-0" />
              조회 시점 계산값 — 승인 시점 값이 우선합니다. 상신 시점에는 데이터가 변경되지 않습니다 (MG1001)
            </p>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <SectionLabel color="purple">승인선 미리보기 <span className="font-mono text-slate-600 normal-case">MG1002</span></SectionLabel>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${policyMode === "PRIORITY" ? "bg-purple-500/15 text-purple-300 border border-purple-500/30" : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"}`}>
                {policyMode === "PRIORITY" ? "순차 결재" : "병렬 합의"}
              </span>
            </div>
            {rule && <div className="text-[11px] text-slate-500">적용 규칙 <span className="font-mono text-purple-300">{rule.id}</span> · {rule.label}</div>}
            <div className="flex items-center gap-1.5 flex-wrap">
              {lineSteps.map((s, i) => (
                <React.Fragment key={s.step}>
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${!s.emp ? "bg-rose-500/10 border-rose-500/40" : i === 0 && policyMode === "PRIORITY" ? "bg-purple-500/10 border-purple-500/30" : "bg-slate-950/50 border-slate-700/60"}`}>
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${i === 0 && policyMode === "PRIORITY" ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                      {policyMode === "PRIORITY" ? s.step : "="}
                    </span>
                    <div className="leading-tight">
                      <div className="text-xs font-medium">{s.emp ? s.emp.name : "공석"}</div>
                      <div className="text-[10px] text-slate-500"><EnumPill status={s.role} className="!px-1 !py-0 !text-[9px] !gap-1" /></div>
                    </div>
                  </div>
                  {i < lineSteps.length - 1 && (policyMode === "PRIORITY" ? arrow : <span className="text-slate-600 text-xs">+</span>)}
                </React.Fragment>
              ))}
            </div>
            {vacancy && (
              <p className="text-xs text-rose-300 flex items-center gap-1.5"><Icon name="alert" className="w-3.5 h-3.5" />승인권자 공석 — 관리자에게 승인선 설정을 요청하세요. 상신이 차단됩니다</p>
            )}
            {escalation && !isRate && (
              <p className="text-[11px] text-slate-500">※ 요청 금액이 <span className="font-mono text-slate-400">₩{fmt(escalation.threshold)}</span>을 넘으면 3단계(대표)가 자동 추가됩니다</p>
            )}
            <p className="text-[10px] text-slate-600">{policyMode === "PRIORITY" ? "앞 단계 승인 후 다음 단계 활성 · 중간 반려 시 즉시 종결" : `상신 즉시 ${lineSteps.length}명 전원 동시 통보 · 전원 승인 시 확정`}</p>
          </Card>

          {/* 상신 전 확인 */}
          <Card className="p-5 space-y-3">
            <SectionLabel color="slate">상신 전 확인</SectionLabel>
            <p className="text-sm text-slate-300">
              {typeLabel} · 요청 <span className={`font-mono tabular-nums font-semibold ${isRefund ? "text-rose-300" : ""}`}>{isRefund ? "−" : ""}₩{fmt(amt)}</span> · 승인선 {lineSteps.length}단계 · <span className="text-cyan-300">데이터 변경 없음</span>
            </p>
            {!canSubmit && !submitted && <p className="text-[11px] text-amber-300/80">입력 필요: {missing.join(" · ")}</p>}
            <button disabled={!canSubmit} onClick={() => setConfirmOpen(true)}
              className="w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20">
              <Icon name="send" className="w-4 h-4" />상신
            </button>
          </Card>
        </div>
      </div>

      {/* 상신 후 — 승인 대기 스테퍼 + 기안 회수 (UC21-1) */}
      {submitted && (
        <Card className="p-5 flex flex-wrap items-center gap-4" style={{ animation: "fadeUp .3s ease-out" }}>
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Icon name="check" className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="font-bold flex items-center gap-2">상신 완료 <span className="font-mono text-purple-300">{submitted.id}</span> <EnumPill status="IN_PROGRESS" /></div>
            <div className="text-xs text-slate-400 mt-0.5">최종 승인 시에만 반영됩니다 (MG1001) · 1차 승인 전까지 회수할 수 있어요</div>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {submitted.line.map((s, i) => (
              <React.Fragment key={s.step}>
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border ${i === 0 ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-slate-950/50 border-slate-700/60 text-slate-500"}`}>
                  {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
                  {s.step}단계 {s.emp ? s.emp.name : "-"} {i === 0 ? "대기" : ""}
                </span>
                {i < submitted.line.length - 1 && <Icon name="chevronRight" className="w-3 h-3 text-slate-600" />}
              </React.Fragment>
            ))}
          </div>
          <div className="ml-auto flex gap-2 shrink-0">
            <button onClick={withdraw} className="px-3.5 py-2 rounded-lg text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20">기안 회수</button>
            <button onClick={() => navigate("inbox")} className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 flex items-center gap-1.5">결재함으로 <Icon name="arrowRight" className="w-3.5 h-3.5" /></button>
          </div>
        </Card>
      )}

      <ConfirmDialog open={confirmOpen} risk={risk} danger={docType === "FULL_REFUND"}
        title="상신 확인" confirmLabel="상신" confirmValue={amt}
        message={`${typeLabel} 기안을 상신합니다. 상신 시점에는 어떤 데이터도 변경되지 않습니다 (MG1001).`}
        summary={preview && (
          <div className="space-y-1">
            {preview.rows.map((r) => (
              <div key={r.label} className="flex justify-between font-mono tabular-nums text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span>₩{fmt(r.before)} → ₩{fmt(r.after)} <span className={r.after - r.before < 0 ? "text-rose-300" : "text-emerald-300"}>({r.after - r.before < 0 ? "−" : "+"}₩{fmt(Math.abs(r.after - r.before))})</span></span>
              </div>
            ))}
            <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">승인선 {lineSteps.length}단계 · {rule ? rule.label : ""}</div>
          </div>
        )}
        onConfirm={doSubmit} onClose={() => setConfirmOpen(false)} />
    </div>
  );
}
window.Draft = Draft;
