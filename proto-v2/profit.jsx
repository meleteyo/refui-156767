// profit.jsx — 28 손익 대시보드 (route: profit)
// IDEA-07 금액 계보(수식 팝오버·검산 배지·부서→프로젝트→주문 3단 드릴다운) / IDEA-05 저장된 뷰
// BS0003: 손익 = 순매출(결제+재결제−환불, BS0001) − 플랫폼 수수료 − 외주비 (읽기 전용 — P1)
const { useState, useMemo, useEffect } = React;

function Profit({ route, navigate, tweaks }) {
  const { Card, PageHeader, Money, Icon, fmt } = window;

  const [period, setPeriod] = useState('2026-07');
  const [groupBy, setGroupBy] = useState('DEPT');           // DEPT | PROJECT
  const [openDepts, setOpenDepts] = useState({ 'DEPT-1': true });
  const [openProjects, setOpenProjects] = useState({ 'PRJ-02': true });
  const [refundOpen, setRefundOpen] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [aggAt, setAggAt] = useState(AGGREGATED_AT + ':07');

  // 30초 폴링 — "실시간"의 정직함 (§6.1-4): 주기·기준 시각 상시 표기
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setAggAt((a) => {
            const [d, hms] = a.split(' ');
            const [h, m, s] = hms.split(':').map(Number);
            const nd = new Date(2026, 6, 10, h, m, s + 30);
            return `${d} ${String(nd.getHours()).padStart(2, '0')}:${String(nd.getMinutes()).padStart(2, '0')}:${String(nd.getSeconds()).padStart(2, '0')}`;
          });
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── 이벤트 원장 합산 (BS0001) — 2026-07 은 SALES_EVENTS 원장, 2026-06 은 정산 스냅샷 ──
  const isJuly = period === '2026-07';
  const evOf = (oid, types) => SALES_EVENTS
    .filter((e) => e.orderId === oid && (!types || types.includes(e.type)))
    .reduce((a, e) => a + e.amount, 0);
  const orderRow = (o) => {
    const net = evOf(o.id);
    const refund = evOf(o.id, ['PARTIAL_REFUND', 'FULL_REFUND']);
    const profit = net - o.fee - o.outsourcingCost;
    return { ...o, net, refund, profit };
  };
  const sumRows = (rows) => rows.reduce((a, r) => ({
    net: a.net + r.net, refund: a.refund + r.refund,
    out: a.out + (r.outsourcingCost != null ? r.outsourcingCost : r.out), fee: a.fee + (r.fee || 0),
    profit: a.profit + r.profit,
  }), { net: 0, refund: 0, out: 0, fee: 0, profit: 0 });

  // 트리 구성: 부서(또는 프로젝트) → 프로젝트 → 주문
  const tree = useMemo(() => {
    if (!isJuly) {
      return SETTLEMENTS.filter((s) => s.period === period).map((s) => ({
        id: s.deptId, name: s.target, snapshotOnly: true,
        net: s.snapshot.orderAmount - s.snapshot.refundAmount + s.snapshot.repaymentAmount,
        refund: -s.snapshot.refundAmount, fee: s.snapshot.platformFee, out: s.snapshot.outsourcingCost,
        profit: s.snapshot.profit, children: [],
      }));
    }
    const orders = ORDERS.map(orderRow);
    if (groupBy === 'PROJECT') {
      return PROJECTS.map((p) => {
        const os = orders.filter((o) => o.projectId === p.id);
        if (os.length === 0) return null;
        const t = sumRows(os);
        return { id: p.id, name: p.name, ...t, children: [{ id: p.id + '_flat', name: null, orders: os }] };
      }).filter(Boolean);
    }
    return DEPARTMENTS.map((d) => {
      const os = orders.filter((o) => o.deptId === d.id);
      if (os.length === 0) return null;
      const projs = PROJECTS.filter((p) => os.some((o) => o.projectId === p.id)).map((p) => {
        const pos = os.filter((o) => o.projectId === p.id);
        return { id: p.id, name: p.name, ...sumRows(pos), orders: pos };
      });
      return { id: d.id, name: d.name, ...sumRows(os), children: projs };
    }).filter(Boolean);
  }, [period, groupBy]);

  const total = sumRows(tree);

  // 폭포 구성 (BS0003) — 7월은 이벤트 원장, 6월은 스냅샷 합산
  const wf = useMemo(() => {
    if (isJuly) {
      const pay = SALES_EVENTS.filter((e) => e.type === 'PAYMENT').reduce((a, e) => a + e.amount, 0);
      const repay = SALES_EVENTS.filter((e) => e.type === 'REPAYMENT').reduce((a, e) => a + e.amount, 0);
      const refund = SALES_EVENTS.filter((e) => e.type === 'PARTIAL_REFUND' || e.type === 'FULL_REFUND').reduce((a, e) => a + e.amount, 0);
      return { pay, repay, refund, net: pay + repay + refund, fee: total.fee, out: total.out, profit: total.profit };
    }
    const ss = SETTLEMENTS.filter((s) => s.period === period);
    const pay = ss.reduce((a, s) => a + s.snapshot.orderAmount, 0);
    const repay = ss.reduce((a, s) => a + s.snapshot.repaymentAmount, 0);
    const refund = -ss.reduce((a, s) => a + s.snapshot.refundAmount, 0);
    return { pay, repay, refund, net: pay + repay + refund, fee: total.fee, out: total.out, profit: total.profit };
  }, [period, total]);

  const checksumOk = wf.net - wf.fee - wf.out === wf.profit;
  const refundEvents = SALES_EVENTS.filter((e) => (e.type === 'PARTIAL_REFUND' || e.type === 'FULL_REFUND') && e.occurredAt.startsWith(period));
  const evCount = isJuly ? SALES_EVENTS.length : 0;

  // 마지막 재계산 — 전 정산 recalcHistory 중 최신 (BS0007)
  const lastRecalc = useMemo(() => {
    const all = SETTLEMENTS.flatMap((s) => s.recalcHistory.map((h) => ({ ...h, target: s.target })));
    return all.sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  }, []);

  const CheckBadge = ({ ok = true, count }) => (
    <span title={ok ? `합산 검산 통과 · 집계 기준 ${aggAt} · 대상 이벤트 ${count != null ? count : evCount}건` : '검산 불일치 — 관리자 재검산 필요'}
      className={`inline-flex items-center gap-0.5 text-[10px] cursor-help ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
      <Icon name={ok ? 'check' : 'alert'} className="w-3 h-3" />
    </span>
  );

  const cardMeta = [
    { label: '매출 (순매출)', value: wf.net, formula: [{ label: '결제 합계', value: wf.pay }, { label: '재결제', value: wf.repay }, { label: '환불', value: wf.refund }] },
    { label: '환불', value: wf.refund, onClick: () => setRefundOpen((v) => !v), hint: '클릭 → 환불 이벤트 목록' },
    { label: '수수료', value: -wf.fee, formula: '플랫폼별 요율 분해 — 스마트스토어 3.5% · 쿠팡 6% (주문별 fee 합산)' },
    { label: '외주비', value: -wf.out, formula: '스냅샷 단가 × 완료 건수 합산 (BS0002 · BS0008)' },
    { label: '손익', value: wf.profit, formula: [{ label: '순매출', value: wf.net }, { label: '플랫폼 수수료', value: -wf.fee }, { label: '외주비', value: -wf.out }], em: true },
  ];

  const wfRows = [
    { label: '결제 합계 (+)', v: wf.pay, run: wf.pay, basis: `BS0001 이벤트 ${SALES_EVENTS.filter((e) => e.type === 'PAYMENT').length}건` },
    { label: '재결제 (+)', v: wf.repay, run: wf.pay + wf.repay, basis: 'BS0001 이벤트' },
    { label: '환불 (−)', v: wf.refund, run: wf.net, basis: `BS0001 이벤트 ${refundEvents.length}건` },
    { label: '= 매출 (순매출)', v: wf.net, run: null, basis: 'BS0001 합산', sub: true },
    { label: '플랫폼 수수료 (−)', v: -wf.fee, run: wf.net - wf.fee, basis: '플랫폼 요율' },
    { label: '외주비 (−)', v: -wf.out, run: wf.profit, basis: 'BS0002 스냅샷' },
    { label: '= 손익', v: wf.profit, run: null, basis: 'BS0003', final: true },
  ];

  const numTd = (v, formula) => (
    <td className="px-3 py-2.5 text-right whitespace-nowrap">
      {v === 0 ? <span className="font-mono text-xs text-slate-600">0</span> : <Money value={v} formula={formula} />}
    </td>
  );

  return (
    <div className="max-w-6xl">
      <PageHeader
        label="OVERVIEW · PROFIT" labelColor="purple"
        title="손익 대시보드"
        desc="손익 = 순매출(결제+재결제−환불) − 플랫폼 수수료 − 외주비 (BS0003 직접비 산식 · 간접비 배부 없음 · 읽기 전용)"
        actions={
          <div className="text-right">
            <div className="text-[11px] font-mono text-slate-400">집계 기준 {aggAt.slice(11)} · <span className="text-emerald-300">30초 자동 갱신 ✓</span> <span className="text-slate-600">({countdown}s)</span></div>
            {lastRecalc && (
              <div className="text-[11px] text-slate-500 mt-0.5">
                마지막 재계산 {lastRecalc.at} · 트리거{' '}
                <button onClick={() => navigate('approvalDetail', { approvalId: lastRecalc.approvalId })}
                  className="font-mono text-cyan-300 hover:underline">{lastRecalc.approvalId}</button>
                <span className="text-slate-600"> (환불 승인 즉시 반영)</span>
              </div>
            )}
          </div>
        }
      />

      {/* 필터 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="text-xs text-slate-400">기간 <span className="text-rose-400">*</span></label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm font-mono focus:border-purple-500/60 outline-none">
            <option value="2026-07">이번 달 (2026년 07월)</option>
            <option value="2026-06">지난 달 (2026년 06월)</option>
          </select>
          <span className="font-mono text-xs text-slate-500">{period}-01 ~ {period === '2026-07' ? '2026-07-31' : '2026-06-30'}</span>
          <span className="text-xs text-slate-400 ml-2">Group By</span>
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-950 border border-slate-700">
            {[['DEPT', '부서'], ['PROJECT', '프로젝트']].map(([k, l]) => (
              <button key={k} onClick={() => setGroupBy(k)} disabled={!isJuly && k === 'PROJECT'}
                className={`px-3 py-1 rounded text-xs font-medium ${groupBy === k ? 'bg-purple-500/25 text-purple-200' : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">저장된 뷰</span>
            <select className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs focus:border-purple-500/60 outline-none"
              onChange={() => window.toast('저장된 뷰 적용 — 필터 상태가 1클릭 재진입됩니다 (IDEA-05)')}>
              <option>월간 부서 손익</option>
              <option>분기 프로젝트 손익</option>
            </select>
          </div>
        </div>
      </Card>

      {/* 요약 5카드 */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {cardMeta.map((c, i) => (
          <Card key={i} onClick={c.onClick}
            className={`p-4 ${c.onClick ? 'cursor-pointer hover:border-rose-500/40 transition' : ''} ${c.em ? '!border-purple-500/40 bg-gradient-to-b from-purple-500/[0.08] to-transparent' : ''}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[11px] ${c.em ? 'text-purple-300 font-medium' : 'text-slate-400'}`}>{c.label}</span>
              <CheckBadge />
            </div>
            <Money value={c.value} size="md" formula={c.formula || null} />
            {c.hint && <div className="text-[10px] text-slate-600 mt-1">{c.hint}</div>}
          </Card>
        ))}
      </div>

      {/* 환불 이벤트 전개 (환불 카드 클릭) */}
      {refundOpen && (
        <Card className="mb-4 overflow-hidden !border-rose-500/30">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-rose-200">기간 내 환불 이벤트 {refundEvents.length}건</h3>
            <button onClick={() => setRefundOpen(false)} className="p-1 rounded text-slate-400 hover:bg-slate-800"><Icon name="x" className="w-3.5 h-3.5" /></button>
          </div>
          <div className="divide-y divide-slate-800/60">
            {refundEvents.map((e) => {
              const o = ORDERS.find((x) => x.id === e.orderId);
              return (
                <div key={e.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                  <span className="font-mono text-[10px] text-slate-500 w-28 shrink-0">{e.occurredAt}</span>
                  <window.EnumPill status={e.type} />
                  <button onClick={() => navigate('orders', { orderId: e.orderId })} className="text-slate-300 hover:text-purple-300 hover:underline truncate">
                    {o?.clientName} · {o?.item}
                  </button>
                  <span className="ml-auto"><Money value={e.amount} /></span>
                  {e.approvalId && (
                    <button onClick={() => navigate('approvalDetail', { approvalId: e.approvalId })}
                      className="font-mono text-[10px] text-cyan-300 hover:underline shrink-0">{e.approvalId}</button>
                  )}
                </div>
              );
            })}
            {refundEvents.length === 0 && <div className="px-5 py-4 text-xs text-slate-500">이 기간 환불 이벤트가 없습니다</div>}
          </div>
        </Card>
      )}

      {/* 손익 구성 폭포 (BS0003) */}
      <Card className="mb-4 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-sm">손익 구성 폭포 — BS0003: 손익 = 매출 − 플랫폼 수수료 − 외주비</h3>
          <CheckBadge ok={checksumOk} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-5 py-2 font-medium">구성 항목</th>
                <th className="px-3 py-2 font-medium text-right">금액</th>
                <th className="px-3 py-2 font-medium text-right">누계</th>
                <th className="px-5 py-2 font-medium">근거</th>
              </tr>
            </thead>
            <tbody>
              {wfRows.map((r, i) => (
                <tr key={i} className={`border-b border-slate-800/60 ${r.final ? 'bg-purple-500/[0.08]' : r.sub ? 'bg-slate-800/40' : ''}`}>
                  <td className={`px-5 py-2.5 text-xs ${r.sub || r.final ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>{r.label}</td>
                  <td className="px-3 py-2.5 text-right"><Money value={r.v} size={r.final ? 'md' : 'sm'} /></td>
                  <td className="px-3 py-2.5 text-right">{r.run != null ? <Money value={r.run} className="opacity-60" /> : <span className="text-slate-700">—</span>}</td>
                  <td className="px-5 py-2.5 text-[11px] font-mono text-slate-500">{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-500">
          환불은 순매출에 기반영 — 이중 차감이 아닙니다. 매출 열은 순매출(BS0001), 환불 열은 참고 표기입니다.
        </div>
      </Card>

      {/* 드릴다운 표 — 부서→프로젝트→주문 3클릭 추적 (IDEA-07) */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-sm">{groupBy === 'DEPT' ? '부서별' : '프로젝트별'} 손익 — ▸ 클릭 시 {groupBy === 'DEPT' ? '부서 → 프로젝트 → 주문' : '프로젝트 → 주문'} 드릴다운</h3>
          <button onClick={() => window.toast(`profit_${period.replace('-', '')}.xlsx 다운로드 준비 완료 — 현재 드릴다운 상태 기준`, {
            actionLabel: '정산 확정으로 →', onAction: () => navigate('settlement'),
          })} className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1.5">
            <Icon name="download" className="w-3 h-3" />엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-5 py-2 font-medium">부서 / 프로젝트 / 주문</th>
                <th className="px-3 py-2 font-medium text-right">매출</th>
                <th className="px-3 py-2 font-medium text-right">환불</th>
                <th className="px-3 py-2 font-medium text-right">외주비</th>
                <th className="px-5 py-2 font-medium text-right">손익</th>
              </tr>
            </thead>
            <tbody>
              {tree.map((d) => (
                <React.Fragment key={d.id}>
                  <tr onClick={() => !d.snapshotOnly && setOpenDepts((m) => ({ ...m, [d.id]: !m[d.id] }))}
                    className={`border-b border-slate-800/60 ${d.snapshotOnly ? '' : 'cursor-pointer hover:bg-slate-800/30'} ${openDepts[d.id] ? 'bg-slate-800/20' : ''}`}>
                    <td className="px-5 py-2.5 font-medium text-slate-200 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {!d.snapshotOnly && <Icon name={openDepts[d.id] ? 'chevronDown' : 'chevronRight'} className="w-3.5 h-3.5 text-slate-500" />}
                        {d.name}
                      </span>
                    </td>
                    {numTd(d.net)}{numTd(d.refund)}{numTd(-d.out)}
                    <td className="px-5 py-2.5 text-right whitespace-nowrap">
                      <Money value={d.profit} formula={[
                        { label: '순매출', value: d.net },
                        { label: '플랫폼 수수료', value: -d.fee },
                        { label: '외주비', value: -d.out },
                      ]} />
                    </td>
                  </tr>
                  {openDepts[d.id] && d.children.map((p) => (
                    <React.Fragment key={p.id}>
                      {p.name && (
                        <tr onClick={() => setOpenProjects((m) => ({ ...m, [p.id]: !m[p.id] }))}
                          className="border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/30">
                          <td className="px-5 py-2 pl-10 text-xs text-slate-300 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Icon name={openProjects[p.id] ? 'chevronDown' : 'chevronRight'} className="w-3 h-3 text-slate-500" />
                              {p.name}
                            </span>
                          </td>
                          {numTd(p.net)}{numTd(p.refund)}{numTd(-p.out)}
                          <td className="px-5 py-2 text-right whitespace-nowrap">
                            <Money value={p.profit} formula={[
                              { label: '순매출', value: p.net },
                              { label: '플랫폼 수수료', value: -p.fee },
                              { label: '외주비', value: -p.out },
                            ]} />
                          </td>
                        </tr>
                      )}
                      {(p.name ? openProjects[p.id] : true) && p.orders.map((o) => (
                        <tr key={o.id} onClick={() => navigate('orders', { orderId: o.id })}
                          className="border-b border-slate-800/40 cursor-pointer hover:bg-purple-500/[0.06] group">
                          <td className={`px-5 py-2 text-xs whitespace-nowrap ${p.name ? 'pl-16' : 'pl-10'}`}>
                            <span className="font-mono text-slate-500 group-hover:text-purple-300">{o.id}</span>
                            <span className="text-slate-400 ml-2">{o.item}</span>
                          </td>
                          {numTd(o.net, [{ label: '결제 · 이벤트 합산', value: o.net - o.refund }, { label: '환불', value: o.refund }])}
                          {numTd(o.refund)}{numTd(-o.outsourcingCost)}
                          <td className="px-5 py-2 text-right whitespace-nowrap">
                            <Money value={o.profit} formula={[
                              { label: '순매출', value: o.net },
                              { label: '플랫폼 수수료', value: -o.fee },
                              { label: '외주비', value: -o.outsourcingCost },
                            ]} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-slate-900 border-t-2 border-slate-700">
                <td className="px-5 py-3 font-semibold text-slate-200">
                  합계 <CheckBadge ok={checksumOk} />
                </td>
                <td className="px-3 py-3 text-right"><Money value={total.net} size="md" /></td>
                <td className="px-3 py-3 text-right"><Money value={total.refund} /></td>
                <td className="px-3 py-3 text-right"><Money value={-total.out} /></td>
                <td className="px-5 py-3 text-right"><Money value={total.profit} size="md" formula={[
                  { label: '순매출', value: total.net },
                  { label: '플랫폼 수수료', value: -total.fee },
                  { label: '외주비', value: -total.out },
                ]} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-5 py-2.5 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Icon name="info" className="w-3 h-3" />
          {isJuly
            ? '주문 행 클릭 → 주문 상세(이벤트 타임라인) 딥링크 — 대시보드 숫자→주문→이벤트→결재 3클릭 추적 (P2). 표에 수수료 열은 없지만 손익 팝오버에 수수료 항을 전개해 표시 숫자만으로 검산됩니다.'
            : '2026-06은 확정 정산 스냅샷 기준 부서 요약만 표시됩니다 — 주문 원장 드릴다운은 당월(2026-07) 데이터에서 확인하세요.'}
        </div>
      </Card>
    </div>
  );
}

window.Profit = Profit;
