// approval-detail.jsx — 22 결재 상세 (승인/반려) · ★IDEA-08
// 승인 전: [반영 예상] 3열(현재/승인 후/차액) PREVIEW 워터마크 + 점선 테두리
// 최종 승인: 7연쇄 체크리스트 420ms 순차 점등 → '반영 영수증'으로 전환·영구 표시
// 고액(전체환불·임계 초과)은 Type-to-Confirm 게이트(§4.6), 동시 처리 감지 배너(§6.1-1)
const { useState, useMemo, useEffect, useRef } = React;

const AD_NOW = typeof AGGREGATED_AT !== "undefined" ? AGGREGATED_AT : "2026-07-10 11:30";
const AD_CHAIN_ICONS = ["shieldCheck", "refresh", "chart", "db", "activity", "history", "bell"];

const adHoursSince = (ts) => ts ? Math.max(0, (new Date(AD_NOW.replace(" ", "T")) - new Date(String(ts).replace(" ", "T"))) / 3600000) : 0;

const adMyTurn = (doc, mode) => {
  if (doc.status !== "IN_PROGRESS") return null;
  if (mode === "BROADCAST") return doc.approvalLine.find((s) => s.status === "PENDING" && s.approverId === CURRENT_USER_ID) || null;
  const first = doc.approvalLine.find((s) => s.status === "PENDING");
  return first && first.approverId === CURRENT_USER_ID ? first : null;
};

// 최종 승인 시 실행될 7연쇄 — expectedDiff에서 실제 결과값을 유도 (mono 표기, §4.8)
const buildChain = (doc, meName) => {
  const f = (k) => doc.expectedDiff.find((d) => d.field === k);
  const st = f("orderStatus"), sales = f("currentSales") || f("amount") || f("rate") || f("adjustment");
  const set = f("settlement"), pay = f("payout") || f("outsourcing");
  const fx = window.fmt;
  const m = (r) => r && r.type === "money" ? `₩${fx(r.before)} → ₩${fx(r.after)}` : null;
  return [
    { label: "결재 확정",   result: `APPROVED · 최종 승인 ${meName}` },
    { label: "주문 상태",   result: st ? `${st.before} → ${st.after}` : "상태 변경 없음" },
    { label: "매출 이벤트", result: sales && sales.type === "money" ? `${sales.delta < 0 ? "−" : "+"}₩${fx(Math.abs(sales.delta || 0))} 이벤트 적재 (BS0001)` : "이벤트 적재 대상 없음" },
    { label: "정산 재계산", result: set ? (m(set) ? `${m(set)} (이력 적재 BS0007)` : set.note) : "재계산 대상 없음" },
    { label: "손익 반영",   result: pay ? (m(pay) ? `지급 ${m(pay)}` : pay.note) : (m(sales) ? `손익 ${m(sales)}` : "손익 반영") },
    { label: "감사 로그",   result: "필드 단위 before/after diff 기록 (MG1004)" },
    { label: "알림 발송",   result: "관련자 알림 · 이메일 병행 — 커밋 후 비동기", async: true },
  ];
};

