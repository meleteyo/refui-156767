// home.jsx — 공통-1 홈 대시보드 (역할별 오늘의 조치 큐 · IDEA-04 주 / 03 · 16 · 17 · 18)
// KPI 나열이 아니라 "처리하면 사라지는 조치 큐"로 시작하는 홈. 홈 자체는 순수 조회 화면 —
// 모든 버튼은 컨텍스트 payload를 실은 딥링크(P4). 완료 표시는 데모용 슬라이드 아웃 시뮬레이션.
const { useState, useEffect, useMemo, useRef } = React;

function Home({ route, navigate, tweaks }) {
  const { Card, SectionLabel, EnumPill, Money, Icon, DdayBadge, Sparkline, fmt, ddayOf, toast } = window;

  const me = EMPLOYEES.find((e) => e.id === CURRENT_USER_ID) || EMPLOYEES[0];
  const perm = ROLE_MATRIX[me.role] || {};
  const queueRef = useRef(null);

  // ── 폴링 30초 시뮬레이션 (BS0011 — "실시간"의 정직함 §6.1) ──────────────
  const [countdown, setCountdown] = useState(30);
  const [polledAt, setPolledAt] = useState(AGGREGATED_AT.slice(11));
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setPolledAt(new Date().toTimeString().slice(0, 5)); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── 요약 타일 3종 데이터 파생 ────────────────────────────────────────────
  const myTurnApprovals = useMemo(() => APPROVALS.filter((a) => {
    if (a.status !== 'IN_PROGRESS') return false;
    const cur = a.approvalLine.find((s) => s.status === 'PENDING');
    return cur && cur.approverId === CURRENT_USER_ID;
  }), []);
  const delayedApprovals = myTurnApprovals.filter((a) => ddayOf(a.createdAt.slice(0, 10)) <= -2);
  const dueSoonTasks = useMemo(() => TASKS.filter((t) =>
    ['WAITING', 'IN_PROGRESS', 'REVIEW'].includes(t.status) && ddayOf(t.dueDate) <= 2), []);
  const overdueTasks = dueSoonTasks.filter((t) => ddayOf(t.dueDate) < 0);
  const myErrorBatches = useMemo(() => IMPORT_BATCHES.filter((b) => b.uploadedById === CURRENT_USER_ID && b.errorRows > 0), []);
  const errorRowCount = myErrorBatches.reduce((s, b) => s + b.errorRows, 0);

  // ── 오늘의 조치 큐 — 역할별 고정 프리셋 (MG1005 · IDEA-04) ───────────────
  const initialQueue = useMemo(() => {
    const q = [];
    // 결재 대기 (내 차례) — 전 역할 공통
    myTurnApprovals.forEach((a) => {
      const o = ORDERS.find((x) => x.id === a.orderId);
      q.push({
        id: a.id, kind: 'APPROVAL', kindLabel: '결재 대기', ddayDate: null,
        refNo: a.id, title: o ? `${o.clientName} — ${window.ENUM_META[a.type].label}` : `${a.opinion.slice(0, 22)}…`,
        sub: `기안 ${a.requester} · ${a.createdAt.slice(5, 16)}`, amount: a.amount, negAmount: a.type.includes('REFUND'),
        actionLabel: '처리', go: () => navigate('approvalDetail', { approvalId: a.id }),
      });
    });
    if (me.role === 'FINANCE' || me.role === 'ADMIN' || me.role === 'EXEC') {
      // 정산 확정 대기 (MG1003 · IDEA-14) — 확정 자체는 25 화면에서만
      SETTLEMENTS.filter((s) => s.status === 'DRAFT' && s.period === '2026-07').forEach((s) => {
        const ok = Object.values(s.checklist).filter(Boolean).length;
        q.push({
          id: s.id, kind: 'SETTLE', kindLabel: '정산 확정', ddayDate: null,
          refNo: s.id, title: `${s.target} 2026년 7월 — 체크리스트 ${ok}/3 충족`,
          sub: s.recalcHistory.length ? `재계산 ${s.recalcHistory.length}회 이력 적재 (BS0007)` : '재계산 이력 없음',
          amount: s.snapshot.profit, negAmount: false,
          actionLabel: '확정', go: () => navigate('settlement', { settlementId: s.id }),
        });
      });
      // 발행 요청 세금계산서
      TAX_INVOICES.filter((t) => t.status === 'REQUESTED').forEach((t) => {
        q.push({
          id: t.id, kind: 'TAX', kindLabel: '발행 요청', ddayDate: null,
          refNo: t.id, title: `${t.clientName} 세금계산서 (공급가 기준)`,
          sub: t.memo || '발행 대기', amount: t.totalAmount, negAmount: false,
          formula: t.id === 'TAX-2607-03'
            ? [{ label: '원 주문 금액', value: 3200000 }, { label: '부분환불', value: -800000, ref: 'APR-2026-00142' }, { label: 'VAT 10%', value: 240000 }]
            : null,
          actionLabel: '발행', go: () => navigate('taxInvoice', { invoiceId: t.id }),
        });
      });
    }
    // 미처리 업로드 오류 행 (BS0004) — 내가 올린 배치
    myErrorBatches.forEach((b) => {
      q.push({
        id: b.id, kind: 'IMPORT', kindLabel: '업로드 오류', ddayDate: null,
        refNo: b.id, title: `${b.kind === 'PAYMENT' ? '결제내역' : '주문'} 오류 ${b.errorRows}행 — 이어서 수정`,
        sub: b.note || '', amount: null,
        actionLabel: '수정', go: () => navigate(b.kind === 'PAYMENT' ? 'paymentImport' : 'excelImport', { batchId: b.id }),
      });
    });
    // 기한 임박 작업 — 작업 권한 역할만 (FINANCE 는 칸반 권한 없음 → 렌더 안 함)
    if (perm.kanban) {
      dueSoonTasks.slice(0, 2).forEach((t) => {
        const fr = FREELANCERS.find((f) => f.id === t.assigneeId);
        q.push({
          id: t.id, kind: 'TASK', kindLabel: ddayOf(t.dueDate) < 0 ? '지연 작업' : '임박 작업', ddayDate: t.dueDate,
          refNo: t.id, title: t.title, sub: `담당 ${fr ? fr.name : '미배정'}`, amount: null,
          actionLabel: '보드로', go: () => navigate('kanban', { taskId: t.id }),
        });
      });
    }
    return q;
  }, []);

  const [queue, setQueue] = useState(initialQueue);
  const [leaving, setLeaving] = useState({});
  const [doneLog, setDoneLog] = useState([]);

  // 처리 완료 표시(데모) — 슬라이드 아웃 → 제로 큐 도달 시 오늘 처리 요약 전환 (IDEA-04)
  const markDone = (item) => {
    setLeaving((s) => ({ ...s, [item.id]: true }));
    setTimeout(() => {
      setQueue((q) => {
        const next = q.filter((x) => x.id !== item.id);
        if (next.length === 0) {
          toast('오늘 조치를 모두 마쳤어요 — 수고했어요!', { actionLabel: '알림 센터 정리 →', onAction: () => navigate('notifications') });
        } else if (item.kind === 'APPROVAL') {
          toast(`${item.refNo} 처리 완료로 표시 — 남은 조치 ${next.length}건`, { actionLabel: '결재함에서 다음 건 →', onAction: () => navigate('inbox') }); // IDEA-16
        } else {
          toast(`${item.refNo} 완료 표시 — 남은 조치 ${next.length}건`);
        }
        return next;
      });
      setDoneLog((d) => [...d, { ...item, at: new Date().toTimeString().slice(0, 5) }]);
    }, 320);
  };

  // ── 어제 이후 다이제스트 (IDEA-17 — 하루 첫 로그인 1회) ──────────────────
  const [digestOpen, setDigestOpen] = useState(true);
  const digest = useMemo(() => ({
    approved: APPROVALS.filter((a) => a.status === 'APPROVED' && a.decidedAt && a.decidedAt >= '2026-07-09').length,
    rejected: APPROVALS.filter((a) => a.status === 'REJECTED' && a.decidedAt && a.decidedAt >= '2026-07-09').length,
    assigned: ASSIGNMENTS.filter((a) => a.assignedAt >= '2026-07-09').length,
    errorRows: errorRowCount,
  }), []);

  // ── 최근 반영 피드 (7연쇄 — MG1001) ─────────────────────────────────────
  const feed = useMemo(() => {
    const rows = [];
    APPROVALS.filter((a) => a.chainReceipt).forEach((a) => {
      const sales = (a.expectedDiff || []).find((d) => d.field === 'currentSales' || d.field === 'adjustment');
      rows.push({
        id: a.id, at: a.decidedAt, tone: 'emerald',
        text: `${a.id} 최종 승인`, before: sales ? sales.before : null, after: sales ? sales.after : null,
        async: (a.chainReceipt.find((c) => c.async) || {}).label || null,
        go: () => navigate('approvalDetail', { approvalId: a.id, tab: 'receipt' }),
        goLabel: '반영 영수증',
      });
    });
    APPROVALS.filter((a) => a.status === 'REJECTED').forEach((a) => {
      rows.push({
        id: a.id, at: a.decidedAt, tone: 'rose',
        text: `${a.id} 반려 — ${a.approvalLine.find((s) => s.status === 'REJECTED')?.comment || '사유 확인'}`,
        note: '데이터 무변경 (BS0006)',
        go: () => navigate('approvalDetail', { approvalId: a.id }), goLabel: '결재 상세',
      });
    });
    IMPORT_BATCHES.filter((b) => b.status === 'SUCCESS' && b.okRows > 0).slice(0, 2).forEach((b) => {
      rows.push({
        id: b.id, at: b.collectedAt, tone: 'cyan',
        text: `${b.id} ${b.kind === 'PAYMENT' ? '결제내역' : '주문'} ${b.okRows}건 등록 완료`,
        note: b.kind === 'ORDER' ? '미배정 작업 대기' : '미매칭 3건',
        relay: b.kind === 'ORDER'
          ? { label: '지금 배정하기 →', run: () => navigate('assign', { batchId: b.id }) }
          : { label: '매칭하기 →', run: () => navigate('paymentImport', { batchId: b.id }) },
        go: () => navigate(b.kind === 'PAYMENT' ? 'paymentImport' : 'excelImport', { batchId: b.id }), goLabel: '배치 보기',
      });
    });
    return rows.sort((x, y) => (y.at || '').localeCompare(x.at || '')).slice(0, 6);
  }, []);

  // ── ⌘K 통합검색 팔레트 (IDEA-03) ─────────────────────────────────────────
  const [palOpen, setPalOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const searchIndex = useMemo(() => [
    ...ORDERS.map((o) => ({ id: o.id, label: o.item, sub: `${o.clientName} · ${o.id}`, status: o.status, go: () => navigate('orders', { orderId: o.id }) })),
    ...APPROVALS.map((a) => ({ id: a.id, label: `${window.ENUM_META[a.type].label} ${a.id}`, sub: `기안 ${a.requester} · ₩${fmt(a.amount)}`, status: a.status, go: () => navigate('approvalDetail', { approvalId: a.id }) })),
    ...FREELANCERS.map((f) => ({ id: f.id, label: f.name, sub: f.specialty, status: f.active ? 'ACTIVE' : 'INACTIVE', go: () => navigate('freelancers', { freelancerId: f.id }) })),
  ], []);
  const recents = useMemo(() => ['APR-2026-00145', 'ORD-2607-004', 'APR-2026-00139', 'FR-101', 'ORD-2607-010']
    .map((id) => searchIndex.find((x) => x.id === id)).filter(Boolean), [searchIndex]);
  const results = q.trim()
    ? searchIndex.filter((x) => (x.id + x.label + x.sub).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : recents;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalOpen(true); setQ(''); setSel(0); }
      if (e.key === 'Escape') setPalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const palKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[sel]) { setPalOpen(false); results[sel].go(); }
  };

  // ── 바로가기 5종 — 권한 없는 메뉴는 렌더링하지 않음 (MG1005) ─────────────
  const shortcuts = [
    { route: 'excelImport', label: '엑셀 업로드', icon: 'upload' },
    { route: 'draft', label: '기안 작성', icon: 'edit' },
    { route: 'inbox', label: '결재함', icon: 'inbox' },
    { route: 'kanban', label: '칸반 보드', icon: 'columns' },
    { route: 'settlement', label: '정산 확정', icon: 'calculator' },
  ].filter((s) => perm[s.route]);

  const rhythm = [3, 6, 4, 7, 5, 8, 4]; // 주간 처리 건수 — 개인 참고용, 순위표 없음 (IDEA-04)
  const weekTotal = rhythm.reduce((a, b) => a + b, 0);

  const tile = (icon, color, title, count, sub, btnLabel, onGo) => (
    <Card className="p-5 flex flex-col">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon name={icon} className={`w-4 h-4 ${color}`} />{title}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">{count}</span>
        <span className="text-sm text-slate-500">건</span>
        {sub && <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-medium">{sub}</span>}
      </div>
      <button onClick={onGo} className="mt-4 self-start text-xs font-semibold text-purple-300 hover:text-purple-200 inline-flex items-center gap-1">
        {btnLabel} <Icon name="arrowRight" className="w-3 h-3" />
      </button>
    </Card>
  );

  return (
    <div className="space-y-5">
      {/* 헤더 — 3단 + 집계 기준/폴링 + ⌘K (IDEA-03) */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel color="purple">HOME · {TODAY} (금)</SectionLabel>
          <h1 className="text-2xl font-bold mt-1">{me.name}님, 오늘 조치할 항목이 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{queue.length}건</span> 있어요</h1>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            역할 <EnumPill status={me.role} />
            <span className="text-slate-600">·</span>
            <span title={`집계 기준 ${AGGREGATED_AT} (BS0011)`}>집계 기준 {polledAt} · 다음 갱신 <span className="font-mono tabular-nums">{countdown}s</span></span>
          </p>
        </div>
        <button onClick={() => { setPalOpen(true); setQ(''); setSel(0); }}
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-600">
          <Icon name="search" className="w-3.5 h-3.5" />검색
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700">⌘K</kbd>
        </button>
      </div>

      {/* 어제 이후 다이제스트 — 하루 첫 로그인 1회 (IDEA-17) */}
      {digestOpen && (
        <Card className="p-4 flex items-center justify-between gap-3 border-purple-500/20 bg-gradient-to-r from-purple-500/[0.06] to-pink-500/[0.06]">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400">어제 이후</span>
            <button onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-emerald-200">
              승인 <b className="text-emerald-300 tabular-nums">{digest.approved}</b>건
            </button>
            <span className="text-slate-700">·</span>
            <span title="반려 사유: 변경 계약서 증빙 누락 — 데이터는 변경되지 않았습니다 (BS0006)">
              반려 <b className="text-rose-300 tabular-nums">{digest.rejected}</b>건
              <button onClick={() => navigate('notifications', { approvalId: 'APR-2026-00144' })} className="ml-1 text-xs text-purple-300 hover:text-purple-200 underline decoration-dotted">사유 보기</button>
            </span>
            <span className="text-slate-700">·</span>
            <span>새 배정 <b className="text-cyan-300 tabular-nums">{digest.assigned}</b>건</span>
            <span className="text-slate-700">·</span>
            <button onClick={() => queueRef.current?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-amber-200">
              업로드 오류 <b className="text-amber-300 tabular-nums">{digest.errorRows}</b>행
            </button>
          </div>
          <button onClick={() => { setDigestOpen(false); toast('다이제스트를 읽음 처리했어요', { actionLabel: '알림 센터 →', onAction: () => navigate('notifications') }); }}
            className="shrink-0 text-xs text-slate-400 hover:text-white">모두 읽음</button>
        </Card>
      )}

      {/* 요약 타일 3종 — 결재함/칸반/업로드 딥링크 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tile('inbox', 'text-purple-400', '내 결재 대기 (내 차례)', myTurnApprovals.length,
          delayedApprovals.length ? `지연 ${delayedApprovals.length}건` : null, '결재함',
          () => navigate('inbox', { filter: 'myTurn' }))}
        {tile('columns', 'text-amber-400', '기한 임박 작업 (D-2 이내)', dueSoonTasks.length,
          overdueTasks.length ? `지연 ${overdueTasks.length}건` : null, '칸반 보드',
          () => navigate('kanban', { filter: 'dueSoon' }))}
        {tile('alert', 'text-rose-400', '미처리 업로드 오류 행', errorRowCount, null, '이어서 수정',
          () => navigate((myErrorBatches[0]?.kind || 'PAYMENT') === 'PAYMENT' ? 'paymentImport' : 'excelImport', { batchId: myErrorBatches[0]?.id || 'IMP-005' }))}
      </div>

      {/* 오늘의 조치 큐 (IDEA-04) — 처리하면 슬라이드 아웃, 제로 큐 시 요약 전환 */}
      <div ref={queueRef}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Icon name="zap" className="w-4 h-4 text-purple-400" />오늘의 조치 큐</h3>
            <div className="text-xs text-slate-500 mt-0.5">역할별 자동 구성 (MG1005) — {me.role === 'FINANCE' ? '재무: 결재 대기 · 정산 확정 · 발행 요청 · 업로드 오류' : '역할 프리셋'}</div>
          </div>
          <span className="text-xs text-slate-400">남은 조치 <b className="text-purple-300 tabular-nums text-sm">{queue.length}</b> 건</span>
        </div>
        {queue.length === 0 ? (
          <div className="p-8 text-center" style={{ animation: 'fadeUp .4s ease-out' }}>
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3">
              <Icon name="check" className="w-6 h-6 text-emerald-300" />
            </div>
            <h4 className="font-bold text-lg">오늘 조치 완료</h4>
            <p className="text-sm text-slate-400 mt-1">{doneLog.length}건을 처리했어요 — 오늘 처리 요약</p>
            <div className="max-w-md mx-auto mt-4 space-y-1.5 text-left">
              {doneLog.map((d) => (
                <div key={d.id} className="flex items-center gap-2 text-xs text-slate-400 rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
                  <Icon name="check" className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="font-mono text-slate-500">{d.at}</span>
                  <span className="font-mono text-cyan-300">{d.refNo}</span>
                  <span className="truncate">{d.title}</span>
                </div>
              ))}
            </div>
            <button onClick={() => navigate('notifications')} className="mt-5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
              알림 센터에서 마무리 →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {queue.map((item) => (
              <div key={item.id}
                className={`flex items-center gap-3 px-5 py-3 transition-all duration-300 ${leaving[item.id] ? 'opacity-0 translate-x-10' : 'hover:bg-slate-800/30'}`}>
                <span className="shrink-0 w-16">
                  {item.ddayDate
                    ? <DdayBadge date={item.ddayDate} />
                    : <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono ${item.kind === 'IMPORT' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-slate-500/15 text-slate-400 border border-slate-600/40'}`}>{item.kind === 'IMPORT' ? '오류' : item.kind === 'APPROVAL' ? '대기' : '요청'}</span>}
                </span>
                <span className="shrink-0 w-20 text-xs font-medium text-slate-300">{item.kindLabel}</span>
                <button onClick={item.go} className="shrink-0 font-mono text-xs text-cyan-300 hover:text-cyan-200 hover:underline">{item.refNo}</button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{item.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">{item.sub}</div>
                </div>
                {item.amount != null && (
                  <span className="shrink-0 text-right">
                    <Money value={item.negAmount ? -item.amount : item.amount} formula={item.formula || null} />
                  </span>
                )}
                <button onClick={item.go}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
                  {item.actionLabel}
                </button>
                <button onClick={() => markDone(item)} title="처리 완료로 표시 (데모 — 실제 처리는 딥링크 화면에서)"
                  className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30">
                  <Icon name="check" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>

      {/* 최근 반영 피드 — 7연쇄 (MG1001) + 알림 센터 링크 */}
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-8 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div>
              <h3 className="font-semibold flex items-center gap-2"><Icon name="activity" className="w-4 h-4 text-emerald-400" />최근 반영 피드 — 7연쇄</h3>
              <div className="text-xs text-slate-500 mt-0.5">결재 승인 → 주문·매출·정산·손익·이력·알림 자동 반영 · 행 클릭 → 반영 영수증</div>
            </div>
            <button onClick={() => navigate('notifications')} className="text-xs text-purple-300 hover:text-purple-200 inline-flex items-center gap-1">
              알림 센터 <Icon name="arrowRight" className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-slate-800/70">
            {feed.map((f) => (
              <div key={f.id} onClick={f.go} className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-slate-800/30 group">
                <span className="shrink-0 font-mono text-[11px] text-slate-500 w-20">{(f.at || '').slice(0, 10) === TODAY ? (f.at || '').slice(11, 16) : (f.at || '').slice(5, 10)}</span>
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${f.tone === 'rose' ? 'bg-rose-400' : f.tone === 'cyan' ? 'bg-cyan-400' : 'bg-emerald-400'}`}></span>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="text-slate-200">{f.text}</span>
                  {f.before != null && (
                    <span className="ml-2 font-mono tabular-nums text-xs">
                      <span className="text-slate-500">매출 ₩{fmt(f.before)}</span>
                      <span className="text-slate-600 mx-1">→</span>
                      <span className={f.after < f.before ? 'text-rose-300' : 'text-emerald-300'}>₩{fmt(f.after)}</span>
                      <span className="text-slate-600 ml-1">반영</span>
                    </span>
                  )}
                  {f.note && <span className="ml-2 text-[11px] text-slate-500">{f.note}</span>}
                  {f.async && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">알림 비동기 발송</span>}
                </div>
                {f.relay && (
                  <button onClick={(e) => { e.stopPropagation(); f.relay.run(); }}
                    className="shrink-0 text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-300 hover:to-pink-300">
                    {f.relay.label}
                  </button>
                )}
                <span className="shrink-0 text-[11px] text-slate-600 group-hover:text-purple-300 inline-flex items-center gap-1">{f.goLabel} <Icon name="chevronRight" className="w-3 h-3" /></span>
              </div>
            ))}
          </div>
        </Card>

        {/* 바로가기(MG1005) + 처리 리듬 + 3스텝 투어 (IDEA-18) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card className="p-5">
            <SectionLabel color="slate">바로가기 — 권한 밖 메뉴는 표시되지 않아요 (MG1005)</SectionLabel>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {shortcuts.map((s) => (
                <button key={s.route} onClick={() => navigate(s.route)}
                  className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-800/50 border border-slate-700/60 py-3 text-xs text-slate-300 hover:border-purple-500/40 hover:text-white transition">
                  <Icon name={s.icon} className="w-4 h-4 text-purple-300" />{s.label}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel color="emerald">처리 리듬 — 개인 참고용</SectionLabel>
              <span className="text-xs text-slate-400">이번 주 <b className="text-emerald-300 tabular-nums">{weekTotal}</b>건</span>
            </div>
            <div className="mt-3"><Sparkline data={rhythm} color="#34d399" height={36} /></div>
            <div className="text-[10px] text-slate-600 mt-1.5">순위표는 없어요 — 내 리듬만 봅니다 (IDEA-04)</div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel color="pink">시작하기 2/3</SectionLabel>
              <button onClick={() => toast('3단계 — 정산 확정 화면에서 체크리스트 리추얼을 체험해 보세요', { actionLabel: '정산 확정으로 →', onAction: () => navigate('settlement', { settlementId: 'SET-2607-02' }) })}
                className="text-xs text-purple-300 hover:text-purple-200">투어 계속 →</button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              {[{ t: '결재함에서 내 차례 확인', done: true }, { t: '정산 재계산 이력 확인', done: true }, { t: '정산 확정 리추얼 체험', done: false }].map((s, i) => (
                <div key={i} className={`flex items-center gap-2 ${s.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${s.done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold'}`}>
                    {s.done ? <Icon name="check" className="w-2.5 h-2.5" /> : i + 1}
                  </span>
                  {s.t}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-600 mt-2">실제 행동을 감지해 체크돼요 — 완주하면 이 카드는 사라집니다 (IDEA-18)</div>
          </Card>
        </div>
      </div>

      {/* ⌘K 통합검색 팔레트 (IDEA-03) */}
      {palOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-28 p-6">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setPalOpen(false)}></div>
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden" style={{ animation: 'fadeUp .18s ease-out' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
              <Icon name="search" className="w-4 h-4 text-slate-500" />
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={palKey}
                placeholder="주문번호 · 기안 ID · 프리랜서명 검색…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-600" />
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500">esc</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto py-1.5">
              <div className="px-4 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-600">{q.trim() ? `결과 ${results.length}건` : '최근 방문'}</div>
              {results.length === 0 && <div className="px-4 py-6 text-sm text-slate-500 text-center">결과가 없어요 — 주문번호·기안 ID로 검색해 보세요</div>}
              {results.map((r, i) => (
                <button key={r.id} onMouseEnter={() => setSel(i)} onClick={() => { setPalOpen(false); r.go(); }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left ${i === sel ? 'bg-purple-500/15' : ''}`}>
                  <span className="font-mono text-[11px] text-slate-500 w-28 shrink-0 truncate">{r.id}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{r.label}</span>
                    <span className="block text-[11px] text-slate-500 truncate">{r.sub}</span>
                  </span>
                  <EnumPill status={r.status} />
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-600 flex items-center gap-3">
              <span>↑↓ 이동</span><span>Enter 열기</span><span>어느 화면에서든 ⌘K (IDEA-03)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
window.Home = Home;
