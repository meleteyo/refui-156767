// kanban.jsx — 15 작업 칸반 보드 (update2) · UC15 · IDEA-13 칸반 촉감 규칙
// HTML5 DnD: 드는 순간 이동 가능 컬럼 하이라이트 + 불가 컬럼 페이드·사유(BS0005 사전 가드)
// 비허용 드롭 스냅백+토스트, 완료 스탬프 180ms, 보류 사유 모달, ]/[ 키보드 전이, F 내 카드
const { useState, useMemo, useEffect, useRef } = React;

const KB_ACCENT = {
  WAITING:     { dot: 'bg-slate-400',   head: 'text-slate-300' },
  IN_PROGRESS: { dot: 'bg-amber-400',   head: 'text-amber-300' },
  REVIEW:      { dot: 'bg-cyan-400',    head: 'text-cyan-300' },
  DONE:        { dot: 'bg-emerald-400', head: 'text-emerald-300' },
  ON_HOLD:     { dot: 'bg-amber-400',   head: 'text-amber-300' },
};

function Kanban({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, ENUM_META, Money, DdayBadge, SidePanel, fmt, ddayOf } = window;
  const payload = route.payload || {};
  const label = (s) => (ENUM_META[s] ? ENUM_META[s].label : s);

  const [tasks, setTasks] = useState(() => TASKS.map((t) => ({ ...t })));
  const [drag, setDrag] = useState(null);                 // { id, from }
  const [focusId, setFocusId] = useState(payload.taskId || null);
  const [panelId, setPanelId] = useState(null);
  const [holdModal, setHoldModal] = useState(null);       // { taskId }
  const [holdReason, setHoldReason] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteQ, setPaletteQ] = useState('');
  const [todayDone, setTodayDone] = useState(0);
  const [stampId, setStampId] = useState(null);
  const [shakeId, setShakeId] = useState(null);
  const [audit, setAudit] = useState([{ at: '09:42', text: '대기→진행중 · TSK-005 · 김도윤' }]);
  // 필터 — 부서 초깃값: 로그인 사용자 부서에 카드가 있으면 그 부서, 없으면 전체
  const myDept = (EMPLOYEES.find((e) => e.id === CURRENT_USER_ID) || {}).deptId;
  const [deptF, setDeptF] = useState(() =>
    (route.payload?.freelancerId || route.payload?.filter) ? 'ALL' // 딥링크 필터가 부서 기본값에 가려지지 않게
    : TASKS.some((t) => (ORDERS.find((o) => o.id === t.orderId) || {}).deptId === myDept) ? myDept : 'ALL');
  // 딥링크 payload 소비 — freelancers.jsx '진행 중 작업' { freelancerId } · home.jsx '기한 임박 작업' { filter: 'dueSoon' }
  const [assigneeF, setAssigneeF] = useState(() =>
    route.payload?.freelancerId && FREELANCERS.some((f) => f.id === route.payload.freelancerId) ? route.payload.freelancerId : 'ALL');
  const [dueSoon, setDueSoon] = useState(() => route.payload?.filter === 'dueSoon');
  const [myCards, setMyCards] = useState(false);

  const orderOf = (id) => ORDERS.find((o) => o.id === id) || null;
  const frOf = (id) => FREELANCERS.find((f) => f.id === id) || null;

  // 딥링크 포커스 카드 스크롤 (kanban payload { taskId })
  useEffect(() => {
    if (!payload.taskId) return;
    const el = document.getElementById(`kb-${payload.taskId}`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const visible = useMemo(() => tasks.filter((t) => {
    const o = orderOf(t.orderId);
    if (deptF !== 'ALL' && (!o || o.deptId !== deptF)) return false;
    if (assigneeF !== 'ALL' && t.assigneeId !== assigneeF) return false;
    if (dueSoon && t.status !== 'DONE' && ddayOf(t.dueDate) > 3) return false;
    if (myCards && (!o || o.managerId !== CURRENT_USER_ID)) return false;
    return true;
  }), [tasks, deptF, assigneeF, dueSoon, myCards]);

  const denyMsg = (from, to) =>
    TRANSITION_DENY_MESSAGES[`${from}>${to}`] || TRANSITION_DENY_MESSAGES[`${from}>*`] ||
    `${label(from)} → ${label(to)} 이동은 허용되지 않아요 (BS0005)`;

  const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  const commit = (taskId, to, reason) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const from = t.status;
    setTasks((ts) => ts.map((x) => (x.id === taskId ? { ...x, status: to, holdReason: to === 'ON_HOLD' ? reason : null } : x)));
    setAudit((a) => [{ at: nowHM(), text: `${label(from)}→${label(to)} · ${taskId} · 정다은` }, ...a].slice(0, 5));
    if (to === 'DONE') {
      setStampId(taskId);
      setTimeout(() => setStampId(null), 600);
      setTodayDone((n) => n + 1);
      window.toast(`'${t.title}' 완료 — 오늘 완료 ${todayDone + 1}건 ✓`, {
        actionLabel: '평가 입력 →', onAction: () => navigate('evalInput', { taskId }),
      });
    } else {
      window.toast(`${label(from)} → ${label(to)} 이동 · 이력 704 자동 기록 (MG1004)`);
    }
  };

  // 전이 시도 — 사전 가드 통과 못 하면 스냅백 + 실무 언어 토스트 + 규칙 보기 (IDEA-13)
  const attempt = (taskId, to) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.status === to) return;
    const allowed = (TRANSITION_RULES[t.status] || []).includes(to);
    if (!allowed) {
      setShakeId(taskId);
      setTimeout(() => setShakeId(null), 430);
      window.toast(denyMsg(t.status, to), { tone: 'error', actionLabel: '규칙 보기', onAction: () => setRulesOpen(true) });
      return;
    }
    if (to === 'ON_HOLD' && HOLD_REQUIRES_REASON) { setHoldReason(''); setHoldModal({ taskId }); return; }
    commit(taskId, to);
  };

  // 키보드: ]/[ 포커스 카드 전이 · F 내 카드 · ⌘K 팔레트 (§6.2 접근성 대체 경로)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); setPaletteQ(''); return; }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || palette || holdModal) return;
      if (e.key.toLowerCase() === 'f') { setMyCards((v) => !v); return; }
      if ((e.key === ']' || e.key === '[') && focusId) {
        const t = tasks.find((x) => x.id === focusId);
        if (!t) return;
        const idx = KANBAN_COLUMNS.indexOf(t.status);
        const to = KANBAN_COLUMNS[idx + (e.key === ']' ? 1 : -1)];
        if (to) attempt(focusId, to);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusId, tasks, palette, holdModal, todayDone]);

  const panelTask = tasks.find((t) => t.id === panelId) || null;
  const paletteHits = paletteQ
    ? tasks.filter((t) => {
        const o = orderOf(t.orderId); const f = frOf(t.assigneeId);
        return (t.title + t.id + t.orderId + (o ? o.clientName : '') + (f ? f.name : '')).toLowerCase().includes(paletteQ.toLowerCase());
      }).slice(0, 6)
    : tasks.slice(0, 5);

  const chips = [
    deptF !== 'ALL' && { k: 'dept', label: (DEPARTMENTS.find((d) => d.id === deptF) || {}).name, off: () => setDeptF('ALL') },
    assigneeF !== 'ALL' && { k: 'asg', label: `@${(frOf(assigneeF) || {}).name}`, off: () => setAssigneeF('ALL') },
    dueSoon && { k: 'due', label: '기한임박 D-3', off: () => setDueSoon(false) },
    myCards && { k: 'my', label: '내 카드', off: () => setMyCards(false) },
  ].filter(Boolean);

  return (
    <div className="space-y-4 pb-2">
      <style>{`
        @keyframes kbSnap{0%,100%{transform:translateX(0)}20%{transform:translateX(7px)}40%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}
        @keyframes kbStamp{0%{transform:scale(1.6);opacity:0}40%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:1}}
      `}</style>

      <PageHeader
        label="WORK · 칸반 보드" labelColor="purple" title="작업 칸반 보드"
        desc="드래그로 상태를 바꾸면 이동 가능한 컬럼만 밝아집니다 — 규칙(BS0005)은 잔소리가 아니라 촉감으로 (IDEA-13)"
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 font-medium">
              오늘 완료 <b className="font-mono">{todayDone}</b>건 <Icon name="check" className="w-3.5 h-3.5" />
            </span>
            <button onClick={() => { setPalette(true); setPaletteQ(''); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center gap-1.5">
              <Icon name="search" className="w-3.5 h-3.5" />검색 <kbd className="font-mono text-[10px] px-1 rounded bg-slate-700 text-slate-400">⌘K</kbd>
            </button>
          </>
        }
      />

      {/* 필터 바 */}
      <Card className="px-4 py-3 flex flex-wrap items-center gap-2">
        <select value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs outline-none focus:border-purple-500/60">
          <option value="ALL">담당자 전체</option>
          {FREELANCERS.filter((f) => tasks.some((t) => t.assigneeId === f.id)).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={deptF} onChange={(e) => setDeptF(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs outline-none focus:border-purple-500/60">
          <option value="ALL">부서 전체</option>
          {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={() => setDueSoon((v) => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${dueSoon ? 'bg-rose-500/15 text-rose-300 border-rose-500/40' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
          기한임박 D-3
        </button>
        <button onClick={() => setMyCards((v) => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${myCards ? 'bg-purple-500/20 text-purple-200 border-purple-500/40' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
          내 카드 <kbd className="font-mono text-[10px] px-1 rounded bg-slate-700/80 text-slate-400">F</kbd>
        </button>
        {chips.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 ml-1">활성 필터:
            {chips.map((c) => (
              <button key={c.k} onClick={c.off} className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/30 px-2 py-0.5 hover:bg-purple-500/25">
                {c.label} <Icon name="x" className="w-2.5 h-2.5" />
              </button>
            ))}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">표시 중 <b className="text-slate-300 font-mono">{visible.length}</b>건</span>
      </Card>

      {/* ── 5컬럼 보드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = visible.filter((t) => t.status === col);
          const sum = colTasks.reduce((s, t) => s + ((orderOf(t.orderId) || {}).amount || 0), 0);
          const ac = KB_ACCENT[col];
          const dragging = drag && drag.from !== col;
          const allowed = dragging && (TRANSITION_RULES[drag.from] || []).includes(col);
          const forbidden = dragging && !allowed;
          return (
            <div key={col}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (drag) attempt(drag.id, col); setDrag(null); }}
              className={`relative rounded-xl border flex flex-col min-h-[260px] transition-all ${
                allowed ? 'border-emerald-400/70 bg-emerald-500/5 ring-2 ring-emerald-400/30'
                : forbidden ? 'border-slate-800 bg-slate-900/40 opacity-40'
                : 'border-slate-700/60 bg-slate-900/60'}`}>
              {/* 불가 컬럼 — 페이드 + 사유 (BS0005 사전 가드) */}
              {forbidden && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 p-3 text-center pointer-events-none">
                  <span className="text-lg text-slate-400">⊘</span>
                  <span className="text-[11px] text-slate-300 leading-snug">{denyMsg(drag.from, col)}</span>
                </div>
              )}
              {allowed && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white pointer-events-none">
                  {col === 'ON_HOLD' ? '드롭 가능 · 사유 모달' : '드롭 가능'}
                </div>
              )}
              <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${ac.dot}`}></span>
                  <span className={`text-sm font-semibold ${ac.head}`}>{label(col)}</span>
                  <span className="text-xs font-mono text-slate-500">{colTasks.length}</span>
                </span>
                <span className="text-right"><Money value={sum} className="text-[11px] text-slate-400" /></span>
              </div>
              <div className="p-2.5 space-y-2 flex-1">
                {colTasks.map((t) => {
                  const o = orderOf(t.orderId);
                  const f = frOf(t.assigneeId);
                  const apr = o && o.activeApprovalId ? APPROVALS.find((a) => a.id === o.activeApprovalId) : null;
                  const isFocus = focusId === t.id;
                  return (
                    <div key={t.id} id={`kb-${t.id}`}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); setDrag({ id: t.id, from: t.status }); setFocusId(t.id); }}
                      onDragEnd={() => setDrag(null)}
                      onClick={() => { setFocusId(t.id); setPanelId(t.id); }}
                      style={shakeId === t.id ? { animation: 'kbSnap .43s ease' } : undefined}
                      className={`relative rounded-lg bg-slate-900 border p-2.5 cursor-grab active:cursor-grabbing transition hover:border-purple-500/40 ${
                        shakeId === t.id ? 'border-rose-500/70' : isFocus ? 'border-purple-400/70 ring-1 ring-purple-400/40' : 'border-slate-700/60'}`}>
                      {stampId === t.id && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-emerald-500/20">
                          <span className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center" style={{ animation: 'kbStamp .18s ease-out' }}>
                            <Icon name="check" className="w-5 h-5 text-white" />
                          </span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-[13px] font-medium leading-tight text-slate-200">{t.title}</span>
                        {t.priority === 'HIGH' && <EnumPill status="HIGH" className="shrink-0 !px-1.5 !py-0 text-[10px]" />}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 truncate">
                        <span className="font-mono">{t.orderId}</span>{o && <span> · {o.clientName}</span>}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <span className="text-[11px] text-slate-400 truncate">@{f ? f.name : '미배정'}</span>
                        {t.status === 'DONE'
                          ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-medium">완료 <Icon name="check" className="w-3 h-3" /></span>
                          : <DdayBadge date={t.dueDate} />}
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center justify-between gap-1">
                        {o && <Money value={o.amount} locked className="text-[11px]" />}
                        <span className="flex items-center gap-1">
                          {t.holdReason && (
                            <span className="inline-flex items-center rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[10px] max-w-[110px] truncate" title={t.holdReason}>
                              보류: {t.holdReason.split(' — ')[0]}
                            </span>
                          )}
                          {apr && (
                            <span className="relative group/apr">
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono">
                                APR-…{apr.id.slice(-3)} 결재진행중
                              </span>
                              <span className="absolute z-30 hidden group-hover/apr:block bottom-full right-0 mb-1.5 w-60 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-3 text-left">
                                <span className="block font-mono text-[11px] text-amber-300">{apr.id} · {label(apr.type)}</span>
                                <span className="block text-[11px] text-slate-300 mt-1">{apr.opinion}</span>
                                <span className="block text-[10px] text-slate-500 mt-1.5">승인선 {apr.approvalLine.filter((s) => s.status === 'APPROVED').length}/{apr.approvalLine.length}단계 완료 · 진행 중 결재가 있어 환불 기안이 차단됩니다</span>
                              </span>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-800 py-7 text-center text-[11px] text-slate-600">
                    {col === 'WAITING' ? '작업 그룹을 등록하면 여기서 시작돼요' : '카드 없음'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 이력 스트립 (MG1004 · 704) */}
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Icon name="shieldCheck" className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        상태 변경은 변경 이력(704)에 자동 기록됩니다 · 최근
        <button onClick={() => navigate('auditLog', {})} className="font-mono text-slate-300 hover:text-purple-300 hover:underline underline-offset-2">
          {audit[0].at} {audit[0].text}
        </button>
        <span className="ml-auto">포커스 카드에 <kbd className="font-mono px-1 rounded bg-slate-800">]</kbd>/<kbd className="font-mono px-1 rounded bg-slate-800">[</kbd> 키로 전이 · <kbd className="font-mono px-1 rounded bg-slate-800">F</kbd> 내 카드</span>
      </div>

      {/* ── 보류 사유 모달 (금지 대신 기록) ── */}
      {holdModal && (() => {
        const t = tasks.find((x) => x.id === holdModal.taskId);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-950/70" onClick={() => setHoldModal(null)}></div>
            <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
              <h3 className="text-lg font-bold">보류로 이동 — {t ? t.title : ''}</h3>
              <label className="block mt-3">
                <span className="text-xs text-slate-400">보류 사유 <span className="text-rose-400">*</span></span>
                <textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} rows={3} autoFocus
                  placeholder="예: 고객 피드백 대기"
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-amber-500/60 resize-none" />
              </label>
              <p className="text-[11px] text-slate-500 mt-1.5">보류 사유는 카드 배지로 남고 변경 이력(704)에 함께 기록됩니다.</p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setHoldModal(null)} className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">취소</button>
                <button disabled={!holdReason.trim()}
                  onClick={() => { commit(holdModal.taskId, 'ON_HOLD', holdReason.trim()); setHoldModal(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed">
                  보류
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 전이 규칙 팝오버 (규칙 보기) ── */}
      {rulesOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setRulesOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">상태 전이 규칙 <span className="font-mono text-xs text-slate-500">BS0005</span></h3>
              <button onClick={() => setRulesOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {KANBAN_COLUMNS.map((from) => (
                <div key={from} className="flex items-center gap-2 text-sm">
                  <EnumPill status={from} />
                  <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-600" />
                  {(TRANSITION_RULES[from] || []).length === 0
                    ? <span className="text-xs text-rose-300">이동 불가 — 완료 작업은 새 작업으로 등록</span>
                    : (TRANSITION_RULES[from] || []).map((to) => <EnumPill key={to} status={to} />)}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-4">보류(ON_HOLD) 진입은 사유 입력이 필수이며, 서버(taskStatus1001)에서도 전이를 재검증합니다.</p>
          </div>
        </div>
      )}

      {/* ── ⌘K 팔레트 (IDEA-03 경량) ── */}
      {palette && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-28 p-6">
          <div className="absolute inset-0 bg-slate-950/70" onClick={() => setPalette(false)}></div>
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
            <input autoFocus value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setPalette(false);
                if (e.key === 'Enter' && paletteHits[0]) {
                  const id = paletteHits[0].id; setPalette(false); setFocusId(id); setPanelId(id);
                  const el = document.getElementById(`kb-${id}`); if (el) el.scrollIntoView({ block: 'center' });
                }
              }}
              placeholder="작업명 · 주문번호 · 담당자 검색…"
              className="w-full bg-transparent border-b border-slate-800 px-4 py-3 text-sm outline-none" />
            <div className="max-h-72 overflow-y-auto p-1.5">
              {paletteHits.map((t) => {
                const o = orderOf(t.orderId);
                return (
                  <button key={t.id}
                    onClick={() => { setPalette(false); setFocusId(t.id); setPanelId(t.id); const el = document.getElementById(`kb-${t.id}`); if (el) el.scrollIntoView({ block: 'center' }); }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-slate-800/70">
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">{t.id}</span>
                    <span className="text-sm text-slate-200 truncate flex-1">{t.title}{o && <span className="text-slate-500 text-xs"> · {o.clientName}</span>}</span>
                    <EnumPill status={t.status} />
                  </button>
                );
              })}
              {paletteHits.length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-600">일치하는 작업이 없어요</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── 작업 상세 사이드 패널 ── */}
      <SidePanel
        open={!!panelTask} onClose={() => setPanelId(null)}
        title={panelTask ? panelTask.title : ''} subtitle={panelTask ? `${panelTask.id} · ${(WORK_GROUPS.find((g) => g.id === panelTask.workGroupId) || {}).name || ''}` : ''}
        footer={panelTask && (() => {
          const o = orderOf(panelTask.orderId);
          const blocked = o && o.activeApprovalId;
          return (
            <div className="flex items-center gap-2">
              <button disabled={!!blocked}
                title={blocked ? `진행 중 결재 ${o.activeApprovalId} — 완료 후 기안할 수 있어요 (이중 기안 차단)` : '주문ID·금액 프리필 기안 (IDEA-10)'}
                onClick={() => navigate('draft', { orderId: panelTask.orderId, type: 'PARTIAL_REFUND' })}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                환불 기안
              </button>
              <button onClick={() => navigate('assign', { taskIds: [panelTask.id] })}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
                배정 변경 →
              </button>
            </div>
          );
        })()}
      >
        {panelTask && (() => {
          const o = orderOf(panelTask.orderId);
          const f = frOf(panelTask.assigneeId);
          const asg = [...ASSIGNMENTS].reverse().find((a) => a.taskId === panelTask.id);
          return (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <EnumPill status={panelTask.status} />
                {panelTask.priority === 'HIGH' && <EnumPill status="HIGH" />}
                {panelTask.status !== 'DONE' && <DdayBadge date={panelTask.dueDate} />}
                <span className="text-xs text-slate-500 font-mono ml-auto">마감 {panelTask.dueDate}</span>
              </div>
              {panelTask.holdReason && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">보류 사유 — {panelTask.holdReason}</div>
              )}
              {o && (
                <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-slate-500">주문</span><span className="font-mono text-slate-300">{o.id}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-500">고객사</span><span className="text-slate-300">{o.clientName}</span></div>
                  <div className="flex justify-between text-xs items-center"><span className="text-slate-500">원 주문 금액</span><Money value={o.amount} locked /></div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">금액 변경은 결재로 진행돼요 (MG1001) — 좌측 하단 '환불 기안'으로 이동하세요</p>
                </div>
              )}
              <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-slate-500">담당</span><span className="text-slate-300">{f ? `${f.name} · ${f.specialty}` : '미배정'}</span></div>
                {asg && <div className="flex justify-between text-xs items-center"><span className="text-slate-500">스냅샷 단가 (BS0008)</span><Money value={asg.rateSnapshot} locked /></div>}
                {asg && <div className="flex justify-between text-xs"><span className="text-slate-500">배정</span><span className="font-mono text-slate-400">{asg.assignedAt}</span></div>}
              </div>
              <button onClick={() => navigate('orders', { orderId: panelTask.orderId })}
                className="text-xs text-cyan-300 hover:underline underline-offset-2 inline-flex items-center gap-1">
                주문 상세로 이동 <Icon name="external" className="w-3 h-3" />
              </button>
            </div>
          );
        })()}
      </SidePanel>
    </div>
  );
}

window.Kanban = Kanban;