function ApprovalDetail({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, Money, ConfirmDialog, fmt, toast } = window;
  const policyMode = tweaks.policyMode || "PRIORITY";
  const me = EMPLOYEES.find((e) => e.id === CURRENT_USER_ID);

  const [docId, setDocId] = useState((route.payload && route.payload.approvalId) || APPROVALS[0].id);
  const [doc, setDoc] = useState(() => APPROVALS.find((a) => a.id === docId) || APPROVALS[0]);
  const [comment, setComment] = useState("");
  const [dialog, setDialog] = useState(null); // 'approve' | 'reject'
  const [rejectReason, setRejectReason] = useState("");
  const [chainIdx, setChainIdx] = useState(-1); // -1 대기 / 0~6 점등 / 7 완료
  const [localReceipt, setLocalReceipt] = useState(null);
  const [concurrent, setConcurrent] = useState(null); // { who, step } 동시 처리 감지 (§6.1-1)
  const [reminded, setReminded] = useState(false);
  const bootRef = useRef(false);
  const receiptRef = useRef(null);
  const [receiptFlash, setReceiptFlash] = useState(false); // tab:'receipt' 딥링크 1.2초 하이라이트

  // 딥링크·문서 전환 시 로컬 상태 리셋
  useEffect(() => {
    const src = APPROVALS.find((a) => a.id === docId) || APPROVALS[0];
    setDoc({ ...src, approvalLine: src.approvalLine.map((s) => ({ ...s })) });
    setChainIdx(-1); setLocalReceipt(null); setConcurrent(null); setComment(""); setDialog(null);
  }, [docId]);
  const lastPayloadRef = useRef(route.payload && route.payload.approvalId);
  useEffect(() => {
    const pid = route.payload && route.payload.approvalId;
    if (pid && pid !== lastPayloadRef.current) { lastPayloadRef.current = pid; setDocId(pid); }
  }, [route]);

  const order = ORDERS.find((o) => o.id === doc.orderId) || null;
  const freelancer = FREELANCERS.find((x) => x.id === doc.freelancerId) || null;
  const curSales = useMemo(() => order ? SALES_EVENTS.filter((e) => e.orderId === order.id).reduce((s, e) => s + e.amount, 0) : 0, [order]);
  const myStep = adMyTurn(doc, policyMode);
  const pendingStep = doc.approvalLine.find((s) => s.status === "PENDING");
  const waitH = adHoursSince(doc.status === "IN_PROGRESS" ? ((doc.approvalLine[(doc.approvalLine.findIndex((s) => s.status === "PENDING")) - 1] || {}).decidedAt || doc.createdAt) : null);
  const isDelayed = doc.status === "IN_PROGRESS" && waitH >= 48;
  const chain = useMemo(() => buildChain(doc, me ? me.name : "정다은"), [doc]);
  const receipt = doc.chainReceipt || localReceipt;
  const chainRunning = chainIdx >= 0 && chainIdx < chain.length && !receipt;

  // ── 승인/반려 ────────────────────────────────────────────────────────────────
  const approve = () => {
    setDialog(null);
    const line = doc.approvalLine.map((s) =>
      s.status === "PENDING" && s.approverId === CURRENT_USER_ID
        ? { ...s, status: "APPROVED", comment: comment.trim() || "승인", decidedAt: AD_NOW } : s);
    const stillPending = line.some((s) => s.status === "PENDING");
    if (stillPending) {
      const next = line.find((s) => s.status === "PENDING");
      setDoc({ ...doc, approvalLine: line });
      toast(`${doc.id} 승인 완료 — 다음 차례 ${next.approver} (${(window.ENUM_META[next.role] || {}).label})`, {
        actionLabel: "결재함으로 →", onAction: () => navigate("inbox") });
    } else {
      setDoc({ ...doc, approvalLine: line, status: "APPROVED", decidedAt: AD_NOW });
      setChainIdx(0); // ★ 7연쇄 순차 점등 시작
    }
  };
  const reject = () => {
    if (!rejectReason.trim()) { toast("반려 사유를 입력해 주세요 — 사유 필수 (BS0006)", { tone: "error" }); return; }
    const line = doc.approvalLine.map((s) =>
      s.status === "PENDING" && s.approverId === CURRENT_USER_ID
        ? { ...s, status: "REJECTED", comment: rejectReason.trim(), decidedAt: AD_NOW } : s);
    setDoc({ ...doc, approvalLine: line, status: "REJECTED", decidedAt: AD_NOW,
      resultNote: "반려 확정 — 주문·매출·정산 데이터 변경 없음 (무변경 원칙 BS0006)" });
    setDialog(null); setRejectReason("");
    toast(`${doc.id} 반려 완료 — 데이터는 변경되지 않았습니다 (BS0006)`, { tone: "warn", actionLabel: "결재함으로 →", onAction: () => navigate("inbox") });
  };

  // 결재함에서 최종 승인 후 진입(justApproved) → 자동으로 7연쇄 점등
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    if (route.payload && route.payload.justApproved && doc.status === "IN_PROGRESS" && myStep) {
      const line = doc.approvalLine.map((s) => s.status === "PENDING" && s.approverId === CURRENT_USER_ID ? { ...s, status: "APPROVED", comment: "확인 완료", decidedAt: AD_NOW } : s);
      if (!line.some((s) => s.status === "PENDING")) { setDoc({ ...doc, approvalLine: line, status: "APPROVED", decidedAt: AD_NOW }); setChainIdx(0); }
    }
  }, []);

  // route.payload.tab === 'receipt' — 반영 영수증으로 자동 스크롤 + 1.2초 하이라이트
  // (home 반영 피드 · notifications '반영 영수증 보기' 딥링크. 영수증 없으면 무시 = 정상 진입)
  useEffect(() => {
    if (route.payload?.tab !== "receipt" || !receipt || !receiptRef.current) return;
    receiptRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    setReceiptFlash(true);
    const t = setTimeout(() => setReceiptFlash(false), 1200);
    return () => clearTimeout(t);
  }, [route, receipt]);

  // 420ms 간격 순차 점등 → 완료 시 반영 영수증으로 영구 전환 (★IDEA-08)
  useEffect(() => {
    if (chainIdx < 0 || receipt) return;
    if (chainIdx >= chain.length) {
      setLocalReceipt(chain.map((c, i) => ({ step: i + 1, label: c.label, result: c.result, at: AD_NOW + `:0${Math.min(i, 3)}`, async: !!c.async })));
      const remain = APPROVALS.filter((a) => a.id !== doc.id && adMyTurn(a, policyMode)).length;
      toast(`7연쇄 반영 완료 — 예상치와 일치 ✓ · 대기 결재 ${remain}건`, {
        actionLabel: remain > 0 ? "다음 건 →" : "결재함으로 →", onAction: () => navigate("inbox") });
      return;
    }
    const t = setTimeout(() => setChainIdx((i) => i + 1), 420);
    return () => clearTimeout(t);
  }, [chainIdx, receipt]);

  // 동시 처리 감지 시뮬레이션 (§6.1-1) — 내 차례가 아닌 진행 문서에서 40초 후 타인 선처리
  useEffect(() => {
    if (doc.status !== "IN_PROGRESS" || myStep || !pendingStep) return;
    const t = setTimeout(() => setConcurrent({ who: pendingStep.approver, step: pendingStep.step }), 40000);
    return () => clearTimeout(t);
  }, [docId, doc.status]);
  const applyConcurrent = () => {
    const line = doc.approvalLine.map((s) => s.step === concurrent.step ? { ...s, status: "APPROVED", comment: "승인", decidedAt: AD_NOW } : s);
    setDoc({ ...doc, approvalLine: line });
    setConcurrent(null);
    toast("최신 상태를 반영했어요 — 이제 내 차례입니다");
  };

  const risk = doc.risk || "mid";
  const moneyRows = doc.expectedDiff.filter((r) => r.type === "money");
  const salesFormula = order ? SALES_EVENTS.filter((e) => e.orderId === order.id)
    .map((e) => ({ label: (window.ENUM_META[e.type] || {}).label || e.type, value: e.amount, ref: e.approvalId || undefined })).reverse() : null;

  const infoRow = (k, v) => (
    <div className="flex justify-between items-center gap-3 py-1"><span className="text-slate-500 text-xs shrink-0">{k}</span><span className="text-sm text-right min-w-0">{v}</span></div>
  );

  return (
    <div className="space-y-4">
      <PageHeader label="APPROVAL · DETAIL (22)" labelColor="purple" title="결재 상세"
        desc="승인 전 반영 예상(PREVIEW) → 최종 승인 시 7연쇄 반영 영수증으로 전환됩니다 (★IDEA-08)"
        actions={
          <div className="flex items-center gap-2">
            <select value={docId} onChange={(e) => setDocId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700 text-xs font-mono focus:border-purple-500/60 outline-none">
              {APPROVALS.map((a) => <option key={a.id} value={a.id}>{a.id} · {(window.ENUM_META[a.type] || {}).label}</option>)}
            </select>
            <button onClick={() => navigate("inbox")} className="px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 flex items-center gap-1.5">
              <Icon name="inbox" className="w-3.5 h-3.5" />결재함으로</button>
          </div>} />

      {/* 동시 처리 감지 배너 (§6.1-1 · 409 낙관적 잠금) */}
      {concurrent && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/40 px-4 py-2.5 flex items-center gap-2.5 text-sm text-amber-200" style={{ animation: "fadeUp .25s ease-out" }}>
          <Icon name="alert" className="w-4 h-4 shrink-0" />
          <span>이 문서는 방금 <b>{concurrent.who}</b>님이 {concurrent.step}단계를 승인했습니다 — 화면이 최신이 아닐 수 있어요</span>
          <button onClick={applyConcurrent} className="ml-auto shrink-0 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30">최신 상태 보기</button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* ── 좌: 문서 정보 + 승인선 + 액션 ── */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-x-6">
              {infoRow("결재 번호", <span className="font-mono text-purple-300">{doc.id}</span>)}
              {infoRow("결재 유형", <EnumPill status={doc.type} />)}
              {infoRow("기안자", <span>{doc.requester}</span>)}
              {infoRow("기안일", <span className="font-mono text-xs text-slate-300">{doc.createdAt}</span>)}
              {infoRow("상태", <EnumPill status={doc.status} />)}
              {infoRow("대기 경과", doc.status === "IN_PROGRESS" ? (
                isDelayed
                  ? <span className="inline-flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-mono font-bold bg-rose-500 text-white">D+{Math.floor(waitH / 24)} 지연</span>
                      <button disabled={reminded} onClick={() => { setReminded(true); toast("현재 차례 승인자에게 알림을 다시 보냈어요 (하루 1회 · 모델 705)"); }}
                        className="text-[11px] text-amber-300 disabled:opacity-40">알림 다시 보내기</button>
                    </span>
                  : <span className="font-mono text-xs text-slate-400">{waitH < 1 ? `${Math.round(waitH * 60)}분` : `${Math.round(waitH)}시간`}</span>
              ) : <span className="font-mono text-xs text-slate-500">{doc.decidedAt} 처리</span>)}
            </div>
          </Card>

          <Card className="p-5 space-y-1">
            <SectionLabel color="slate">{order ? "대상 주문" : freelancer ? "대상 프리랜서" : "대상 정산"}</SectionLabel>
            {order ? (<>
              {infoRow("주문 번호", <button onClick={() => navigate("orders", { orderId: order.id })} className="font-mono text-xs text-cyan-300 hover:text-cyan-200 underline decoration-dotted underline-offset-2">{order.id} ↗</button>)}
              {infoRow("플랫폼", <span className="text-xs">{order.platform}</span>)}
              {infoRow("주문명", <span className="text-xs font-medium truncate">{order.clientName} · {order.item}</span>)}
              <div className="border-t border-slate-800 my-1.5"></div>
              {infoRow(<span>원 주문 금액 <span className="font-mono text-[10px] text-slate-600">BS0001</span></span>, <Money value={order.amount} locked />)}
              {infoRow("기환불 누계", order.refundedAmount > 0 ? <Money value={-order.refundedAmount} /> : <span className="text-slate-600 text-sm">—</span>)}
              {infoRow("현재 매출", <Money value={curSales} formula={salesFormula} />)}
            </>) : freelancer ? (<>
              {infoRow("프리랜서", <span className="text-xs font-medium">{freelancer.name} <span className="font-mono text-slate-500">{freelancer.id}</span></span>)}
              {infoRow("분야", <span className="text-xs">{freelancer.specialty}</span>)}
              {infoRow("현재 기준 단가", <Money value={freelancer.rate} />)}
            </>) : (<>
              {infoRow("정산", <span className="font-mono text-xs">{doc.settlementId || "—"}</span>)}
            </>)}
            <div className="border-t border-slate-800 my-1.5"></div>
            {infoRow(<span className="text-slate-400">* 요청 금액</span>, <Money value={doc.amount} size="md" negative={doc.type.includes("REFUND")} className="font-bold" />)}
            <div className="pt-1">
              <div className="text-[11px] text-slate-500 mb-1">사유</div>
              <p className="text-sm text-slate-300 leading-relaxed rounded-lg bg-slate-950/60 border border-slate-800 p-3">{doc.opinion}</p>
            </div>
          </Card>

          {/* 승인선 스테퍼 — 현재 차례 아바타 펄스 (IDEA-11), policyMode 반영 */}
          <Card className="p-5 space-y-0">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel color="purple">승인선</SectionLabel>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${policyMode === "PRIORITY" ? "bg-purple-500/15 text-purple-300 border border-purple-500/30" : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"}`}>
                {policyMode === "PRIORITY" ? "순차 결재" : "병렬 합의"}</span>
            </div>
            {doc.approvalLine.map((s, i) => {
              const isTurn = doc.status === "IN_PROGRESS" && s.status === "PENDING" &&
                (policyMode === "BROADCAST" || doc.approvalLine.find((x) => x.status === "PENDING") === s);
              return (
                <div key={s.step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      s.status === "APPROVED" ? "bg-emerald-500/25 text-emerald-200"
                      : s.status === "REJECTED" ? "bg-rose-500/25 text-rose-200"
                      : isTurn ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white" : "bg-slate-800 text-slate-500"}`}>
                      {s.status === "APPROVED" ? <Icon name="check" className="w-4 h-4" /> : s.status === "REJECTED" ? <Icon name="x" className="w-4 h-4" /> : s.step}
                      {isTurn && <span className="absolute inset-0 rounded-full ring-2 ring-purple-500/50 animate-ping"></span>}
                    </div>
                    {i < doc.approvalLine.length - 1 && <div className="w-px flex-1 min-h-[16px] bg-slate-800"></div>}
                  </div>
                  <div className={`flex-1 pb-3 ${s.status === "PENDING" && !isTurn ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{s.approver}</span>
                      <span className="text-[11px] text-slate-500">{(window.ENUM_META[s.role] || {}).label}</span>
                      <EnumPill status={s.status} />
                      {isTurn && <span className="text-[10px] text-amber-300">{s.approverId === CURRENT_USER_ID ? "내 차례" : "현재 차례"}{policyMode === "BROADCAST" ? " · 동시 통보" : ""}</span>}
                    </div>
                    {s.decidedAt && <div className="text-[11px] text-slate-500 font-mono mt-0.5">{s.decidedAt}</div>}
                    {s.comment && <div className="text-xs text-slate-400 mt-0.5">의견: {s.comment}</div>}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* 액션 존 — 내 차례 + 진행 중일 때만 */}
          {doc.status === "IN_PROGRESS" && myStep && !chainRunning && !receipt && (
            <Card className="p-5 space-y-3">
              <SectionLabel color="slate">결재 의견</SectionLabel>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                placeholder="승인 의견 (선택) — 반려 시에는 사유가 필수입니다 (BS0006)"
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:border-purple-500/60 outline-none resize-none" />
              {risk === "high" && (
                <p className="text-[11px] text-rose-300/90 flex items-center gap-1.5">
                  <Icon name="shield" className="w-3.5 h-3.5" />고위험 승인 — 승인 확인 단계에서 금액 재입력(Type-to-Confirm)이 필요합니다 (§4.6)
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setDialog("approve")}
                  className="flex-1 py-2.5 rounded-lg font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
                  <Icon name="check" className="w-4 h-4" />승인{risk === "low" ? " (Enter)" : ""}</button>
                <button onClick={() => setDialog("reject")}
                  className="flex-1 py-2.5 rounded-lg font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 flex items-center justify-center gap-2">
                  <Icon name="x" className="w-4 h-4" />반려</button>
              </div>
            </Card>
          )}
          {doc.status === "IN_PROGRESS" && !myStep && (
            <div className="rounded-lg bg-slate-900 border border-slate-700/60 px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
              <Icon name="clock" className="w-3.5 h-3.5 shrink-0" />
              현재 차례: {pendingStep ? `${pendingStep.step}단계 ${pendingStep.approver}` : "-"} — 내 차례가 아니어서 승인/반려가 비활성입니다
            </div>
          )}
          {doc.status === "REJECTED" && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-4 text-sm">
              <div className="font-semibold text-rose-200 flex items-center gap-2"><Icon name="x" className="w-4 h-4" />반려 종결</div>
              <p className="text-xs text-slate-400 mt-1">{doc.resultNote}</p>
              <button onClick={() => navigate("draft", { orderId: doc.orderId, type: doc.type })}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600">재기안 →</button>
            </div>
          )}
        </div>

        {/* ── 우: ★반영 예상 PREVIEW ↔ 7연쇄 반영 영수증 ── */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {!receipt && !chainRunning && chainIdx < 0 ? (
            <Card className="relative p-5 border-2 border-dashed border-amber-500/40 overflow-hidden">
              {doc.status === "IN_PROGRESS" && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <span className="text-7xl font-black tracking-[0.3em] text-slate-500/10 rotate-[-14deg]">PREVIEW</span>
                </div>
              )}
              <div className="flex items-center justify-between mb-4 relative">
                <div className="flex items-center gap-2">
                  <SectionLabel color="amber">반영 예상</SectionLabel>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">PREVIEW · ★IDEA-08</span>
                </div>
                <span className="text-[10px] text-slate-500">30초 폴링 · 조회 기준 {AD_NOW.slice(11, 16)}</span>
              </div>
              <div className="overflow-x-auto relative">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th className="py-2 pr-3 font-medium">항목</th>
                      <th className="py-2 px-3 font-medium text-right">현재</th>
                      <th className="py-2 px-3 font-medium text-right">승인 후</th>
                      <th className="py-2 pl-3 font-medium text-right">차액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.expectedDiff.map((r, i) => (
                      <tr key={i} onClick={() => doc.orderId && navigate("orders", { orderId: doc.orderId })}
                        className={`border-b border-slate-800/70 last:border-0 ${doc.orderId ? "cursor-pointer hover:bg-slate-800/40" : ""}`}
                        title={doc.orderId ? "원본 딥링크 — 주문으로 이동 (P2)" : ""}>
                        <td className="py-2.5 pr-3 text-xs text-slate-400">{r.label}</td>
                        {r.type === "money" ? (<>
                          <td className="py-2.5 px-3 text-right"><Money value={r.before} /></td>
                          <td className="py-2.5 px-3 text-right"><Money value={r.after} className="font-bold" /></td>
                          <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-xs">
                            <span className={r.delta < 0 ? "text-rose-300" : r.delta > 0 ? "text-emerald-300" : "text-slate-500"}>
                              {r.delta === 0 ? "±0" : `${r.delta < 0 ? "−" : "+"}₩${fmt(Math.abs(r.delta))}`}</span></td>
                        </>) : r.type === "status" ? (<>
                          <td className="py-2.5 px-3 text-right"><EnumPill status={r.before} /></td>
                          <td className="py-2.5 px-3 text-right"><EnumPill status={r.after} /></td>
                          <td className="py-2.5 pl-3 text-right text-slate-600 text-xs">—</td>
                        </>) : (
                          <td colSpan={3} className="py-2.5 px-3 text-right text-xs text-slate-400">{r.note}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 flex items-start gap-1.5 relative">
                <Icon name="clock" className="w-3 h-3 mt-0.5 shrink-0" />
                조회 시점 계산 — 승인 시점 값이 우선합니다 (§6.1-3) · 각 행 클릭 시 원본으로 이동 (P2)
              </p>
            </Card>
          ) : (
            /* ── 7연쇄 체크리스트 → 반영 영수증 (영구 표시) ── */
            <div ref={receiptRef}>
            <Card className={`p-5 transition-all duration-500 ${receipt ? "border-emerald-500/40" : ""} ${receiptFlash ? "ring-2 ring-purple-500/60" : "ring-0 ring-purple-500/0"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <SectionLabel color="emerald">{receipt ? "반영 영수증 — 결재 문서에 영구 저장" : "7연쇄 반영 실행 중"}</SectionLabel>
                </div>
                {receipt ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Icon name="check" className="w-4 h-4" />예상치와 일치 ✓</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-purple-300"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>{Math.min(chainIdx + 1, 7)} / 7</span>
                )}
              </div>
              <div className="space-y-2">
                {(receipt || chain).map((c, i) => {
                  const state = receipt ? "done" : i < chainIdx ? "done" : i === chainIdx ? "running" : "wait";
                  return (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 ${
                      state === "done" ? "bg-emerald-500/10 border-emerald-500/30"
                      : state === "running" ? "bg-purple-500/15 border-purple-500/40"
                      : "bg-slate-950/40 border-slate-800 opacity-60"}`}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        state === "done" ? "bg-emerald-500/25 text-emerald-200"
                        : state === "running" ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white" : "bg-slate-800 text-slate-500"}`}>
                        {state === "done" ? <Icon name="check" className="w-4 h-4" /> : <Icon name={AD_CHAIN_ICONS[i] || "check"} className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold flex items-center gap-2 ${state === "done" ? "text-emerald-200" : state === "running" ? "text-purple-100" : "text-slate-400"}`}>
                          {i + 1}. {c.label}
                          {c.async && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">비동기 발송 · BS0011</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{c.result}</div>
                      </div>
                      {receipt && c.at && <span className="text-[10px] font-mono text-slate-500 shrink-0">{String(c.at).slice(11)}</span>}
                      {state === "running" && <span className="text-[10px] text-purple-300 shrink-0 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>처리 중</span>}
                    </div>
                  );
                })}
              </div>
              {receipt && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11px] text-slate-500">{doc.resultNote || "7연쇄 반영 완료 — 예상치와 일치 ✓"} · 알림 센터·변경 이력 딥링크의 도착점입니다</p>
                  <div className="flex gap-2">
                    {doc.orderId && <button onClick={() => navigate("orders", { orderId: doc.orderId })} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700">주문 확인 →</button>}
                    <button onClick={() => navigate("auditLog")} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700">변경 이력 →</button>
                    <button onClick={() => navigate("inbox")} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600">다음 결재 →</button>
                  </div>
                </div>
              )}
            </Card>
            </div>
          )}

          {doc.status === "REJECTED" && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-[11px] text-slate-500 flex items-center gap-2">
              <Icon name="shieldCheck" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              반려 문서 — 위 반영 예상은 실행되지 않았으며 어떤 데이터도 변경되지 않았습니다 (BS0006)
            </div>
          )}
        </div>
      </div>

      {/* 승인 확인 — 위험도 3단 마찰, 고위험 Type-to-Confirm (§4.6) */}
      <ConfirmDialog open={dialog === "approve"} risk={risk} confirmLabel="승인 확정" confirmValue={doc.amount}
        title={`${doc.id} 승인`}
        message={myStep && !doc.approvalLine.some((s) => s.status === "PENDING" && s !== myStep)
          ? "최종 단계 승인 — 확정 즉시 7연쇄 반영이 단일 트랜잭션으로 실행됩니다 (실패 시 전체 롤백 · §6.1-2)."
          : "승인 후 다음 단계 승인자에게 알림이 발송됩니다."}
        summary={
          <div className="space-y-1">
            {moneyRows.map((r, i) => (
              <div key={i} className="flex justify-between font-mono tabular-nums text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span>₩{fmt(r.before)} → ₩{fmt(r.after)} <span className={r.delta < 0 ? "text-rose-300" : "text-emerald-300"}>({r.delta < 0 ? "−" : "+"}₩{fmt(Math.abs(r.delta))})</span></span>
              </div>
            ))}
            {moneyRows.length === 0 && <div className="text-xs text-slate-400">{doc.opinion}</div>}
          </div>}
        onConfirm={approve} onClose={() => setDialog(null)} />

      {/* 반려 — 사유 필수 (BS0006) */}
      <ConfirmDialog open={dialog === "reject"} risk="mid" danger confirmLabel="반려 확정"
        title={`${doc.id} 반려`}
        message="반려하면 문서가 종결됩니다 — 데이터는 변경되지 않습니다 (BS0006)."
        summary={<div className="text-xs text-slate-400">7연쇄 반영은 어느 것도 실행되지 않습니다 · 기안자에게 사유가 전달됩니다</div>}
        onConfirm={reject} onClose={() => { setDialog(null); setRejectReason(""); }}>
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1.5">반려 사유 *</label>
          <textarea autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}
            placeholder="예: 환불 산정 근거 부족 — 계약서 첨부 요망"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-rose-400 outline-none resize-none" />
        </div>
      </ConfirmDialog>
    </div>
  );
}
window.ApprovalDetail = ApprovalDetail;
