// assign.jsx — 14 작업 배정 (update2) · UC14/UC14-1 · IDEA-12 워크로드 배정 카드 + 일괄 배정 + 단가 스냅샷
// 1.배정할 작업(체크) → 2.담당자 후보(단가·부하 게이지·준수율·품질) → 3.기한 → n건 일괄 배정 / 배정 변경
const { useState, useMemo, useEffect } = React;

// 작업 유형 — TASKS에 유형 필드가 없어 그룹 기준 로컬 보강
const ASSIGN_TYPE_OF = {
  'WG-01': '영상 편집', 'WG-02': '블로그 체험단', 'WG-03': '광고 소재', 'WG-04': '인플루언서 시딩',
  'WG-05': '블로그 운영', 'WG-06': '촬영·보정', 'WG-07': '체험단 리뷰',
};
const ASSIGN_SORTS = [
  { key: 'onTime', label: '기한 준수율순' },
  { key: 'load', label: '진행 중 적은순' },
  { key: 'quality', label: '품질 점수순' },
  { key: 'rate', label: '단가 낮은순' },
];

// 부하 게이지 — 4건↑ amber, 6건↑ rose (표시만, 차단 없음 — 합의 2)
function LoadGauge({ n }) {
  const tone = n >= 6 ? 'bg-rose-400' : n >= 4 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <span className="inline-flex items-center gap-[3px]" title={`진행 중 ${n}건 — 4건 이상 amber · 6건 이상 rose (참고 표시, 배정 차단 없음)`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className={`w-1 h-3 rounded-sm ${i < n ? tone : 'bg-slate-700/70'}`}></span>
      ))}
    </span>
  );
}

