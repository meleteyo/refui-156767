// payout.jsx — 26 지급 명세서 (route: payout)
// IDEA-07 수식 전개(금액 계보) / IDEA-12 단가 스냅샷 대조 / IDEA-14 잠금 / IDEA-05 저장된 뷰 / IDEA-06 행 훑기 패널
// 환불 소급 차감 마이너스 행 + 근거 결재 칩 (PO-2607-101 · APR-2026-00142)
const { useState, useMemo, useEffect } = React;

// 발송 상태는 data.js에 없어 로컬 보강 — PAID=발송완료, 그 외 미발송 초기값
const SEND_INIT = { 'PO-2606-105': true };

function Payout({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, Money, LockBadge, SidePanel, SavedViewChips, ConfirmDialog, Icon, fmt } = window;

  const [stmts, setStmts] = useState(() =>
    PAYOUT_STATEMENTS.map((p) => ({ ...p, sent: p.status === 'PAID' || !!SEND_INIT[p.id] }))
  );
  const [period, setPeriod] = useState(route?.payload?.period || '2026-07');
  const [frFilter, setFrFilter] = useState('ALL');
  const [sendFilter, setSendFilter] = useState('ALL');
  const [stFilter, setStFilter] = useState('ALL');
  const [viewId, setViewId] = useState(null);
  const [openId, setOpenId] = useState(route?.payload?.statementId || null);
  const [genDlg, setGenDlg] = useState(false);

  useEffect(() => {
    if (route?.payload?.statementId) {
      setOpenId(route.payload.statementId);
      const t = PAYOUT_STATEMENTS.find((p) => p.id === route.payload.statementId);
      if (t) setPeriod(t.period);
    }
    if (route?.payload?.period) setPeriod(route.payload.period);
  }, [route?.payload?.statementId, route?.payload?.period]);

  const frOf = (id) => FREELANCERS.find((f) => f.id === id);
  const dedOf = (p) => p.lines.filter((l) => l.type === 'DEDUCTION').reduce((a, l) => a + l.amount, 0);
  const workCountOf = (p) => p.lines.filter((l) => l.type === 'WORK').reduce((a, l) => a + l.qty, 0);

  // 저장된 뷰 (IDEA-05) — 모델 문서 3종 + 건수 배지
  const savedViews = useMemo(() => {
    const base = stmts.filter((p) => p.period === period);
    return [
      { id: 'unsent', name: '미발송', count: base.filter((p) => !p.sent).length },
      { id: 'confirmed', name: '이번 달 확정', count: base.filter((p) => p.status !== 'DRAFT').length },
      { id: 'deduct', name: '차감 있음', count: base.filter((p) => dedOf(p) < 0).length },
    ];
  }, [stmts, period]);

  const rows = useMemo(() => {
    let r = stmts.filter((p) => p.period === period);
    if (frFilter !== 'ALL') r = r.filter((p) => p.freelancerId === frFilter);
    if (sendFilter !== 'ALL') r = r.filter((p) => (sendFilter === 'SENT' ? p.sent : !p.sent));
    if (stFilter !== 'ALL') r = r.filter((p) => (stFilter === 'DRAFT' ? p.status === 'DRAFT' : p.status !== 'DRAFT'));
    if (viewId === 'unsent') r = r.filter((p) => !p.sent);
    if (viewId === 'confirmed') r = r.filter((p) => p.status !== 'DRAFT');
    if (viewId === 'deduct') r = r.filter((p) => dedOf(p) < 0);
    return r;
  }, [stmts, period, frFilter, sendFilter, stFilter, viewId]);

  const totalPayout = rows.reduce((a, p) => a + p.total, 0);
  const open = stmts.find((p) => p.id === openId) || null;

  // 키보드: 숫자키 1~3 뷰 전환 · 패널 열린 채 ↑↓ 행 이동 (IDEA-05 · IDEA-06)
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (['1', '2', '3'].includes(e.key)) setViewId(savedViews[Number(e.key) - 1]?.id || null);
      if (e.key === '0') setViewId(null);
      if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const idx = rows.findIndex((p) => p.id === open.id);
        const next = rows[idx + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) setOpenId(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, savedViews]);

  // 발송 완료 처리 (payout1005) — 감사 로그 기록 안내 릴레이 (IDEA-16 · MG1004)
  const markSent = (id) => {
    setStmts((list) => list.map((p) => (p.id === id ? { ...p, sent: true } : p)));
    window.toast(`${id} 발송 완료 기록 — 처리자·일시 감사 로그 저장 (MG1004)`, {
      actionLabel: '변경 이력 보기 →', onAction: () => navigate('auditLog'),
    });
  };

  // TSV 복사 (IDEA-02 엑셀 그리드 모드 축약)
  const copyTsv = (p) => {
    const tsv = [['작업명', '단가(스냅샷)', '수량', '금액'].join('\t')]
      .concat(p.lines.map((l) => [l.label, l.rate, l.qty, l.amount].join('\t')))
      .concat([['합계', '', '', p.total].join('\t')]).join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(tsv);
    window.toast('계산 내역을 TSV로 복사했어요 — 엑셀에 그대로 붙여넣기 가능 (IDEA-02)');
  };

  // 단가 스냅샷 대조 (BS0008) — 현재 마스터와 다른 라인 + 진행 중 단가변경 결재
  const snapshotDiffOf = (p) => {
    const master = frOf(p.freelancerId);
    return p.lines.filter((l) => l.type === 'WORK' && master && l.rate !== master.rate);
  };
  const pendingRateChange = (fid) =>
    APPROVALS.find((a) => a.type === 'RATE_CHANGE' && a.freelancerId === fid && a.status === 'IN_PROGRESS');

  // 재계산 이력 (BS0007) — 차감 행 근거 결재로 유도
  const recalcOf = (p) => p.lines.filter((l) => l.type === 'DEDUCTION' && l.approvalId).map((l) => ({
    at: APPROVALS.find((a) => a.id === l.approvalId)?.decidedAt || '—',
    before: p.total - l.amount, after: p.total, delta: l.amount, trigger: l.approvalId,
  }));

  const SendPill = ({ sent }) => (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
      sent ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${sent ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
      {sent ? '발송완료' : '미발송'}
    </span>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        label="FINANCE · PAYOUT" labelColor="emerald"
        title="지급 명세서"
        desc="스냅샷 단가 × 수량 − 환불 소급 차감 — 모든 지급액이 수식으로 전개됩니다 (BS0002 · IDEA-07)"
        actions={
          <button onClick={() => setGenDlg(true)}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 inline-flex items-center gap-1.5">
            <Icon name="plus" className="w-3.5 h-3.5" />명세서 생성
          </button>
        }
      />

      {/* 필터 + 저장된 뷰 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-xs text-slate-400">지급 기간 <span className="text-rose-400">*</span></label>
          <select value={period} onChange={(e) => { setPeriod(e.target.value); setOpenId(null); }}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm font-mono focus:border-emerald-500/60 outline-none">
            <option value="2026-07">2026년 07월</option>
            <option value="2026-06">2026년 06월</option>
          </select>
          <label className="text-xs text-slate-400 ml-1">프리랜서</label>
          <select value={frFilter} onChange={(e) => setFrFilter(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm focus:border-emerald-500/60 outline-none">
            <option value="ALL">전체</option>
            {FREELANCERS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <label className="text-xs text-slate-400 ml-1">발송 상태</label>
          <select value={sendFilter} onChange={(e) => setSendFilter(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm focus:border-emerald-500/60 outline-none">
            <option value="ALL">전체</option><option value="UNSENT">미발송</option><option value="SENT">발송완료</option>
          </select>
          <label className="text-xs text-slate-400 ml-1">정산 상태</label>
          <select value={stFilter} onChange={(e) => setStFilter(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-sm focus:border-emerald-500/60 outline-none">
            <option value="ALL">전체</option><option value="DRAFT">초안</option><option value="CONFIRMED">확정</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <SavedViewChips views={savedViews} activeId={viewId} onSelect={setViewId} allLabel="전체" />
          <button onClick={() => window.toast('현재 조건을 뷰로 저장했어요 — 사이드바 서브 항목에 등록됩니다 (IDEA-05)')}
            className="shrink-0 text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1">
            <Icon name="plus" className="w-3 h-3" />현재 조건 저장
          </button>
        </div>
      </Card>

      {/* 명세서 목록 */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h3 className="font-semibold text-sm">
            명세서 목록 <span className="text-slate-500 font-normal">— 전체 {rows.length}건 · 지급 예정 합계</span>
            <span className="ml-2"><Money value={totalPayout} size="md" /></span>
            <span title={`합산 검산 통과 · 집계 기준 ${AGGREGATED_AT} · 라인 ${rows.reduce((a, p) => a + p.lines.length, 0)}건`}
              className="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-300 cursor-help align-middle">
              <Icon name="check" className="w-3 h-3" />검산
            </span>
          </h3>
          <span className="text-[11px] text-slate-500">행 클릭 → 우측 패널 · ↑↓ 행 이동 · Esc 닫기 (IDEA-06)</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-8">
            <window.EmptyState icon="wallet" title="조건에 맞는 명세서가 없어요"
              description="정산 확정 후 [명세서 생성]으로 기간 명세서를 만들 수 있어요."
              actionLabel="정산 확정으로 →" onAction={() => navigate('settlement')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2 font-medium">명세서 번호</th>
                  <th className="px-3 py-2 font-medium">프리랜서</th>
                  <th className="px-3 py-2 font-medium text-right">작업수</th>
                  <th className="px-3 py-2 font-medium text-right">지급액</th>
                  <th className="px-3 py-2 font-medium text-right">차감</th>
                  <th className="px-3 py-2 font-medium">정산</th>
                  <th className="px-5 py-2 font-medium">발송</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const f = frOf(p.freelancerId);
                  const ded = dedOf(p);
                  return (
                    <tr key={p.id} onClick={() => setOpenId(p.id)}
                      className={`border-b border-slate-800/60 cursor-pointer transition hover:bg-slate-800/30 ${openId === p.id ? 'bg-emerald-500/[0.07]' : ''}`}>
                      <td className="px-5 py-3 font-mono text-xs text-slate-400">{p.id}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs font-medium">{f?.name}</div>
                        <div className="text-[11px] text-slate-500">{f?.specialty}</div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-xs">{workCountOf(p)}건</td>
                      <td className="px-3 py-3 text-right">
                        <Money value={p.total} formula={p.lines.map((l) => ({ label: l.label, value: l.amount, ref: l.approvalId || undefined }))} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        {ded < 0 ? <Money value={ded} /> : <span className="font-mono text-xs text-slate-600">0</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <EnumPill status={p.status} />
                          {p.status !== 'DRAFT' && <Icon name="lock" className="w-3 h-3 text-emerald-400" />}
                        </span>
                      </td>
                      <td className="px-5 py-3"><SendPill sent={p.sent} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-2.5 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
          확정 기간 명세서는 재생성·수정 불가 — 소급 변경은 조정 이벤트로만 적재됩니다 (MG1003)
        </div>
      </Card>

      {/* 상세 사이드 패널 (IDEA-06) */}
      {open && (() => {
        const f = frOf(open.freelancerId);
        const master = f;
        const diffs = snapshotDiffOf(open);
        const rate$ = pendingRateChange(open.freelancerId);
        const recalcs = recalcOf(open);
        const locked = open.status !== 'DRAFT';
        return (
          <SidePanel open onClose={() => setOpenId(null)} width={520}
            title={`${open.id} · ${f?.name}`}
            subtitle={`${open.period} 지급 명세서 · ${f?.specialty}`}
            footer={
              <div className="flex items-center gap-2">
                <button onClick={() => window.toast(`${open.id}.pdf 다운로드 준비 완료 (payout1003)`)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center justify-center gap-1.5">
                  <Icon name="download" className="w-3.5 h-3.5" />PDF
                </button>
                <button onClick={() => copyTsv(open)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 inline-flex items-center justify-center gap-1.5">
                  <Icon name="copy" className="w-3.5 h-3.5" />엑셀(TSV)
                </button>
                <button disabled={open.sent} onClick={() => markSent(open.id)}
                  title={open.sent ? '이미 발송 완료 처리됨 — 처리자 정다은 · 07-05' : ''}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 ${
                    open.sent ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'}`}>
                  <Icon name="mail" className="w-3.5 h-3.5" />{open.sent ? '발송 완료됨' : '발송 완료 처리'}
                </button>
              </div>
            }>
            <div className="space-y-5">
              {/* 헤더 메타 */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">지급 기간</span><span className="font-mono">{open.period}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">발송 상태</span><SendPill sent={open.sent} /></div>
                <div className="flex justify-between items-center"><span className="text-slate-500">정산 상태</span>
                  <span className="inline-flex items-center gap-1.5">
                    <EnumPill status={open.status} />
                    {locked && <LockBadge date={open.status === 'PAID' ? '2026-07-05' : '2026-07-09'} reason="확정 기간 — 재생성·수정 불가" />}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-500">계좌 (마스킹)</span><span className="font-mono text-slate-300">{f?.account}</span></div>
              </div>
              {locked && (
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                  <span>수정은 조정 결재로만 가능합니다 (MG1003)</span>
                  <button onClick={() => navigate('draft', { settlementId: 'SET-2607-01', type: 'SETTLEMENT_ADJUST' })} className="text-purple-300 hover:underline shrink-0">조정 기안 작성 →</button>
                </div>
              )}

              {/* 자동 계산 내역 */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2">자동 계산 내역 — 배정 시점 스냅샷 단가 × 수량 (BS0002)</div>
                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800 bg-slate-950/50">
                        <th className="px-3 py-1.5 font-medium">작업명</th>
                        <th className="px-2 py-1.5 font-medium text-right">단가(스냅샷)</th>
                        <th className="px-2 py-1.5 font-medium text-right">수량</th>
                        <th className="px-3 py-1.5 font-medium text-right">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {open.lines.map((l) => (
                        <tr key={l.id} className={`border-b border-slate-800/60 ${l.type === 'DEDUCTION' ? 'bg-rose-500/[0.07]' : ''}`}>
                          <td className="px-3 py-2">
                            <div className={l.type === 'DEDUCTION' ? 'text-rose-200' : 'text-slate-300'}>
                              {l.type === 'DEDUCTION' && <span className="font-mono mr-1">(−)</span>}{l.label}
                            </div>
                            {l.approvalId && (
                              <button onClick={() => navigate('approvalDetail', { approvalId: l.approvalId })}
                                className="mt-0.5 font-mono text-[10px] text-cyan-300 hover:underline">근거 {l.approvalId} →</button>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400">₩{fmt(l.rate)}</td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400">{l.qty}</td>
                          <td className="px-3 py-2 text-right"><Money value={l.amount} /></td>
                        </tr>
                      ))}
                      <tr className="bg-slate-950/60">
                        <td colSpan={3} className="px-3 py-2 text-slate-300 font-medium">지급액 합계</td>
                        <td className="px-3 py-2 text-right">
                          <Money value={open.total} size="md"
                            formula={open.lines.map((l) => ({ label: l.type === 'DEDUCTION' ? '환불 소급 차감' : l.label, value: l.amount, ref: l.approvalId || undefined }))} />
                          <span title={`합산 검산 통과 · 집계 기준 ${AGGREGATED_AT}`} className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-emerald-300 cursor-help">
                            <Icon name="check" className="w-3 h-3" />검산
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 단가 스냅샷 대조 (IDEA-12 · BS0008) */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2">단가 스냅샷 대조 (BS0008)</div>
                {diffs.length === 0 ? (
                  <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Icon name="check" className="w-3 h-3 text-emerald-400" />
                    모든 라인의 스냅샷 단가가 현재 마스터 단가(₩{fmt(master?.rate || 0)})와 일치합니다
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {diffs.map((l) => (
                      <div key={l.id} className="rounded-lg bg-amber-500/[0.07] border border-amber-500/30 p-3 text-[11px] text-amber-200">
                        {l.label} — 스냅샷 ₩{fmt(l.rate)} / 현재 마스터 ₩{fmt(master.rate)}
                      </div>
                    ))}
                  </div>
                )}
                {rate$ && (
                  <div className="mt-1.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/30 p-3 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                    <span>단가변경 결재 진행 중 — 승인돼도 기존 배정 스냅샷은 유지됩니다</span>
                    <button onClick={() => navigate('approvalDetail', { approvalId: rate$.id })} className="font-mono text-cyan-300 hover:underline shrink-0">{rate$.id}</button>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 mt-1.5">배정 시점 단가로 지급됩니다. 마스터 변경은 이후 신규 배정에만 적용돼요 (BS0008)</p>
              </div>

              {/* 재계산 이력 (BS0007) */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-2">재계산 이력 (BS0007)</div>
                {recalcs.length === 0 ? (
                  <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-[11px] text-slate-500">재계산 이력 없음 — 최초 계산 상태를 유지 중입니다</div>
                ) : recalcs.map((r, i) => (
                  <div key={i} className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 mb-1.5">
                      <span>{r.at}</span>
                      <button onClick={() => navigate('approvalDetail', { approvalId: r.trigger })} className="text-cyan-300 hover:underline">트리거 {r.trigger}</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-[10px] text-slate-500">이전액</div><Money value={r.before} className="text-slate-400" /></div>
                      <div><div className="text-[10px] text-slate-500">재계산액</div><Money value={r.after} /></div>
                      <div><div className="text-[10px] text-slate-500">차액</div><Money value={r.delta} /></div>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-500 mt-1.5">재계산은 덮어쓰기 없이 이력으로만 적재됩니다 (BS0007)</p>
              </div>
            </div>
          </SidePanel>
        );
      })()}

      {/* 명세서 생성 — 재생성 확인 (payout1001, 중위험) */}
      <ConfirmDialog
        open={genDlg} risk="mid"
        title={`${period} 명세서 생성`}
        message="동일 기간 명세서가 이미 존재합니다. 재생성 시 정산 재계산(703)을 실행하고 근거 이력을 저장합니다 (BS0007)."
        summary={
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">대상 프리랜서</span><span className="font-mono">{new Set(stmts.filter((p) => p.period === period).map((p) => p.freelancerId)).size}명</span></div>
            <div className="flex justify-between"><span className="text-slate-400">기존 명세서</span><span className="font-mono">{stmts.filter((p) => p.period === period).length}건</span></div>
            <div className="flex justify-between font-semibold border-t border-slate-800 pt-1"><span className="text-slate-300">지급 예정 합계</span><Money value={stmts.filter((p) => p.period === period).reduce((a, p) => a + p.total, 0)} /></div>
          </div>
        }
        confirmLabel="재생성 실행"
        onConfirm={() => {
          setGenDlg(false);
          window.toast(`${period} 명세서 재계산 완료 — 변동 없음 · 근거 이력 적재 (BS0007)`, {
            actionLabel: '정산 확정으로 →', onAction: () => navigate('settlement'),
          });
        }}
        onClose={() => setGenDlg(false)}
      />
    </div>
  );
}

window.Payout = Payout;
