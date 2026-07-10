// order-list.jsx — 11L 주문 목록 (route: orders) · inquiry2
// 금액 3분해(원 금액 잠금 / 기환불 누계 / 현재 매출 수식 팝오버 IDEA-07) · 저장된 뷰(IDEA-05)
// 행 훑기 사이드 패널(IDEA-06, ↑↓ 이동) · ⟨이력⟩·⟨결재중⟩ 행 배지(IDEA-11) · sticky 합계+검산
// Ctrl+V 붙여넣기 임포트 진입(IDEA-01) · 데이터: ORDERS, SALES_EVENTS, SAVED_VIEWS, APPROVALS
const { useState, useMemo, useEffect } = React;

function OrderList({ route, navigate, tweaks }) {
  const {
    Card, Icon, PageHeader, EnumPill, ENUM_META, Money, DdayBadge,
    SidePanel, SavedViewChips, ConfirmDialog, fmt, ddayOf, toast,
  } = window;

  // 로컬 보강 — v2 data.js에 플랫폼 라벨 메타가 없어 화면 로컬로 정의
  const PLATFORM_LABELS = { SMARTSTORE: '스마트스토어', COUPANG: '쿠팡', EMAIL: '이메일', MANUAL: '수기' };

  // ── 상태 ──────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState(ORDERS);                 // 로컬 복사 (삭제 시뮬레이션)
  const [q, setQ] = useState('');
  const [fPlatform, setFPlatform] = useState('ALL');
  const [fDept, setFDept] = useState('ALL');                    // 시연 데이터 노출을 위해 '전체' 시작
  const [fProject, setFProject] = useState('ALL');
  const [fStatus, setFStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('2026-06-10');       // 최근 1개월 (주문일 기준)
  const [dateTo, setDateTo] = useState(TODAY);
  const [density, setDensity] = useState('normal');             // IDEA-02 밀도 토글
  const [viewId, setViewId] = useState(null);                   // IDEA-05 저장된 뷰
  const [localViews, setLocalViews] = useState(SAVED_VIEWS.filter((v) => v.screen === 'orders'));
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [page, setPage] = useState(1);
  const [panelId, setPanelId] = useState(null);                 // IDEA-06 사이드 패널
  const [panelTab, setPanelTab] = useState('overview');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const PAGE_SIZE = 10;

  // ── 파생 헬퍼 — 현재 매출은 항상 이벤트 합산으로 유도 (BS0001) ─────────────
  const eventsOf = (oid) => SALES_EVENTS.filter((e) => e.orderId === oid);
  const curSalesOf = (oid) => eventsOf(oid).reduce((s, e) => s + e.amount, 0);
  const formulaOf = (oid) =>
    eventsOf(oid)
      .slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .map((e) => ({ label: `${(ENUM_META[e.type] || {}).label || e.type} ${e.occurredAt.slice(5, 10)}`, value: e.amount, ref: e.approvalId || undefined }));
  const deptName = (id) => (DEPARTMENTS.find((d) => d.id === id) || {}).name || '—';
  const projName = (id) => (PROJECTS.find((p) => p.id === id) || {}).name || '—';
  const empName = (id) => (EMPLOYEES.find((e) => e.id === id) || {}).name || '—';
  const approvalOf = (id) => APPROVALS.find((a) => a.id === id) || null;
  const hasHistory = (o) => eventsOf(o.id).length >= 2;         // BS0007 — 이벤트 2건↑ = 금액 변경 이력

  // ── 저장된 뷰 매칭 + 라이브 건수 배지 (IDEA-05) ────────────────────────────
  const matchView = (o, v) => {
    if (!v) return true;
    const f = v.filters || {};
    if (f.dueWithinDays != null)
      return ddayOf(o.dueDate) <= f.dueWithinDays && !['DONE', 'CANCELLED', 'REFUNDED'].includes(o.status);
    if (f.hasActiveRefundApproval) return !!o.activeApprovalId;
    return true;
  };
  const chipViews = localViews.map((v) => ({ ...v, count: orders.filter((o) => matchView(o, v)).length }));
  const activeView = localViews.find((v) => v.id === viewId) || null;

  // ── 필터링 ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (!matchView(o, activeView)) return false;
      if (fPlatform !== 'ALL' && o.platform !== fPlatform) return false;
      if (fDept !== 'ALL' && o.deptId !== fDept) return false;
      if (fProject !== 'ALL' && o.projectId !== fProject) return false;
      if (fStatus !== 'ALL' && o.status !== fStatus) return false;
      if (o.orderedAt < dateFrom || o.orderedAt > dateTo) return false;
      if (kw && !o.id.toLowerCase().includes(kw) && !o.item.toLowerCase().includes(kw) && !o.clientName.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [orders, q, fPlatform, fDept, fProject, fStatus, dateFrom, dateTo, viewId, localViews]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > pageCount) setPage(1); }, [pageCount]);

  // 합계 + 검산 (§4.2-6): 현재 매출 합계 = Σ 매출 이벤트 → 항상 일치해야 한다
  const sums = filtered.reduce(
    (a, o) => ({ amount: a.amount + o.amount, refund: a.refund + o.refundedAmount, cur: a.cur + curSalesOf(o.id), ev: a.ev + eventsOf(o.id).length }),
    { amount: 0, refund: 0, cur: 0, ev: 0 }
  );

  const panelOrder = panelId ? orders.find((o) => o.id === panelId) : null;
  const openPanel = (id, tab = 'overview') => { setPanelId(id); setPanelTab(tab); };

  // 딥링크: { orderId } → 해당 행 패널 자동 오픈 (CONTRACT §3)
  useEffect(() => {
    if (route && route.payload && route.payload.orderId) openPanel(route.payload.orderId);
  }, [route]);

  // 키보드: 숫자키 1~5 뷰 전환(IDEA-05) · 패널 열림 시 ↑↓ 행 이동(IDEA-06)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (/^[1-9]$/.test(e.key)) {
        const v = chipViews[Number(e.key) - 1];
        if (v) { setViewId((prev) => (prev === v.id ? null : v.id)); setPage(1); }
      }
      if (panelId && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        const idx = pageItems.findIndex((o) => o.id === panelId);
        const next = pageItems[idx + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) setPanelId(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelId, pageItems, chipViews]);

  // Ctrl+V 붙여넣기 임포트 진입 (IDEA-01) — 클립보드 TSV를 싣고 업로드 검증 단계로
  useEffect(() => {
    const onPaste = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const text = e.clipboardData && e.clipboardData.getData('text');
      if (!text || !text.trim()) return;
      const rows = text.trim().split('\n').length;
      toast(`엑셀 범위 ${rows}행 감지 — 업로드 검증 단계로 이관해요 (IDEA-01)`, {
        actionLabel: '검증 시작 →', onAction: () => navigate('excelImport', { pastedRows: rows }),
      });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // 삭제(UC11-2): 매출 이벤트가 1건이라도 적재된 주문은 삭제 불가 → 전체환불 결재 유도
  const confirmDelete = () => {
    if (!deleteReason.trim()) { toast('삭제 사유를 입력해 주세요 — 감사 로그에 기록됩니다 (MG1004)', { tone: 'warn' }); return; }
    const id = deleteTarget.id;
    setOrders((s) => s.filter((o) => o.id !== id));
    setDeleteTarget(null); setDeleteReason(''); setPanelId(null);
    toast(`${id} 삭제 완료 — 변경 전/후 값·사유가 감사 로그에 기록됐어요 (MG1004)`, {
      actionLabel: '변경 이력 보기 →', onAction: () => navigate('auditLog'),
    });
  };

  const rowPad = density === 'compact' ? 'py-1.5' : 'py-2.5';

  // ⟨결재중⟩ 홀드 배지 + hover 진행 현황 팝오버 (IDEA-11)
  const HoldBadge = ({ approvalId }) => {
    const ap = approvalOf(approvalId);
    const pending = ap && ap.approvalLine.find((s) => s.status === 'PENDING');
    return (
      <span className="relative group inline-flex" onClick={(e) => e.stopPropagation()}>
        <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300 px-1.5 py-0.5 text-[10px] font-medium">
          <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span>결재중
        </span>
        <span className="absolute z-40 hidden group-hover:block top-full left-0 mt-1 w-60 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-2.5 text-left">
          <span className="block text-[11px] text-slate-300">
            결재 진행 중 <span className="font-mono text-cyan-300">{approvalId}</span>
            {pending && <> · {pending.step}단계 {(ENUM_META[pending.role] || {}).label || pending.role} 대기</>}
          </span>
          <span className="block text-[10px] text-slate-500 mt-1">승인 전에는 데이터가 변경되지 않아요 — 수정·삭제·신규 기안 잠금 (IDEA-11)</span>
        </span>
      </span>
    );
  };

  const selCls = 'w-full rounded-lg bg-slate-950/60 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-purple-500/60';

  return (
    <div className="max-w-[1440px]">
      <PageHeader
        label="ORDERS · 11L" title="주문 목록"
        desc="원 주문 금액은 불변 — 환불·재결제는 매출 이벤트로만 반영되고, 모든 숫자가 출처에 즉답합니다 (BS0001)"
        actions={
          <>
            <button onClick={() => toast(`orders_${TODAY.replace(/-/g, '')}.xlsx 생성 — 현재 필터 ${filtered.length}건 · 다운로드 이력 기록`, { tone: 'ok' })}
              className="px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5">
              <Icon name="download" className="w-3.5 h-3.5" />엑셀 다운로드
            </button>
            <button onClick={() => navigate('excelImport')}
              className="px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5">
              <Icon name="upload" className="w-3.5 h-3.5" />엑셀 업로드
            </button>
            <button onClick={() => navigate('orderForm')}
              className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 flex items-center gap-1.5">
              <Icon name="plus" className="w-3.5 h-3.5" />주문 등록
            </button>
          </>
        }
      />

      {/* 저장된 뷰 (IDEA-05) — 숫자키 1~5 전환, 라이브 건수 배지 */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <SavedViewChips views={chipViews} activeId={viewId} onSelect={(id) => { setViewId(id); setPage(1); }} allLabel={`전체 ${orders.length}`} />
        <div className="relative shrink-0">
          <button onClick={() => setSaveViewOpen((v) => !v)} className="px-2.5 py-1 rounded-full text-xs text-slate-400 border border-dashed border-slate-600 hover:text-slate-200 hover:border-slate-400 flex items-center gap-1">
            <Icon name="plus" className="w-3 h-3" />뷰로 저장
          </button>
          {saveViewOpen && (
            <div className="absolute z-40 right-0 top-full mt-1.5 w-64 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-3">
              <div className="text-[11px] text-slate-400 mb-1.5">현재 필터·밀도 상태를 뷰로 저장 (IDEA-05)</div>
              <input value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="예: 9월 환불 점검" autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newViewName.trim()) {
                    setLocalViews((s) => [...s, { id: `SV-L${s.length + 1}`, screen: 'orders', name: newViewName.trim(), filters: {}, shared: false }]);
                    setSaveViewOpen(false); setNewViewName('');
                    toast(`뷰 "${newViewName.trim()}" 저장 — 숫자키로 바로 전환할 수 있어요`);
                  }
                  if (e.key === 'Escape') setSaveViewOpen(false);
                }}
                className="w-full rounded-md bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-purple-500/60" />
              <div className="text-[10px] text-slate-500 mt-1.5">Enter 저장 · Esc 닫기</div>
            </div>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-4">
            <label className="block text-[11px] text-slate-500 mb-1">검색</label>
            <div className="relative">
              <Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="주문번호 · 플랫폼주문번호 · 주문명"
                className="w-full rounded-lg bg-slate-950/60 border border-slate-700 pl-8 pr-3 py-1.5 text-sm outline-none focus:border-purple-500/60" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">플랫폼</label>
            <select value={fPlatform} onChange={(e) => { setFPlatform(e.target.value); setPage(1); }} className={selCls}>
              <option value="ALL">전체</option>
              {Object.entries(PLATFORM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">부서</label>
            <select value={fDept} onChange={(e) => { setFDept(e.target.value); setFProject('ALL'); setPage(1); }} className={selCls}>
              <option value="ALL">전체</option>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">프로젝트</label>
            <select value={fProject} onChange={(e) => { setFProject(e.target.value); setPage(1); }} className={selCls}>
              <option value="ALL">전체</option>
              {PROJECTS.filter((p) => fDept === 'ALL' || p.deptId === fDept).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">상태</label>
            <select value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }} className={selCls}>
              <option value="ALL">전체</option>
              {['RECEIVED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'].map((s) => (
                <option key={s} value={s}>{(ENUM_META[s] || {}).label || s}</option>
              ))}
            </select>
          </div>
          <div className="col-span-4">
            <label className="block text-[11px] text-slate-500 mb-1">기간 (주문일)</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={selCls} />
              <span className="text-slate-600 text-sm">~</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={selCls} />
            </div>
          </div>
          <div className="col-span-8 flex items-center justify-end gap-3">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Icon name="clipboard" className="w-3 h-3" />Ctrl+V 로 엑셀 범위를 붙여넣으면 업로드 검증으로 바로 이관돼요 (IDEA-01)
            </span>
            <button onClick={() => toast(`검색 조건 적용 — ${filtered.length}건`, { tone: 'ok' })}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
              검색
            </button>
          </div>
        </div>
      </Card>

      {/* 결과 카운트 + 밀도 토글 (IDEA-02) */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-sm text-slate-400">검색 결과 <span className="font-mono font-semibold text-slate-200">{fmt(filtered.length)}</span> 건</div>
        <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-slate-800/60 border border-slate-700">
          {[['normal', '기본'], ['compact', '촘촘']].map(([k, l]) => (
            <button key={k} onClick={() => setDensity(k)}
              className={`px-2.5 py-1 rounded ${density === k ? 'bg-purple-500/25 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 테이블 — 첫 열 고정 + 자체 스크롤, sticky 헤더/합계 (§6.3) */}
      <Card className="overflow-hidden">
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-sm min-w-[1080px]">
            <thead className="sticky top-0 z-20 bg-slate-900">
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700/60">
                <th className="sticky left-0 z-10 bg-slate-900 px-4 py-2.5 font-medium">주문번호</th>
                <th className="px-3 py-2.5 font-medium">플랫폼</th>
                <th className="px-3 py-2.5 font-medium">주문명</th>
                <th className="px-3 py-2.5 font-medium">상태</th>
                <th className="px-3 py-2.5 font-medium">납기</th>
                <th className="px-3 py-2.5 font-medium text-right">원 주문 금액</th>
                <th className="px-3 py-2.5 font-medium text-right">기환불 누계</th>
                <th className="px-4 py-2.5 font-medium text-right">현재 매출</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o) => (
                <tr key={o.id} onClick={() => openPanel(o.id)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') openPanel(o.id); }}
                  className={`border-b border-slate-800/70 cursor-pointer transition hover:bg-slate-800/40 focus-visible:bg-slate-800/40 outline-none ${panelId === o.id ? 'bg-purple-500/10' : ''}`}>
                  <td className={`sticky left-0 z-10 px-4 ${rowPad} font-mono text-xs text-slate-400 ${panelId === o.id ? 'bg-[#181a33]' : 'bg-slate-900'}`}>{o.id}</td>
                  <td className={`px-3 ${rowPad} text-xs text-slate-400`}>{PLATFORM_LABELS[o.platform] || o.platform}</td>
                  <td className={`px-3 ${rowPad}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-xs text-slate-200">{o.item}</span>
                      {hasHistory(o) && (
                        <button onClick={(e) => { e.stopPropagation(); openPanel(o.id, 'history'); }}
                          title="금액 변경 이력 보기 (BS0007)"
                          className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 text-[10px] hover:bg-cyan-500/20">
                          <Icon name="history" className="w-2.5 h-2.5" />이력
                        </button>
                      )}
                      {o.activeApprovalId && <HoldBadge approvalId={o.activeApprovalId} />}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{o.clientName} · {deptName(o.deptId)}</div>
                  </td>
                  <td className={`px-3 ${rowPad}`}><EnumPill status={o.status} /></td>
                  <td className={`px-3 ${rowPad}`}>
                    {['DONE', 'REFUNDED', 'CANCELLED'].includes(o.status)
                      ? <span className="text-xs text-slate-600 font-mono">{o.dueDate.slice(5)}</span>
                      : <DdayBadge date={o.dueDate} />}
                  </td>
                  <td className={`px-3 ${rowPad} text-right`}><Money value={o.amount} locked /></td>
                  <td className={`px-3 ${rowPad} text-right`}>
                    {o.refundedAmount > 0 ? <Money value={-o.refundedAmount} /> : <span className="font-mono text-sm text-slate-600">0</span>}
                  </td>
                  <td className={`px-4 ${rowPad} text-right`} onClick={(e) => e.stopPropagation()}>
                    <Money value={curSalesOf(o.id)} formula={formulaOf(o.id)} />
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-14 text-center text-sm text-slate-500">조건에 맞는 주문이 없어요 — 필터를 조정하거나 뷰를 해제해 보세요</td></tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-slate-900 border-t-2 border-slate-700">
                <td colSpan={5} className="sticky left-0 bg-slate-900 px-4 py-2.5">
                  <span className="relative group inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    합계
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 text-[10px] cursor-default">
                      <Icon name="check" className="w-2.5 h-2.5" />검산 통과
                    </span>
                    <span className="absolute z-40 hidden group-hover:block bottom-full left-0 mb-1.5 w-72 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-2.5">
                      <span className="block text-[11px] text-slate-300">집계 기준 {AGGREGATED_AT} · 대상 이벤트 {sums.ev}건</span>
                      <span className="block text-[10px] text-slate-500 mt-1">현재 매출 합계 = Σ 매출 이벤트 부호 합산 — 필드 저장 없이 유도됩니다 (BS0001)</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right"><Money value={sums.amount} size="md" /></td>
                <td className="px-3 py-2.5 text-right">{sums.refund > 0 ? <Money value={-sums.refund} size="md" /> : <span className="font-mono text-slate-600">0</span>}</td>
                <td className="px-4 py-2.5 text-right"><Money value={sums.cur} size="md" /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {/* 페이지네이션 — 인피니트 스크롤 금지 (건수 파악·감사 추적) */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
          <span>페이지당 {PAGE_SIZE}건 · 행 클릭 또는 Enter로 상세, 패널 열림 시 ↑↓ 행 이동 (IDEA-06)</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-30">« 이전</button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded font-mono ${page === n ? 'bg-purple-500/25 text-purple-200' : 'hover:bg-slate-800 text-slate-400'}`}>{n}</button>
            ))}
            <button disabled={page === pageCount} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-30">다음 »</button>
          </div>
        </div>
      </Card>

      {/* ── 사이드 패널 (IDEA-06) — 목록을 떠나지 않는 행 훑기 ── */}
      <SidePanel
        open={!!panelOrder}
        onClose={() => setPanelId(null)}
        title={panelOrder ? `주문 상세 · ${panelOrder.id}` : ''}
        subtitle={panelOrder ? `${panelOrder.clientName} · ${panelOrder.item} — ↑↓ 행 이동 · Esc 닫기` : ''}
        footer={panelOrder && (
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => navigate('orderForm', { orderId: panelOrder.id })}
              disabled={!!panelOrder.activeApprovalId}
              title={panelOrder.activeApprovalId ? `결재 진행 중 ${panelOrder.activeApprovalId} — 승인/반려 후 수정 가능 (IDEA-11)` : '주문 수정 (UC11-1)'}
              className="px-2 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
              <Icon name="edit" className="w-3 h-3" />수정
            </button>
            <button onClick={() => { setDeleteTarget(panelOrder); setDeleteReason(''); }}
              disabled={eventsOf(panelOrder.id).length > 0 || !!panelOrder.activeApprovalId}
              title={eventsOf(panelOrder.id).length > 0 ? '매출 이벤트가 적재된 주문은 삭제할 수 없어요 — 전체환불 결재로 진행하세요' : panelOrder.activeApprovalId ? `결재 진행 중 ${panelOrder.activeApprovalId}` : '주문 삭제 (UC11-2)'}
              className="px-2 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
              <Icon name="trash" className="w-3 h-3" />삭제
            </button>
            <button onClick={() => navigate('draft', { orderId: panelOrder.id, type: 'PARTIAL_REFUND' })}
              disabled={!!panelOrder.activeApprovalId || panelOrder.status === 'REFUNDED' || panelOrder.status === 'CANCELLED'}
              title={panelOrder.activeApprovalId ? `결재 진행 중 ${panelOrder.activeApprovalId} — 이중 기안 차단 (IDEA-11)` : '주문ID·원 금액·기환불 누계 프리필 기안 (IDEA-10)'}
              className="px-2 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
              <Icon name="send" className="w-3 h-3" />환불 기안
            </button>
            <button onClick={() => toast('전체 상세 화면은 프로토타입 범위 외 — 패널 탭에서 동일 정보를 제공해요', { tone: 'warn' })}
              className="px-2 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center gap-1">
              <Icon name="external" className="w-3 h-3" />전체 상세
            </button>
          </div>
        )}
      >
        {panelOrder && (() => {
          const o = panelOrder;
          const events = eventsOf(o.id).slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
          const logs = AUDIT_LOGS.filter((l) => l.entityId === o.id);
          const rels = APPROVALS.filter((a) => a.orderId === o.id);
          const tabs = [['overview', '개요'], ['events', `이벤트 ${events.length}`], ['history', `변경 이력 ${logs.length}`], ['approvals', `관련 결재 ${rels.length}`]];
          return (
            <div>
              <div className="flex items-center gap-1 mb-4 p-0.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
                {tabs.map(([k, l]) => (
                  <button key={k} onClick={() => setPanelTab(k)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition ${panelTab === k ? 'bg-purple-500/25 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
                ))}
              </div>

              {panelTab === 'overview' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EnumPill status={o.status} />
                    {o.activeApprovalId && <HoldBadge approvalId={o.activeApprovalId} />}
                    {!['DONE', 'REFUNDED', 'CANCELLED'].includes(o.status) && <DdayBadge date={o.dueDate} />}
                  </div>
                  {/* 금액 3분해 (P1 · BS0001) */}
                  <div className="rounded-xl bg-slate-950/70 border border-slate-800 divide-y divide-slate-800">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-xs text-slate-400">원 주문 금액</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">원본 불변 — BS0001</div>
                      </div>
                      <Money value={o.amount} locked size="md" />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="text-xs text-slate-400">기환불 누계</div>
                      {o.refundedAmount > 0 ? <Money value={-o.refundedAmount} size="md" /> : <span className="font-mono text-slate-600">0</span>}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-xs text-slate-400">현재 매출</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">클릭 시 수식 전개 — IDEA-07</div>
                      </div>
                      <Money value={curSalesOf(o.id)} formula={formulaOf(o.id)} size="md" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {[['귀속 부서', deptName(o.deptId)], ['귀속 프로젝트', projName(o.projectId)], ['담당자', empName(o.managerId)],
                      ['플랫폼', PLATFORM_LABELS[o.platform] || o.platform], ['주문일 · 납기', `${o.orderedAt} · ${o.dueDate}`]].map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1.5 border-b border-slate-800/70">
                        <span className="text-slate-500 text-xs">{k}</span><span className="text-xs text-slate-300">{v}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-slate-500 text-xs">작업 진행</span>
                      <span className="flex items-center gap-2">
                        <span className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <span className="block h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${o.taskCount ? (o.doneTaskCount / o.taskCount) * 100 : 0}%` }}></span>
                        </span>
                        <span className="text-xs font-mono text-slate-400">{o.doneTaskCount}/{o.taskCount}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {panelTab === 'events' && (
                <div className="space-y-1.5">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                      <EnumPill status={e.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-slate-500 font-mono">{e.occurredAt} · {e.id}</div>
                        {e.approvalId && (
                          <button onClick={() => navigate('approvalDetail', { approvalId: e.approvalId })}
                            className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 hover:underline">{e.approvalId} →</button>
                        )}
                      </div>
                      <Money value={e.amount} />
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-700/60 mt-2">
                    <span className="text-xs font-medium text-slate-300">현재 매출 (부호 합산 · BS0001)</span>
                    <Money value={curSalesOf(o.id)} size="md" />
                  </div>
                </div>
              )}

              {panelTab === 'history' && (
                logs.length > 0 ? (
                  <div className="space-y-1.5">
                    {logs.map((l) => (
                      <div key={l.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>{l.at} · {l.actor}</span><span>{l.id}</span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1">
                          <span className="font-mono text-slate-500">{l.field}</span>{' '}
                          <span className="text-slate-400 line-through">{l.before}</span>
                          <span className="mx-1 text-slate-600">→</span>
                          <span className="text-slate-100 font-medium">{l.after}</span>
                        </div>
                        {l.approvalId && (
                          <button onClick={() => navigate('approvalDetail', { approvalId: l.approvalId })}
                            className="text-[11px] font-mono text-cyan-300 hover:underline mt-1">근거 {l.approvalId} →</button>
                        )}
                        {l.note && <div className="text-[10px] text-slate-500 mt-1">{l.note}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border-2 border-dashed border-slate-700/80 text-center text-xs text-slate-500">
                    이 주문의 변경 이력이 없어요 — 금액 변경은 결재 승인 시에만 이력이 적재돼요 (BS0007)
                  </div>
                )
              )}

              {panelTab === 'approvals' && (
                rels.length > 0 ? (
                  <div className="space-y-1.5">
                    {rels.map((a) => (
                      <button key={a.id} onClick={() => navigate('approvalDetail', { approvalId: a.id })}
                        className="w-full text-left p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-purple-500/40 transition">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-cyan-300">{a.id}</span>
                          <EnumPill status={a.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <EnumPill status={a.type} />
                          <Money value={a.type.includes('REFUND') ? -a.amount : a.amount} />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 truncate">{a.opinion} — {a.requester}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border-2 border-dashed border-slate-700/80 text-center text-xs text-slate-500">
                    관련 결재 문서가 없어요 — 금액 변경이 필요하면 환불 기안으로 시작하세요 (MG1001)
                  </div>
                )
              )}
            </div>
          );
        })()}
      </SidePanel>

      {/* 삭제 확인 — §4.6 중위험: 요약 카드 + 사유 필수 (MG1004) */}
      <ConfirmDialog
        open={!!deleteTarget} risk="mid" danger
        title="주문 삭제" confirmLabel="삭제 확정" cancelLabel="취소"
        message="삭제 시 변경 전/후 값·변경자·사유가 감사 로그로 기록됩니다 (MG1004)"
        summary={deleteTarget && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">{deleteTarget.id} · {deleteTarget.item}</span>
            <Money value={deleteTarget.amount} locked />
          </div>
        )}
        onConfirm={confirmDelete} onClose={() => setDeleteTarget(null)}
      >
        <div className="mb-2">
          <label className="block text-xs text-slate-400 mb-1.5">삭제 사유 <span className="text-rose-400">*</span></label>
          <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={2} placeholder="예: 테스트 오등록"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60 resize-none" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

window.OrderList = OrderList;
