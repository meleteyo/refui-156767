// settlement-confirm.jsx — 25 정산 확정 (route: settlement)
// IDEA-14 확정 리추얼·잠금의 시각 언어 / IDEA-07 금액 계보 / IDEA-16 다음 행동 릴레이
// 확정 해제는 화면에서 직접 수행하지 않음 — 결재 승인 경유만 (UC25-1, MG1003)
const { useState, useMemo, useEffect } = React;

function SettlementConfirm({ route, navigate, tweaks }) {
  const { Card, SectionLabel, PageHeader, EnumPill, Money, LockBadge, ConfirmDialog, Icon, fmt } = window;

  const [items, setItems] = useState(SETTLEMENTS);
  const periods = useMemo(() => [...new Set(SETTLEMENTS.map((x) => x.period))].sort().reverse(), []);
  const [selId, setSelId] = useState(
    route?.payload?.settlementId || SETTLEMENTS.find((x) => x.status === 'DRAFT')?.id || SETTLEMENTS[0].id
  );
  const [diffChecked, setDiffChecked] = useState({});   // settlementId → bool (체크리스트 3항)
  const [recalcedAt, setRecalcedAt] = useState({});     // settlementId → 마지막 재계산 실행 표시
  const [adjOpen, setAdjOpen] = useState(true);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [justLocked, setJustLocked] = useState(null);   // 자물쇠 닫힘 애니메이션 대상

  // 딥링크 갱신 (settlement payload)
  useEffect(() => {
    if (route?.payload?.settlementId) setSelId(route.payload.settlementId);
  }, [route?.payload?.settlementId]);

  const s = items.find((x) => x.id === selId) || items[0];
  const period = s.period;
  const periodItems = items.filter((x) => x.period === period);

  // ── 파생 집계 (data.js 원장에서 실시간 유도) ─────────────────────────────
  const deptOrders = useMemo(
    () => ORDERS.filter((o) => o.deptId === s.deptId && o.orderedAt.startsWith(s.period)),
    [s.id]
  );
  const orderIds = deptOrders.map((o) => o.id);
  const salesOf = (oid) => SALES_EVENTS.filter((e) => e.orderId === oid).reduce((a, e) => a + e.amount, 0);
  const unassignedTasks = TASKS.filter((t) => t.assigneeId === null && orderIds.includes(t.orderId));
  const activeApprovalOrders = deptOrders.filter((o) => o.activeApprovalId);
  const freelancerCount = new Set(
    ASSIGNMENTS.filter((a) => {
      const t = TASKS.find((x) => x.id === a.taskId);
      return t && orderIds.includes(t.orderId);
    }).map((a) => a.freelancerId)
  ).size;

  const snap = s.snapshot;
  const netSales = snap.orderAmount - snap.refundAmount + snap.repaymentAmount;
  const computedProfit = netSales - snap.platformFee - snap.outsourcingCost;
  const checksumOk = computedProfit === snap.profit;

  // 직전 확정 (같은 부서 · 이전 기간)
  const prevConfirmed = items
    .filter((x) => x.deptId === s.deptId && x.status === 'CONFIRMED' && x.period < s.period)
    .sort((a, b) => (a.period < b.period ? 1 : -1))[0];

  // ── diff 미리보기 행 — recalcHistory × 결재 expectedDiff 로 주문 단위 전개 ──
  const diffRows = useMemo(() => {
    const changed = s.recalcHistory.map((h) => {
      const apr = APPROVALS.find((a) => a.id === h.approvalId);
      const sales = apr?.expectedDiff?.find((d) => d.field === 'currentSales');
      return {
        orderId: apr?.orderId || '—', item: '매출',
        before: sales ? sales.before : h.before, after: sales ? sales.after : h.after,
        delta: sales ? sales.delta : h.delta, trigger: h.approvalId, at: h.at,
      };
    });
    const changedIds = changed.map((r) => r.orderId);
    const unchanged = deptOrders
      .filter((o) => !changedIds.includes(o.id) && o.refundedAmount === 0)
      .slice(0, 2)
      .map((o) => ({ orderId: o.id, item: '매출', before: salesOf(o.id), after: salesOf(o.id), delta: 0, trigger: null, at: null }));
    return [...changed, ...unchanged];
  }, [s.id]);
  const changedCount = diffRows.filter((r) => r.delta !== 0).length;

  // ── 체크리스트 (IDEA-14) — 전 항목 충족 시에만 확정 활성화 ────────────────
  const checks = [
    {
      key: 'unassigned', ok: unassignedTasks.length === 0,
      label: `미배정 작업 ${unassignedTasks.length}건`,
      desc: unassignedTasks.length === 0 ? '대상 기간 전 작업 배정 완료' : `${unassignedTasks.map((t) => t.id).join(' · ')} 배정 필요`,
      action: unassignedTasks.length > 0 ? { label: '배정 화면으로 →', go: () => navigate('assign', { taskIds: unassignedTasks.map((t) => t.id) }) } : null,
    },
    {
      key: 'approvals', ok: activeApprovalOrders.length === 0,
      label: `진행 중 결재 ${activeApprovalOrders.length}건`,
      desc: activeApprovalOrders.length === 0 ? '대상 주문에 진행 중 결재 없음' : activeApprovalOrders.map((o) => o.activeApprovalId).join(' · '),
      action: activeApprovalOrders.length > 0 ? { label: '결재함으로 →', go: () => navigate('inbox') } : null,
    },
    {
      key: 'diff', ok: !!diffChecked[s.id],
      label: 'diff 확인 완료',
      desc: diffChecked[s.id] ? '재계산 diff 검토 체크됨' : '아래 diff 미리보기 확인 후 체크',
      toggle: () => setDiffChecked((m) => ({ ...m, [s.id]: !m[s.id] })),
    },
  ];
  const allOk = checks.every((c) => c.ok);

  // ── 정산 확정 (settlement1003 시뮬레이션) — 중위험 마찰 §4.6 ──────────────
  const doConfirm = () => {
    setDlgOpen(false);
    setItems((list) => list.map((x) =>
      x.id === s.id ? { ...x, status: 'CONFIRMED', confirmedAt: `${TODAY} 11:45`, confirmedById: CURRENT_USER_ID } : x
    ));
    setJustLocked(s.id);
    window.toast(`${s.target} ${s.period} 정산 확정 — 스냅샷 저장 · 기간 잠금 (MG1003)`, {
      actionLabel: '지급명세서 생성 →',
      onAction: () => navigate('payout', { period: s.period }),
    });
    setTimeout(() => {
      window.toast('확정 정산 기준으로 세금계산서를 발행할 수 있어요', {
        actionLabel: '세금계산서 발행 요청 →',
        onAction: () => navigate('taxInvoice', { settlementId: s.id }),
      });
    }, 900);
  };

  const confirmedBy = EMPLOYEES.find((e) => e.id === s.confirmedById);
  const isConfirmed = s.status === 'CONFIRMED';

  return (
    <div className="max-w-5xl">
      <style>{`@keyframes lockPop{0%{transform:scale(.5);opacity:0}55%{transform:scale(1.18)}100%{transform:scale(1);opacity:1}}`}</style>
      <PageHeader
        label="FINANCE · SETTLEMENT" labelColor="emerald"
        title="정산 확정"
        desc="기간 집계 → diff 확인 → 체크리스트 충족 → 확정(스냅샷 저장 + 잠금 MG1003). 해제는 결재 승인 경유만."
        actions={
          <button onClick={() => navigate('payout', { period })}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1.5">
            지급 명세서로 <Icon name="arrowRight" className="w-3.5 h-3.5" />
          </button>
        }
      />

      {/* 기간 · 대상 선택 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">정산 기간 <span className="text-rose-400">*</span></label>
          <select
            value={period}
            onChange={(e) => {
              const first = items.find((x) => x.period === e.target.value);
              if (first) setSelId(first.id);
            }}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm font-mono focus:border-emerald-500/60 outline-none">
            {periods.map((p) => <option key={p} value={p}>{p.slice(0, 4)}년 {p.slice(5)}월</option>)}
          </select>
          <div className="flex items-center gap-1.5 flex-wrap">
            {periodItems.map((x) => (
              <button key={x.id} onClick={() => setSelId(x.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition inline-flex items-center gap-1.5 ${
                  x.id === selId ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}>
                {x.status === 'CONFIRMED' && <Icon name="lock" className="w-3 h-3" />}
                {x.target}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{s.id}</span>
            <EnumPill status={s.status} />
          </div>
        </div>
        {prevConfirmed && (
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Icon name="lock" className="w-3 h-3" />
            직전 확정 — {prevConfirmed.period.slice(0, 4)}년 {prevConfirmed.period.slice(5)}월분 · {prevConfirmed.confirmedAt?.slice(0, 10)} 확정 (잠금)
          </div>
        )}
      </Card>

      {/* 확정 상태 배너 (CONFIRMED) — 잠금의 시각 언어 */}
      {isConfirmed && (
        <Card className="p-4 mb-4 !border-emerald-500/40 bg-gradient-to-r from-emerald-500/[0.08] to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0"
                style={justLocked === s.id ? { animation: 'lockPop .4s ease-out' } : undefined}>
                <Icon name="lock" className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-200 flex items-center gap-2">
                  {s.confirmedAt?.slice(0, 10)} 확정 · 확정자 {confirmedBy?.name || '—'} ({confirmedBy?.position || 'FINANCE'})
                  <LockBadge date={s.confirmedAt?.slice(0, 10)} reason="확정 정산 — 스냅샷 불변" />
                </div>
                <p className="text-xs text-slate-400 mt-1">수정은 조정 결재로만 가능합니다 — 소급 반영은 조정 이벤트(settlement_adjustments)로만 적재됩니다 (MG1003 · BS0006)</p>
              </div>
            </div>
            <button onClick={() => navigate('draft', { settlementId: s.id, type: 'SETTLEMENT_ADJUST' })}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
              확정 해제 기안 작성 →
            </button>
          </div>
          {/* 조정 이벤트 접이식 타임라인 */}
          <div className="mt-3 border-t border-emerald-500/20 pt-3">
            <button onClick={() => setAdjOpen((v) => !v)} className="text-xs text-slate-300 inline-flex items-center gap-1.5 hover:text-white">
              <Icon name={adjOpen ? 'chevronDown' : 'chevronRight'} className="w-3.5 h-3.5" />
              조정 이벤트 {s.adjustments.length}건 — 확정 후 변경은 이 타임라인으로만 적재됩니다
            </button>
            {adjOpen && (
              s.adjustments.length === 0 ? (
                <div className="mt-2 ml-5 text-[11px] text-slate-500">조정 이벤트 없음 — 확정 스냅샷이 원본 그대로 유지되고 있습니다</div>
              ) : (
                <div className="mt-2 ml-5 space-y-1.5">
                  {s.adjustments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 text-xs rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
                      <span className="font-mono text-[10px] text-slate-500">{a.at}</span>
                      <span className="text-slate-300 flex-1">{a.reason}</span>
                      <Money value={a.amount} />
                      <button onClick={() => navigate('approvalDetail', { approvalId: a.approvalId })}
                        className="font-mono text-[11px] text-cyan-300 hover:underline">{a.approvalId}</button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </Card>
      )}

      {/* 기간 집계 */}
      <Card className={`p-5 mb-4 ${isConfirmed ? 'opacity-90' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">기간 집계 — {s.target} {period}</h3>
          <div className="flex items-center gap-3">
            <span title={`집계 기준 ${AGGREGATED_AT} · 대상 이벤트 ${SALES_EVENTS.filter((e) => orderIds.includes(e.orderId)).length}건`}
              className={`inline-flex items-center gap-1 text-[11px] cursor-help ${checksumOk ? 'text-emerald-300' : 'text-amber-300'}`}>
              <Icon name={checksumOk ? 'check' : 'alert'} className="w-3 h-3" />
              집계 기준 {(recalcedAt[s.id] || AGGREGATED_AT).slice(11)} · 검산 {checksumOk ? '통과' : '불일치'}
            </span>
            <button onClick={() => { setRecalcedAt((m) => ({ ...m, [s.id]: `${TODAY} 11:5${Object.keys(m).length}` })); window.toast('대상 집계 갱신 완료 — 이벤트 원장 재합산 (BS0001)'); }}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1.5">
              <Icon name="refresh" className="w-3 h-3" />대상 집계
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">매출 <span className="text-[10px] font-mono text-slate-600">BS0001 이벤트 합산</span></span>
            <Money value={netSales} size="md" formula={[
              { label: '결제 합계', value: snap.orderAmount },
              { label: '환불', value: -snap.refundAmount },
              { label: '재결제', value: snap.repaymentAmount },
            ]} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">대상 주문</span>
            <span className="font-mono tabular-nums text-slate-200">{deptOrders.length ? `${deptOrders.length}건` : '스냅샷 기준'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">플랫폼 수수료</span>
            <Money value={-snap.platformFee} formula="플랫폼별 요율 × 주문금액 합산 (스마트스토어 3.5% · 쿠팡 6%)" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">프리랜서</span>
            <span className="font-mono tabular-nums text-slate-200">{freelancerCount}명</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">외주비 <span className="text-[10px] font-mono text-slate-600">BS0002 단가 스냅샷</span></span>
            <Money value={-snap.outsourcingCost} formula="배정 시점 스냅샷 단가 × 완료 건수 합산 (BS0002 · BS0008)" />
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-3 col-span-2">
            <span className="text-slate-200 font-semibold">손익 <span className="text-[10px] font-mono text-slate-600">BS0003 = 매출 − 수수료 − 외주비</span></span>
            <Money value={snap.profit} size="lg" locked={isConfirmed} formula={[
              { label: '매출 (순매출)', value: netSales },
              { label: '플랫폼 수수료', value: -snap.platformFee },
              { label: '외주비', value: -snap.outsourcingCost },
            ]} />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800/70 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
          금액 변경은 결재로 진행돼요 (MG1001)
          <button onClick={() => navigate('draft', { settlementId: s.id, type: 'SETTLEMENT_ADJUST' })} className="text-purple-300 hover:underline ml-1">조정 기안 작성 →</button>
        </div>
      </Card>

      {/* 재계산 diff 미리보기 */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h3 className="font-semibold text-sm">재계산 diff 미리보기 <span className="text-slate-500 font-normal">— 직전 확정 대비 변동 <b className="text-rose-300">{changedCount}</b>건</span></h3>
          <button onClick={() => { setRecalcedAt((m) => ({ ...m, [s.id]: `${TODAY} 11:52` })); window.toast('재계산 실행 — 직전 이력 대비 변동 없음 · 덮어쓰기 없이 이력으로만 적재 (BS0007)'); }}
            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1.5">
            <Icon name="calculator" className="w-3 h-3" />재계산
          </button>
        </div>
        {diffRows.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">이 기간에 재계산 이력이 없습니다 — 최초 집계 상태입니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2 font-medium">주문 번호</th>
                  <th className="px-3 py-2 font-medium">항목</th>
                  <th className="px-3 py-2 font-medium text-right">이전액</th>
                  <th className="px-3 py-2 font-medium text-right">재계산액</th>
                  <th className="px-3 py-2 font-medium text-right">차액</th>
                  <th className="px-5 py-2 font-medium">트리거</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((r, i) => (
                  <tr key={i} className={`border-b border-slate-800/60 ${r.delta < 0 ? 'bg-rose-500/[0.06]' : r.delta > 0 ? 'bg-emerald-500/[0.05]' : ''}`}>
                    <td className="px-5 py-2.5">
                      <button onClick={() => navigate('orders', { orderId: r.orderId })} className="font-mono text-xs text-slate-300 hover:text-purple-300 hover:underline">{r.orderId}</button>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{r.item}</td>
                    <td className="px-3 py-2.5 text-right"><Money value={r.before} className="text-slate-400" /></td>
                    <td className="px-3 py-2.5 text-right"><Money value={r.after} /></td>
                    <td className="px-3 py-2.5 text-right">
                      {r.delta === 0
                        ? <span className="font-mono text-xs text-slate-600">0</span>
                        : <span className={`font-mono tabular-nums text-sm ${r.delta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{r.delta < 0 ? '−' : '+'}₩{fmt(Math.abs(r.delta))}</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      {r.trigger
                        ? <button onClick={() => navigate('approvalDetail', { approvalId: r.trigger })} className="font-mono text-[11px] text-cyan-300 hover:underline">{r.trigger}</button>
                        : <span className="text-slate-600 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-2.5 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Icon name="history" className="w-3 h-3" />
          변동 행 하이라이트 — 재계산은 덮어쓰기 없이 이력으로만 적재됩니다 (BS0007)
        </div>
      </Card>

      {/* 확정 전 체크리스트 + 확정 (DRAFT 전용, IDEA-14) */}
      {!isConfirmed && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">확정 전 체크리스트</h3>
            <span className="text-[11px] text-slate-500">전 항목 충족 시에만 확정 버튼이 활성화됩니다 (IDEA-14)</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {checks.map((c) => (
              <div key={c.key}
                onClick={c.toggle}
                className={`rounded-lg border p-3 ${c.toggle ? 'cursor-pointer' : ''} ${c.ok ? 'bg-emerald-500/[0.07] border-emerald-500/30' : 'bg-slate-950/50 border-slate-700'}`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${c.ok ? 'text-emerald-200' : 'text-slate-300'}`}>
                  <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${c.ok ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                    {c.ok && <Icon name="check" className="w-3 h-3 text-white" />}
                  </span>
                  {c.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5 ml-6">{c.desc}</div>
                {c.action && (
                  <button onClick={(e) => { e.stopPropagation(); c.action.go(); }} className="ml-6 mt-1 text-[11px] text-purple-300 hover:underline">{c.action.label}</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Icon name="lock" className="w-3.5 h-3.5 text-slate-500" />
              확정 시 매출·외주비·손익 스냅샷이 저장되고 기간이 잠깁니다 (MG1003)
            </p>
            <button
              disabled={!allOk}
              onClick={() => setDlgOpen(true)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition ${
                allOk ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}>
              정산 확정
            </button>
          </div>
        </Card>
      )}

      {/* 확정 다이얼로그 — 중위험: 금액 총계 대조 카드 재표시 (§4.6) */}
      <ConfirmDialog
        open={dlgOpen} risk="mid"
        title={`${s.target} ${period} 정산 확정`}
        message="확정 후 이 기간의 금액은 직접 수정할 수 없으며 조정 결재로만 반영됩니다."
        summary={
          <div className="space-y-1.5">
            {[
              ['매출 (순매출)', netSales], ['플랫폼 수수료', -snap.platformFee],
              ['외주비', -snap.outsourcingCost], ['손익 스냅샷', snap.profit],
            ].map(([label, v], i) => (
              <div key={i} className={`flex items-center justify-between ${i === 3 ? 'border-t border-slate-800 pt-1.5 font-semibold' : ''}`}>
                <span className="text-slate-400 text-xs">{label}</span>
                <Money value={v} />
              </div>
            ))}
          </div>
        }
        confirmLabel="확정하고 잠그기"
        onConfirm={doConfirm}
        onClose={() => setDlgOpen(false)}
      />
    </div>
  );
}

window.SettlementConfirm = SettlementConfirm;
