// console.jsx — 02 환불 결재 콘솔: 기안 4스텝 위저드
// ①주문 조회 → ②환불 유형·금액(라이브 재계산) → ③승인선 지정(policyMode 반영) → ④7연쇄 확인·상신
const { useState: useState_c, useMemo: useMemo_c, useEffect: useEffect_c } = React;

const CHAIN_STEPS = [
  { key: "APPROVAL_STATUS",   title: "1. 결재 상태 변경",  icon: "shieldCheck" },
  { key: "ORDER_STATUS",      title: "2. 주문 상태 전이",  icon: "refresh" },
  { key: "SALES_RECALC",      title: "3. 매출 재계산",     icon: "chart" },
  { key: "SETTLEMENT_RECALC", title: "4. 정산 재계산",     icon: "db" },
  { key: "PROFIT_REFLECT",    title: "5. 손익 반영",       icon: "activity" },
  { key: "AUDIT_LOG",         title: "6. 감사 로그 기록",  icon: "history" },
  { key: "NOTIFY",            title: "7. 알림 발송",       icon: "bell" },
];

function RefundConsole({ tweaks, navigate, route }) {
  const [step, setStep] = useState_c(1);
  const [orderId, setOrderId] = useState_c(route?.payload?.orderId || null);
  const [q, setQ] = useState_c("");
  const [onlyRefund, setOnlyRefund] = useState_c(false);
  const [refundType, setRefundType] = useState_c("PARTIAL_REFUND");
  const [refundAmount, setRefundAmount] = useState_c(0);
  const [opinion, setOpinion] = useState_c("");
  const [chainIdx, setChainIdx] = useState_c(-1);   // -1: 미상신 / 0~6: 진행 / 7: 완료
  const policyMode = tweaks.policyMode || "PRIORITY";

  const order = window.ORDERS.find(o => o.id === orderId) || null;

  const targets = window.ORDERS.filter(o => {
    if (onlyRefund && o.status !== "REFUND_REQUESTED") return false;
    if (o.status === "CANCELLED") return false;
    if (q && !o.clientName.includes(q) && !o.item.includes(q) && !o.id.includes(q)) return false;
    return true;
  });

  // ── 라이브 재계산 (Step 2) — §5.1 연쇄 3·4·5 미리보기 산식 ─────────
  const calc = useMemo_c(() => {
    if (!order) return null;
    const currentNet = order.amount - order.refundedAmount;              // 현재 순매출
    const r = refundType === "FULL_REFUND" ? currentNet : (Number(refundAmount) || 0);
    const over = r > currentNet;                                         // 환불 누계 > 결제 누계 → 422
    const newNet = currentNet - r;
    // 정산 재계산(BS0002): 수행 완료(done) 작업 지급 유지 · 미수행 제외
    const keepRatio = order.taskCount ? order.doneTaskCount / order.taskCount : 0;
    const excludedTasks = order.taskCount - order.doneTaskCount;
    const newOutsourcing = refundType === "FULL_REFUND"
      ? Math.floor(order.outsourcingCost * keepRatio)
      : (r > 0 ? Math.floor(order.outsourcingCost * keepRatio) : order.outsourcingCost);
    const profitBefore = currentNet - order.fee - order.outsourcingCost;
    const profitAfter = newNet - order.fee - newOutsourcing;
    return { currentNet, r, over, newNet, newOutsourcing, excludedTasks, profitBefore, profitAfter };
  }, [order, refundType, refundAmount]);

  // ── 승인선 (Step 3) — 양식 로드 + 금액 규칙 (§5.4: 환불 ≥ 100만원 → 대표 추가) ──
  const tpl = window.APPROVAL_TEMPLATES.find(t => t.type === refundType);
  const line = useMemo_c(() => {
    if (!tpl || !calc) return [];
    let roles = [...tpl.defaultLine];
    if (calc.r >= 1000000 && !roles.includes("CEO")) roles = [...roles, "CEO"];
    return roles.map((role, i) => ({ step: i + 1, role, approver: window.APPROVERS[role] }));
  }, [tpl, calc]);
  const bigAmountRule = calc && calc.r >= 1000000;

  // ── Step 4 — 상신 시 7연쇄 순차 체크 애니메이션 ────────────────────
  useEffect_c(() => {
    if (chainIdx < 0 || chainIdx >= CHAIN_STEPS.length) return;
    const t = setTimeout(() => setChainIdx(chainIdx + 1), 420);
    return () => clearTimeout(t);
  }, [chainIdx]);

  const submitted = chainIdx >= CHAIN_STEPS.length;
  const nextOrderStatus = refundType === "FULL_REFUND" ? "CANCELLED" : "PARTIALLY_REFUNDED";

  const chainDesc = (key) => {
    if (!order || !calc) return "";
    switch (key) {
      case "APPROVAL_STATUS":   return `APR-20260710-07 · SUBMITTED → APPROVED (승인선 ${line.length}단계 완료 시)`;
      case "ORDER_STATUS":      return `${order.id} · ${order.status} → ${nextOrderStatus} (전이표 검증 — BS0010)`;
      case "SALES_RECALC":      return `sales_events −₩${window.fmt(calc.r)} 적재 · 순매출 ₩${window.fmt(calc.currentNet)} → ₩${window.fmt(calc.newNet)}`;
      case "SETTLEMENT_RECALC": return `미수행 작업 ${calc.excludedTasks}건 제외 · 외주비 ₩${window.fmt(order.outsourcingCost)} → ₩${window.fmt(calc.newOutsourcing)} + 재계산 이력`;
      case "PROFIT_REFLECT":    return `손익 ₩${window.fmt(calc.profitBefore)} → ₩${window.fmt(calc.profitAfter)} (이벤트 원장 집계 — 커밋 즉시 반영)`;
      case "AUDIT_LOG":         return `전/후 값 스냅샷 + 사유 불변 기록 (MG1004) — 반려 시에는 이 로그 외 데이터 무변경`;
      case "NOTIFY":            return `기안자·재무 인앱/이메일 알림 — 실패 시 3회 재시도, 재무 반영은 불변 (BS0011)`;
      default: return "";
    }
  };

  const canStep2 = !!order;
  const canStep3 = canStep2 && calc && calc.r > 0 && !calc.over;
  const canStep4 = canStep3 && line.length > 0;

  const goStep = (n) => {
    if (submitted || chainIdx >= 0) return;
    if (n === 1 || (n === 2 && canStep2) || (n === 3 && canStep3) || (n === 4 && canStep4)) setStep(n);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="cyan">REFUND CONSOLE · 전자결재 기안</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">환불 결재 콘솔</h1>
          <p className="text-sm text-slate-300 mt-1">주문 조회 → 환불 금액 라이브 재계산 → 승인선 지정 → 7연쇄 확인 후 상신</p>
        </div>
        <button onClick={() => navigate('dashboard')} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5">취소</button>
      </div>

      {/* 4스텝 진행 표시 */}
      <window.Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          {[
            { n: 1, label: "주문 조회",       icon: "search" },
            { n: 2, label: "환불 유형·금액",  icon: "chart" },
            { n: 3, label: "승인선 지정",     icon: "user" },
            { n: 4, label: "7연쇄 확인·상신", icon: "send" },
          ].map((s, i, arr) => {
            const active = step === s.n;
            const done = step > s.n;
            return (
              <React.Fragment key={s.n}>
                <button onClick={() => goStep(s.n)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition ${active ? 'bg-purple-500/20 text-purple-100' : done ? 'text-emerald-400 hover:bg-white/5' : 'text-slate-500'}`}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${active ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' : done ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5 text-slate-500'}`}>
                    {done ? <window.Icon name="check" className="w-3.5 h-3.5" /> : s.n}
                  </div>
                  <span className="text-sm font-medium">{s.label}</span>
                </button>
                {i < arr.length - 1 && <div className={`flex-1 h-px ${step > s.n ? 'bg-emerald-500/40' : 'bg-white/10'}`}></div>}
              </React.Fragment>
            );
          })}
        </div>
      </window.Card>

      {/* ── Step 1 · 주문 조회 ── */}
      {step === 1 && (
        <window.Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <window.Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="고객사·주문명·주문번호 검색" className="w-full pl-9 pr-3 py-1.5 rounded-md bg-slate-950/60 border border-white/10 text-sm focus:border-purple-500 outline-none" />
            </div>
            <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-white/5 border border-white/10">
              <button onClick={() => setOnlyRefund(false)} className={`px-2.5 py-1 rounded ${!onlyRefund ? 'bg-purple-500/30 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>전체 주문</button>
              <button onClick={() => setOnlyRefund(true)} className={`px-2.5 py-1 rounded ${onlyRefund ? 'bg-rose-500/30 text-rose-200' : 'text-slate-400 hover:text-slate-200'}`}>환불 요청만</button>
            </div>
            <div className="text-xs text-slate-500 ml-auto">{targets.length}건 · 선택 <span className="text-purple-300 font-semibold">{order ? 1 : 0}</span>건</div>
            <button disabled={!canStep2} onClick={() => setStep(2)}
              className="text-sm px-4 py-1.5 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-purple-500/20">
              다음 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="px-6 py-2.5 w-10"></th>
                  <th className="px-3 py-2.5 font-medium">주문번호</th>
                  <th className="px-3 py-2.5 font-medium">플랫폼</th>
                  <th className="px-3 py-2.5 font-medium">고객사 · 주문명</th>
                  <th className="px-3 py-2.5 font-medium text-right">주문 금액</th>
                  <th className="px-3 py-2.5 font-medium text-right">기환불</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  <th className="px-3 py-2.5 font-medium">작업 진행</th>
                  <th className="px-6 py-2.5 font-medium">납기</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(o => {
                  const sel = orderId === o.id;
                  return (
                    <tr key={o.id} onClick={() => setOrderId(o.id)} className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition ${sel ? 'bg-purple-500/10' : ''}`}>
                      <td className="px-6 py-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition ${sel ? 'border-purple-400' : 'border-white/20'}`}>
                          {sel && <span className="w-2 h-2 rounded-full bg-purple-400"></span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-400">{o.id}</td>
                      <td className="px-3 py-3"><window.PlatformBadge platform={o.platform} /></td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-xs">{o.item}</div>
                        <div className="text-[11px] text-slate-500">{o.clientName}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">₩{window.fmt(o.amount)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">{o.refundedAmount > 0 ? <span className="text-rose-300">−₩{window.fmt(o.refundedAmount)}</span> : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-3"><window.EnumPill status={o.status} /></td>
                      <td className="px-3 py-3 text-xs text-slate-400 tabular-nums">{o.doneTaskCount}/{o.taskCount} 완료</td>
                      <td className="px-6 py-3 text-xs text-slate-400 tabular-nums">{o.dueDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </window.Card>
      )}

      {/* ── Step 2 · 환불 유형·금액 — 라이브 재계산 ── */}
      {step === 2 && order && calc && (
        <div className="grid grid-cols-12 gap-4">
          <window.Card className="col-span-12 lg:col-span-7 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">환불 유형 · 금액</h3>
              <span className="text-[11px] font-mono text-slate-500">{order.id} · {order.clientName}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "PARTIAL_REFUND", label: "부분환불", desc: "일부 금액만 환불 — 주문은 부분환불 상태로 유지" },
                { key: "FULL_REFUND",    label: "전체환불", desc: "잔여 전액 환불 — 주문 취소 처리 (수행 완료 외주비는 지급 유지)" },
              ].map(t => {
                const on = refundType === t.key;
                return (
                  <button key={t.key} onClick={() => { setRefundType(t.key); if (t.key === "FULL_REFUND") setRefundAmount(calc.currentNet); }}
                    className={`text-left p-4 rounded-lg border transition ${on ? 'bg-purple-500/15 border-purple-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{t.label}</span>
                      {on && <window.Icon name="check" className="w-4 h-4 text-purple-300" />}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{t.desc}</div>
                  </button>
                );
              })}
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500">환불 금액</label>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₩</span>
                  <input type="number" min={0} value={refundType === "FULL_REFUND" ? calc.currentNet : refundAmount}
                    disabled={refundType === "FULL_REFUND"}
                    onChange={e => setRefundAmount(Number(e.target.value))}
                    className={`w-full pl-8 pr-3 py-2.5 rounded-md bg-slate-950/60 border text-lg font-bold tabular-nums outline-none transition ${calc.over ? 'border-rose-500 text-rose-300' : 'border-white/10 focus:border-purple-500'} disabled:opacity-60`} />
                </div>
                {refundType === "PARTIAL_REFUND" && (
                  <div className="flex gap-1.5">
                    {[["25%", Math.floor(calc.currentNet * 0.25)], ["50%", Math.floor(calc.currentNet * 0.5)], ["미수행분", Math.floor(order.amount * (order.taskCount - order.doneTaskCount) / order.taskCount)]].map(([l, v]) => (
                      <button key={l} onClick={() => setRefundAmount(v)} className="px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-purple-500/15 hover:border-purple-500/30 text-xs whitespace-nowrap">{l}</button>
                    ))}
                  </div>
                )}
              </div>
              {calc.over && (
                <div className="mt-2 text-xs text-rose-300 flex items-center gap-1.5">
                  <window.Icon name="alert" className="w-3.5 h-3.5" />
                  환불 금액 초과 — 환불 누계는 결제 누계 ₩{window.fmt(calc.currentNet)}를 넘을 수 없습니다 (422 · 트랜잭션 롤백)
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500">기안 사유</label>
              <textarea value={opinion} onChange={e => setOpinion(e.target.value)} rows={2} placeholder="예: 체험단 20건 중 6건 미진행 — 고객 요청 부분환불"
                className="w-full mt-1.5 px-3 py-2 rounded-md bg-slate-950/60 border border-white/10 text-sm focus:border-purple-500 outline-none resize-none" />
            </div>
            <div className="pt-1 flex items-center justify-between">
              <button onClick={() => setStep(1)} className="text-sm px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1.5">
                <window.Icon name="chevronLeft" className="w-3.5 h-3.5" />이전
              </button>
              <button disabled={!canStep3} onClick={() => setStep(3)}
                className="text-sm px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed">
                승인선 지정 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
              </button>
            </div>
          </window.Card>

          {/* 라이브 재계산 패널 — 입력 즉시 차감 매출·새 정산액 계산 */}
          <window.Card className="col-span-12 lg:col-span-5 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">반영 예상 <span className="text-[10px] font-normal text-amber-300 ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">예상 · 승인 시 확정</span></h3>
              <span className="text-[10px] text-slate-500">입력 즉시 재계산</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">원 주문 금액</span><span className="tabular-nums">₩{window.fmt(order.amount)}</span></div>
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">기환불 누계</span><span className="tabular-nums text-slate-400">{order.refundedAmount > 0 ? `−₩${window.fmt(order.refundedAmount)}` : "—"}</span></div>
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">이번 환불</span><span className={`tabular-nums font-semibold ${calc.r > 0 ? 'text-rose-300' : 'text-slate-500'}`}>−₩{window.fmt(calc.r)}</span></div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-white/10 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">차감 후 순매출 (연쇄 3)</div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-slate-400 text-sm line-through">₩{window.fmt(calc.currentNet)}</span>
                  <window.Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
                  <span className={`text-lg font-bold ${calc.over ? 'text-rose-400' : 'text-slate-50'}`}>₩{window.fmt(Math.max(0, calc.newNet))}</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">새 정산액 · 외주비 (연쇄 4)</div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-slate-400 text-sm line-through">₩{window.fmt(order.outsourcingCost)}</span>
                  <window.Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-lg font-bold text-slate-50">₩{window.fmt(calc.newOutsourcing)}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">미수행 작업 {calc.excludedTasks}건 지급 제외 · 수행 완료 {order.doneTaskCount}건 유지 (BS0002)</div>
              </div>
              <div className="border-t border-white/5 pt-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">주문 손익 (연쇄 5)</div>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="text-slate-400 text-sm line-through">₩{window.fmt(calc.profitBefore)}</span>
                  <window.Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
                  <span className={`text-lg font-bold ${calc.profitAfter < calc.profitBefore ? 'text-rose-300' : 'text-emerald-300'}`}>₩{window.fmt(calc.profitAfter)}</span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
              <window.Icon name="shieldCheck" className="w-3 h-3 mt-0.5 text-emerald-400 flex-shrink-0" />
              환불은 금액 덮어쓰기가 아니라 매출 이벤트(−) 적재로 기록됩니다 — 원 주문 금액은 불변 (ADR-002)
            </div>
          </window.Card>
        </div>
      )}

      {/* ── Step 3 · 승인선 지정 — policyMode에 따라 UI가 달라짐 ── */}
      {step === 3 && order && calc && (
        <div className="grid grid-cols-12 gap-4">
          <window.Card className="col-span-12 lg:col-span-8 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">승인선 지정</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  결재 양식 <span className="font-mono text-purple-300">{tpl?.id}</span> · {tpl?.name} 로드
                  {bigAmountRule && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px]">규칙 적용: 환불 ≥ 100만원 → 대표 승인 추가</span>}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${policyMode === 'PRIORITY' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'}`}>
                {policyMode === 'PRIORITY' ? '순차 결재 (PRIORITY)' : '병렬 합의 (BROADCAST)'}
              </span>
            </div>

            {policyMode === 'PRIORITY' ? (
              /* 순차 — 세로 타임라인, 앞 단계 승인 후 다음 활성 */
              <div className="space-y-0">
                {line.map((s, i) => (
                  <div key={s.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${i === 0 ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white ring-4 ring-purple-500/20' : 'bg-white/5 text-slate-500 border border-white/10'}`}>{s.step}</div>
                      {i < line.length - 1 && <div className="w-px flex-1 min-h-[28px] bg-white/10"></div>}
                    </div>
                    <div className={`flex-1 pb-5 ${i === 0 ? '' : 'opacity-60'}`}>
                      <div className={`p-3.5 rounded-lg border ${i === 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold">{s.approver[0]}</div>
                            <div>
                              <div className="text-sm font-medium">{s.approver} <span className="text-slate-500 text-xs">· {window.ROLE_LABELS[s.role]}</span></div>
                              <div className="text-[10px] font-mono text-slate-500">{s.role}</div>
                            </div>
                          </div>
                          {i === 0
                            ? <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">상신 시 즉시 알림</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-500 flex items-center gap-1"><window.Icon name="clock" className="w-3 h-3" />{s.step - 1}단계 승인 후 활성</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                  <window.Icon name="chevronRight" className="w-3 h-3 text-purple-400" />
                  순차 결재 — 앞 단계가 승인해야 다음 단계가 열립니다. 중간 반려 시 즉시 종결(데이터 무변경).
                </div>
              </div>
            ) : (
              /* 병렬 — 가로 카드 그리드, 전원 동시 상신 */
              <div>
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2 mb-3">
                  <window.Icon name="send" className="w-3.5 h-3.5" />
                  병렬 합의 — 상신 즉시 <b className="mx-1">{line.length}명 전원</b>에게 동시 통보 · 전원 승인 시 확정, 1명이라도 반려 시 종결
                </div>
                <div className={`grid gap-3 ${line.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {line.map(s => (
                    <div key={s.step} className="p-4 rounded-lg bg-cyan-500/[0.07] border border-cyan-500/30 text-center">
                      <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-sm font-bold text-white">{s.approver[0]}</div>
                      <div className="mt-2 text-sm font-medium">{s.approver}</div>
                      <div className="text-xs text-slate-400">{window.ROLE_LABELS[s.role]} <span className="font-mono text-[10px] text-slate-500">{s.role}</span></div>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 animate-pulse"></span>동시 통보
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
              <window.Icon name="settings" className="w-3 h-3" />
              결재 정책은 우측 하단 Tweaks 패널에서 전환할 수 있습니다 — 순차 결재 ↔ 병렬 합의
            </div>
          </window.Card>

          <window.Card className="col-span-12 lg:col-span-4 p-5 space-y-4">
            <h3 className="font-semibold">기안 요약</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">대상 주문</span><span className="font-mono text-xs">{order.id}</span></div>
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">유형</span><span className="text-xs font-medium">{window.APPROVAL_TYPE_LABELS[refundType]}</span></div>
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">환불 금액</span><span className="tabular-nums font-semibold text-rose-300">−₩{window.fmt(calc.r)}</span></div>
              <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">승인선</span><span className="text-xs">{line.map(s => window.ROLE_LABELS[s.role]).join(policyMode === 'PRIORITY' ? ' → ' : ' + ')}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">정책</span><span className="text-xs font-medium">{policyMode === 'PRIORITY' ? '순차 결재' : '병렬 합의'}</span></div>
            </div>
            <div className="pt-2 space-y-2">
              <button onClick={() => setStep(4)} className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30">
                7연쇄 확인 <window.Icon name="arrowRight" className="w-4 h-4" />
              </button>
              <button onClick={() => setStep(2)} className="w-full py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm">이전 단계</button>
            </div>
          </window.Card>
        </div>
      )}

      {/* ── Step 4 · 7연쇄 체크리스트 + 상신 애니메이션 ── */}
      {step === 4 && order && calc && (
        <window.Card className="p-7">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <window.Icon name="shieldCheck" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">승인 시 함께 일어나는 7가지 후속 처리</h3>
              <div className="text-xs text-slate-500">단일 트랜잭션(@Transactional) — 하나라도 실패하면 전체 롤백 · 알림만 커밋 후 비동기</div>
            </div>
            <div className="ml-auto text-xs text-slate-400 tabular-nums">
              {window.APPROVAL_TYPE_LABELS[refundType]} · <span className="text-rose-300 font-semibold">−₩{window.fmt(calc.r)}</span> · {order.id}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {CHAIN_STEPS.map((c, i) => {
              const state = chainIdx < 0 ? 'idle' : i < chainIdx ? 'done' : i === chainIdx ? 'running' : 'wait';
              return (
                <div key={c.key} className={`flex items-start gap-3.5 p-3.5 rounded-lg border transition-all duration-300 ${
                  state === 'done' ? 'bg-emerald-500/10 border-emerald-500/30' :
                  state === 'running' ? 'bg-purple-500/15 border-purple-500/40' :
                  'bg-white/[0.03] border-white/10'}`}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition ${
                    state === 'done' ? 'bg-emerald-500/30 text-emerald-200' :
                    state === 'running' ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' :
                    'bg-white/5 text-slate-500'}`}>
                    {state === 'done' ? <window.Icon name="check" className="w-4 h-4" /> : <window.Icon name={c.icon} className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${state === 'done' ? 'text-emerald-200' : state === 'running' ? 'text-purple-100' : 'text-slate-300'}`}>{c.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{chainDesc(c.key)}</div>
                  </div>
                  {state === 'running' && <span className="text-[10px] text-purple-300 flex items-center gap-1.5 flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>처리 중</span>}
                  {state === 'done' && <span className="text-[10px] text-emerald-300 flex-shrink-0">완료</span>}
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-white/10">
            {chainIdx < 0 && (
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(3)} className="text-sm px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1.5">
                  <window.Icon name="chevronLeft" className="w-3.5 h-3.5" />이전
                </button>
                <div className="text-[11px] text-slate-500">반려 시 위 7단계 중 어느 것도 실행되지 않습니다 — 데이터 무변경 (BS0006)</div>
                <button onClick={() => setChainIdx(0)} className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold flex items-center gap-2 shadow-lg shadow-purple-500/30">
                  <window.Icon name="send" className="w-4 h-4" />전자결재 상신
                </button>
              </div>
            )}
            {chainIdx >= 0 && !submitted && (
              <div className="flex items-center gap-2 text-sm text-purple-200">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                반영 시뮬레이션 진행 중 — {Math.min(chainIdx + 1, 7)} / 7
              </div>
            )}
            {submitted && (
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <window.Icon name="check" className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-emerald-200">기안 상신 완료 — <span className="font-mono">APR-20260710-07</span> <window.EnumPill status="SUBMITTED" /></div>
                  <div className="text-xs text-slate-400 mt-1">
                    {policyMode === 'PRIORITY' ? `1단계 ${line[0]?.approver} ${window.ROLE_LABELS[line[0]?.role]}에게 알림 발송` : `${line.length}명 전원에게 동시 알림 발송`} · 최종 승인 시 위 7단계가 단일 트랜잭션으로 확정 실행됩니다
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => navigate('history')} className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-sm hover:bg-white/10">이력 보기</button>
                  <button onClick={() => navigate('dashboard')} className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 text-sm font-semibold flex items-center gap-1.5">
                    대시보드에서 확인 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </window.Card>
      )}
    </div>
  );
}

window.RefundConsole = RefundConsole;