function Assign({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, Money, DdayBadge, ConfirmDialog, fmt, ddayOf } = window;
  const payload = route.payload || {};

  const [tasks, setTasks] = useState(() => TASKS.map((t) => ({ ...t })));
  const [assignments, setAssignments] = useState(() => ASSIGNMENTS.map((a) => ({ ...a })));
  const [viewMode, setViewMode] = useState('UNASSIGNED');           // UNASSIGNED | ASSIGNED(배정 변경)
  const [groupFilter, setGroupFilter] = useState(payload.workGroupId || 'ALL');
  const [selected, setSelected] = useState(() => new Set(payload.taskIds || []));
  const [pick, setPick] = useState(() => {                           // 후보 프리랜서 — payload.freelancerId 프리셀렉트 (eval-report/freelancers 릴레이)
    const fid = route.payload?.freelancerId;
    return fid && FREELANCERS.some((f) => f.id === fid && f.active) ? fid : null;
  });

  // 릴레이 재진입(payload 변경) 시에도 프리셀렉트 동기화
  useEffect(() => {
    const fid = route.payload?.freelancerId;
    if (fid && FREELANCERS.some((f) => f.id === fid && f.active)) setPick(fid);
  }, [route.payload?.freelancerId]);
  const [sortKey, setSortKey] = useState('onTime');
  const [dueDate, setDueDate] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [undo, setUndo] = useState(null);                            // { prev, prevAsg, count, left }

  // 30초 되돌리기 카운트다운 (IDEA-16)
  useEffect(() => {
    if (!undo) return;
    const id = setInterval(() => {
      setUndo((u) => (u && u.left > 1 ? { ...u, left: u.left - 1 } : null));
    }, 1000);
    return () => clearInterval(id);
  }, [undo == null]);

  const unassignedCount = tasks.filter((t) => !t.assigneeId).length;

  const listTasks = useMemo(() => tasks.filter((t) => {
    if (viewMode === 'UNASSIGNED' ? t.assigneeId : !t.assigneeId) return false;
    if (viewMode === 'ASSIGNED' && (t.status === 'DONE')) return false; // 완료 작업은 변경 대상 제외
    if (groupFilter !== 'ALL' && t.workGroupId !== groupFilter) return false;
    return true;
  }), [tasks, viewMode, groupFilter]);

  const candidates = useMemo(() => {
    const arr = FREELANCERS.filter((f) => f.active);
    const cmp = {
      onTime: (a, b) => b.onTimeRate - a.onTimeRate,
      load: (a, b) => a.activeTasks - b.activeTasks,
      quality: (a, b) => b.qualityScore - a.qualityScore,
      rate: (a, b) => a.rate - b.rate,
    }[sortKey];
    return [...arr].sort(cmp);
  }, [sortKey]);

  const picked = FREELANCERS.find((f) => f.id === pick) || null;
  const selectedTasks = listTasks.filter((t) => selected.has(t.id));
  const asgOf = (taskId) => [...assignments].reverse().find((a) => a.taskId === taskId) || null;

  // 배정 변경 모드: 정확히 1건 선택 시 현재 배정 표시
  const changeTarget = viewMode === 'ASSIGNED' && selectedTasks.length === 1 ? selectedTasks[0] : null;
  const currentAsg = changeTarget ? asgOf(changeTarget.id) : null;
  const currentFr = currentAsg ? FREELANCERS.find((f) => f.id === currentAsg.freelancerId) : null;

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = listTasks.length > 0 && listTasks.every((t) => selected.has(t.id));

  const canAssign = viewMode === 'UNASSIGNED' && selectedTasks.length > 0 && picked && dueDate;
  const canReassign = viewMode === 'ASSIGNED' && changeTarget && picked && (!currentAsg || currentAsg.freelancerId !== pick);

  const doAssign = () => {
    const prev = tasks.map((t) => ({ ...t }));
    const prevAsg = assignments.map((a) => ({ ...a }));
    const ids = selectedTasks.map((t) => t.id);
    setTasks((ts) => ts.map((t) => ids.includes(t.id)
      ? { ...t, assigneeId: picked.id, dueDate, status: t.status === 'WAITING' ? 'IN_PROGRESS' : t.status }
      : t));
    setAssignments((as) => [...as, ...ids.map((tid, i) => ({
      id: `ASG-${String(as.length + i + 1).padStart(3, '0')}`, taskId: tid, freelancerId: picked.id,
      rateSnapshot: picked.rate, assignedAt: `${TODAY} 11:02`, assignedById: CURRENT_USER_ID,
    }))]);
    setConfirmOpen(false);
    setSelected(new Set());
    setUndo({ prev, prevAsg, count: ids.length, left: 30 });
    window.toast(`${ids.length}건 배정 완료 — 대기→진행중 자동 전환 (BS0005) · 단가 ₩${fmt(picked.rate)} 스냅샷 고정`, {
      actionLabel: '칸반에서 확인 →',
      onAction: () => navigate('kanban', { taskId: ids[0] }),
    });
  };

  const doReassign = () => {
    const t = changeTarget;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, assigneeId: picked.id, dueDate: dueDate || x.dueDate } : x)));
    setAssignments((as) => [...as, {
      id: `ASG-${String(as.length + 1).padStart(3, '0')}`, taskId: t.id, freelancerId: picked.id,
      rateSnapshot: picked.rate, assignedAt: `${TODAY} 11:02`, assignedById: CURRENT_USER_ID,
    }]);
    setSelected(new Set());
    window.toast(`'${t.title}' 배정 변경 — 이전 배정은 삭제 없이 이력으로 보존 (MG1004) · 새 스냅샷 ₩${fmt(picked.rate)}`, {
      actionLabel: '칸반에서 확인 →',
      onAction: () => navigate('kanban', { taskId: t.id }),
    });
  };

  const doUndo = () => {
    if (!undo) return;
    setTasks(undo.prev);
    setAssignments(undo.prevAsg);
    setUndo(null);
    window.toast('배정을 되돌렸어요 — 되돌림도 이력 704에 기록됩니다', { tone: 'warn' });
  };

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        label="WORK · 작업 배정" labelColor="purple" title="작업 배정"
        desc="단가·부하·준수율·품질을 한 화면에서 비교해 배정합니다 — '누가 여유 있나' 메신저 왕복을 끝냅니다 (IDEA-12)"
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              미배정 <b className="font-mono">{unassignedCount}</b>건
            </span>
            <button onClick={() => navigate('kanban', {})}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5">
              칸반 보드로 <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </button>
          </>
        }
      />

      {payload.batchId && (
        <div className="flex items-center gap-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3.5 py-2.5 text-xs text-cyan-200">
          <Icon name="zap" className="w-3.5 h-3.5 shrink-0" />
          업로드 배치 <span className="font-mono">{payload.batchId}</span> 릴레이로 진입 — 미배정 작업이 프리필되었습니다 (IDEA-16)
        </div>
      )}

      {/* ── 1. 배정할 작업 ── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SectionLabel color="purple">1 · 배정할 작업</SectionLabel>
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs">
            {[['UNASSIGNED', '미배정'], ['ASSIGNED', '배정됨 (변경)']].map(([k, l]) => (
              <button key={k} onClick={() => { setViewMode(k); setSelected(new Set()); }}
                className={`px-3 py-1.5 rounded-md font-medium transition ${viewMode === k ? 'bg-purple-500/20 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            작업 그룹
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs outline-none focus:border-purple-500/60">
              <option value="ALL">전체</option>
              {WORK_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-950/60 border-b border-slate-800">
                <th className="px-3 py-2.5 w-8">
                  <input type="checkbox" checked={allChecked} className="accent-purple-500"
                    onChange={() => setSelected(allChecked ? new Set() : new Set(listTasks.map((t) => t.id)))} />
                </th>
                <th className="px-2 py-2.5 font-medium">작업명</th>
                <th className="px-2 py-2.5 font-medium">주문 번호</th>
                <th className="px-2 py-2.5 font-medium">작업 유형</th>
                <th className="px-2 py-2.5 font-medium">상태</th>
                <th className="px-3 py-2.5 font-medium">기한</th>
              </tr>
            </thead>
            <tbody>
              {listTasks.map((t) => {
                const on = selected.has(t.id);
                return (
                  <tr key={t.id} onClick={() => toggle(t.id)}
                    className={`border-b border-slate-800/60 last:border-0 cursor-pointer transition ${on ? 'bg-purple-500/10' : 'hover:bg-slate-800/40'}`}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={on} readOnly className="accent-purple-500 pointer-events-none" /></td>
                    <td className="px-2 py-2.5">
                      <span className="font-medium text-slate-200">{t.title}</span>
                      {t.priority === 'HIGH' && <EnumPill status="HIGH" className="ml-2" />}
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); navigate('orders', { orderId: t.orderId }); }}
                        className="font-mono text-xs text-cyan-300 hover:underline underline-offset-2">{t.orderId}</button>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-slate-400">{ASSIGN_TYPE_OF[t.workGroupId] || '일반'}</td>
                    <td className="px-2 py-2.5"><EnumPill status={t.status} /></td>
                    <td className="px-3 py-2.5"><span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">{t.dueDate.slice(5)}<DdayBadge date={t.dueDate} /></span></td>
                  </tr>
                );
              })}
              {listTasks.length === 0 && (
                <tr><td colSpan="6" className="px-3 py-8 text-center text-xs text-slate-600">
                  {viewMode === 'UNASSIGNED' ? '미배정 작업이 없어요 — 작업 그룹을 먼저 등록하면 여기서 배정이 시작돼요' : '변경 가능한 배정 작업이 없어요'}
                  <button onClick={() => navigate('workGroups', {})} className="ml-2 text-purple-300 hover:underline underline-offset-2">작업 그룹으로 →</button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2.5 text-right text-xs text-slate-500">선택 <b className="text-purple-300 font-mono">{selectedTasks.length}</b>건</div>
      </Card>

      {/* ── 현재 배정 (배정 변경 시에만) ── */}
      {changeTarget && currentAsg && (
        <Card className="p-4 border-cyan-500/30 bg-cyan-500/5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <SectionLabel color="cyan">현재 배정</SectionLabel>
            <span className="text-slate-300">담당 <b>{currentFr ? currentFr.name : '—'}</b></span>
            <span className="text-slate-400 inline-flex items-center gap-1.5">스냅샷 단가 <Money value={currentAsg.rateSnapshot} locked /></span>
            <span className="text-slate-400">기한 <span className="font-mono">{changeTarget.dueDate.slice(5)}</span> <DdayBadge date={changeTarget.dueDate} /></span>
            {currentFr && (
              <span className={`text-xs ${currentFr.rate !== currentAsg.rateSnapshot ? 'text-amber-300' : 'text-slate-500'}`}>
                마스터 현재 단가 ₩{fmt(currentFr.rate)} — {currentFr.rate !== currentAsg.rateSnapshot ? '스냅샷과 다름 (단가 대조)' : '스냅샷과 일치'}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Icon name="info" className="w-3 h-3" />변경 시 이전 배정은 삭제되지 않고 변경 이력으로 기록됩니다 (MG1004 · 이력 704)
          </p>
        </Card>
      )}

      {/* ── 2. 담당자 후보 ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel color="purple">2 · 담당자 후보 · taskAssign1001</SectionLabel>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            정렬
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs outline-none focus:border-purple-500/60">
              {ASSIGN_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <div className="rounded-lg border border-slate-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-950/60 border-b border-slate-800">
                <th className="px-3 py-2.5 w-8"></th>
                <th className="px-2 py-2.5 font-medium">이름</th>
                <th className="px-2 py-2.5 font-medium">유형</th>
                <th className="px-2 py-2.5 font-medium text-right">단가</th>
                <th className="px-2 py-2.5 font-medium">진행 중</th>
                <th className="px-2 py-2.5 font-medium text-right">준수율</th>
                <th className="px-3 py-2.5 font-medium text-right">품질</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((f) => {
                const on = pick === f.id;
                const isCur = currentAsg && currentAsg.freelancerId === f.id;
                return (
                  <tr key={f.id} onClick={() => setPick(f.id)}
                    className={`border-b border-slate-800/60 last:border-0 cursor-pointer transition ${on ? 'bg-purple-500/10' : 'hover:bg-slate-800/40'}`}>
                    <td className="px-3 py-3">
                      <span className={`inline-flex w-4 h-4 rounded-full border-2 items-center justify-center ${on ? 'border-purple-400' : 'border-slate-600'}`}>
                        {on && <span className="w-2 h-2 rounded-full bg-purple-400"></span>}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="font-medium text-slate-200">{f.name}{isCur && <span className="ml-1.5 text-[10px] text-cyan-300">현재 담당</span>}</div>
                      <div className="text-[11px] text-slate-500">{f.specialty}</div>
                    </td>
                    <td className="px-2 py-3 text-xs text-slate-400">{f.specialty.includes('인플루언서') ? '인플루언서' : '프리랜서'}</td>
                    <td className="px-2 py-3 text-right"><Money value={f.rate} /><div className="text-[10px] text-slate-600">{f.rateType === 'FIXED' ? '건당 고정' : '변동 단가'}</div></td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs ${f.activeTasks >= 6 ? 'text-rose-300' : f.activeTasks >= 4 ? 'text-amber-300' : 'text-slate-300'}`}>{f.activeTasks}건</span>
                        <LoadGauge n={f.activeTasks} />
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-xs">
                      <span className={f.onTimeRate >= 95 ? 'text-emerald-300' : f.onTimeRate >= 90 ? 'text-slate-300' : 'text-amber-300'}>{f.onTimeRate}%</span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-300"><Icon name="star" className="w-3 h-3 text-amber-300" />{f.qualityScore.toFixed(1)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {picked ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 text-xs text-purple-200">
            <Icon name="lock" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>선택한 단가 <b className="font-mono">₩{fmt(picked.rate)}</b>이 이 배정에 스냅샷으로 고정됩니다 <span className="font-mono text-purple-300/80">(BS0008)</span>.
              이후 마스터 단가를 바꿔도 이 배정의 외주비 계산에는 영향이 없습니다.</span>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-500">부하 게이지는 참고 표시일 뿐 배정을 차단하지 않아요 — 배정 판단은 작업 관리자의 몫입니다 (자동 배정 미도입)</p>
        )}
      </Card>

      {/* ── 3. 기한 지정 + 액션 ── */}
      <Card className="p-5">
        <SectionLabel color="purple">3 · 기한 지정</SectionLabel>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            작업 기한 <span className="text-rose-400">*</span>
            <input type="date" min={TODAY} value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60" />
          </label>
          {dueDate && <DdayBadge date={dueDate} />}
          {dueDate && ddayOf(dueDate) <= 5 && <span className="text-[11px] text-amber-300">기한이 {ddayOf(dueDate)}일 남았어요 — 후보 부하를 다시 확인하세요</span>}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Icon name="info" className="w-3 h-3 shrink-0" />
            배정 시 작업 상태는 대기→진행중으로 자동 전환됩니다 (BS0005) · 프리랜서 통지는 시스템 밖(메신저/이메일)으로 별도 안내하세요
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={doReassign} disabled={!canReassign}
              title={viewMode !== 'ASSIGNED' ? "'배정됨' 보기에서만 활성화됩니다" : ''}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
              배정 변경
            </button>
            <button onClick={() => setConfirmOpen(true)} disabled={!canAssign}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
              <Icon name="users" className="w-4 h-4" />{selectedTasks.length || ''}건 일괄 배정
            </button>
          </div>
        </div>
      </Card>

      {/* 30초 되돌리기 배너 (IDEA-16) */}
      {undo && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-600 shadow-2xl px-4 py-2.5 text-sm">
          <Icon name="refresh" className="w-4 h-4 text-amber-300" />
          <span className="text-slate-200">{undo.count}건 배정됨 · <span className="font-mono text-amber-300">{undo.left}초</span> 안에 되돌릴 수 있어요</span>
          <button onClick={doUndo} className="font-semibold text-amber-300 hover:text-amber-200">되돌리기</button>
        </div>
      )}

      {/* 일괄 배정 확인 — 중위험: 총계 대조 카드 (§4.6) */}
      <ConfirmDialog
        open={confirmOpen} risk="mid" title="일괄 배정"
        message="배정 등록 + 단가 스냅샷(BS0008) + 상태 전이(BS0005)가 이력 704와 함께 기록됩니다."
        summary={picked && (
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">대상 작업</span><span className="font-mono">{selectedTasks.length}건</span></div>
            <div className="flex justify-between"><span className="text-slate-400">담당</span><b>{picked.name}</b></div>
            <div className="flex justify-between"><span className="text-slate-400">스냅샷 단가 🔒</span><Money value={picked.rate} /></div>
            <div className="flex justify-between border-t border-slate-800 pt-1 mt-1"><span className="text-slate-400">외주비 예상 ({selectedTasks.length}건 × ₩{fmt(picked.rate)})</span><Money value={picked.rate * selectedTasks.length} /></div>
            <div className="flex justify-between"><span className="text-slate-400">기한</span><span className="font-mono">{dueDate}</span></div>
          </div>
        )}
        confirmLabel="배정 확정" onConfirm={doAssign} onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

window.Assign = Assign;
