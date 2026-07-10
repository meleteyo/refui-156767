// work-groups.jsx — 13 작업 그룹 관리 (entry1) · UC13/UC13-1
// 좌: 무소속 주문 체크 선택 / 우: 그룹 구성 미리보기 → 등록·구성 변경·해제 + "저장 후 배정하기 →" 릴레이 (IDEA-12/16)
const { useState, useMemo, useEffect } = React;

// 작업 유형 — data.js에 별도 전역이 없어 화면 로컬 보강
const WG_TASK_TYPES = ['블로그 콘텐츠', '인플루언서 캠페인', '영상 편집', '디자인·상세페이지', '촬영·보정'];
const WG_PLATFORM_LABEL = { SMARTSTORE: '스마트스토어', COUPANG: '쿠팡', EMAIL: '이메일', MANUAL: '수동 등록' };
// 기존 그룹 최근 변경 이력 요약 — AUDIT_LOGS에 그룹 이력이 없어 로컬 보강 (MG1004 · 704)
const WG_LAST_MODIFIED = {
  'WG-01': '2026-07-02 09:00 · 박준혁 — 구성 변경 (썸네일 작업 추가)',
  'WG-02': '2026-07-03 09:28 · 박준혁 — 그룹 등록',
  'WG-03': '2026-07-05 10:55 · 서지원 — 그룹 등록',
  'WG-04': '2026-07-06 14:05 · 정하은 — 그룹 등록',
  'WG-05': '2026-07-04 13:40 · 한소율 — 기한 변경 (07-25 → 07-31)',
  'WG-06': '2026-07-02 16:50 · 박준혁 — 그룹 등록',
  'WG-07': '2026-07-08 16:10 · 박준혁 — 그룹 등록',
};

function WorkGroups({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, Money, DdayBadge, ConfirmDialog, EmptyState, fmt } = window;

  // 그룹은 로컬 복사 — orderIds 배열로 정규화 (data.js WORK_GROUPS는 주문 1건 연결)
  const [groups, setGroups] = useState(() => WORK_GROUPS.map((g) => ({ ...g, orderIds: [g.orderId] })));
  const [groupId, setGroupId] = useState(null);            // null = 신규 그룹
  const [form, setForm] = useState({ name: '', taskType: WG_TASK_TYPES[0], dueDate: '' });
  const [memberIds, setMemberIds] = useState([]);          // 미리보기 구성 주문
  const [platform, setPlatform] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [applied, setApplied] = useState({ platform: 'ALL', keyword: '' });
  const [dissolveOpen, setDissolveOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const editing = groupId != null;
  const group = groups.find((g) => g.id === groupId) || null;

  // 그룹 선택 변경 → 우측 폼 로드
  useEffect(() => {
    if (group) {
      setForm({ name: group.name, taskType: WG_TASK_TYPES[0], dueDate: group.dueDate });
      setMemberIds([...group.orderIds]);
    } else {
      setForm({ name: '', taskType: WG_TASK_TYPES[0], dueDate: '' });
      setMemberIds([]);
    }
    setTouched(false);
  }, [groupId]);

  // 무소속 주문 = 어느 그룹에도 속하지 않고 환불·취소 아닌 주문 (workGroup1001)
  const groupedIds = useMemo(() => new Set(groups.flatMap((g) => g.orderIds)), [groups]);
  const poolOrders = useMemo(
    () => ORDERS.filter((o) => (!groupedIds.has(o.id) || memberIds.includes(o.id)) && !['REFUNDED', 'CANCELLED'].includes(o.status)),
    [groupedIds, memberIds]
  );
  const listOrders = useMemo(() => poolOrders.filter((o) => {
    if (applied.platform !== 'ALL' && o.platform !== applied.platform) return false;
    if (applied.keyword && !(o.id + o.item + o.clientName).toLowerCase().includes(applied.keyword.toLowerCase())) return false;
    return true;
  }), [poolOrders, applied]);

  const memberOrders = memberIds.map((id) => ORDERS.find((o) => o.id === id)).filter(Boolean);
  const sumAmount = memberOrders.reduce((s, o) => s + o.amount, 0);

  // 해제·제외 가드: 진행중 이후 상태(BS0005) 배정 작업 존재 시 비활성 (합의 3)
  const activeTasks = useMemo(
    () => (group ? TASKS.filter((t) => t.workGroupId === group.id && t.status !== 'WAITING') : []),
    [group]
  );
  const guarded = activeTasks.length > 0;
  const guardTip = `진행 중 작업 ${activeTasks.length}건 — 배정 해제 후 가능 (BS0005)`;

  const toggleMember = (oid) => {
    setTouched(true);
    setMemberIds((ids) => (ids.includes(oid) ? ids.filter((x) => x !== oid) : [...ids, oid]));
  };
  const allChecked = listOrders.length > 0 && listOrders.every((o) => memberIds.includes(o.id));
  const toggleAll = () => {
    setTouched(true);
    setMemberIds((ids) => (allChecked ? ids.filter((x) => !listOrders.some((o) => o.id === x)) : [...new Set([...ids, ...listOrders.map((o) => o.id)])]));
  };

  const valid = form.name.trim() && form.taskType && form.dueDate && memberIds.length > 0;

  const doCreate = (relay) => {
    const id = `WG-${String(groups.length + 1).padStart(2, '0')}`;
    setGroups((gs) => [...gs, { id, name: form.name.trim(), orderId: memberIds[0], orderIds: [...memberIds], deptId: 'DEPT-1', ownerId: CURRENT_USER_ID, taskCount: memberIds.length, doneCount: 0, dueDate: form.dueDate }]);
    window.toast(`그룹 '${form.name.trim()}' 등록 — 작업 ${memberIds.length}건 생성(대기 · BS0005) · 이력 704 기록`, {
      actionLabel: `${memberIds.length}건 배정하기 →`,
      onAction: () => navigate('assign', { workGroupId: id }),
    });
    if (relay) navigate('assign', { workGroupId: id });
    else { setGroupId(null); setMemberIds([]); setForm({ name: '', taskType: WG_TASK_TYPES[0], dueDate: '' }); }
  };

  const doUpdate = (relay) => {
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, name: form.name.trim(), dueDate: form.dueDate, orderIds: [...memberIds], taskCount: memberIds.length } : g)));
    window.toast(`'${form.name.trim()}' 구성 변경 저장 — 변경 전/후 값 이력 704 기록 (MG1004) · 기한은 대기 작업에만 일괄 반영`, {
      actionLabel: '배정 화면에서 확인 →',
      onAction: () => navigate('assign', { workGroupId: groupId }),
    });
    if (relay) navigate('assign', { workGroupId: groupId });
    setTouched(false);
  };

  const doDissolve = () => {
    const name = group.name;
    setGroups((gs) => gs.filter((g) => g.id !== groupId));
    setDissolveOpen(false);
    setGroupId(null);
    window.toast(`그룹 '${name}' 해제 — 주문 ${memberIds.length}건 미배정 복귀 · 해제 사유 포함 이력 704 기록`, {
      actionLabel: '변경 이력 보기 →',
      onAction: () => navigate('auditLog', {}),
    });
  };

  return (
    <div className="space-y-5 pb-2">
      <PageHeader
        label="WORK · 작업 그룹" labelColor="purple" title="작업 그룹 관리"
        desc="관련 주문 다건을 하나의 작업 그룹으로 묶고, 그룹 단위 작업 유형·기한을 확정합니다 — 저장 즉시 배정으로 이어집니다 (UC13)"
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">그룹 선택</span>
            <select value={groupId || ''} onChange={(e) => setGroupId(e.target.value || null)}
              className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60">
              <option value="">신규 그룹</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.orderIds.length}건)</option>)}
            </select>
          </label>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── 좌: 무소속 주문 ── */}
        <Card className="xl:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel color="purple">무소속 주문 · workGroup1001</SectionLabel>
            <span className="text-xs text-slate-500">주문은 동시에 1개 그룹에만 소속됩니다</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs outline-none focus:border-purple-500/60">
              <option value="ALL">플랫폼 전체</option>
              {[...new Set(ORDERS.map((o) => o.platform))].map((p) => <option key={p} value={p}>{WG_PLATFORM_LABEL[p] || p}</option>)}
            </select>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setApplied({ platform, keyword })}
              placeholder="주문번호 · 주문명 검색" className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs outline-none focus:border-purple-500/60" />
            <button onClick={() => setApplied({ platform, keyword })}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5">
              <Icon name="search" className="w-3.5 h-3.5" />조회
            </button>
          </div>

          {listOrders.length === 0 ? (
            <EmptyState icon="layers" title="묶을 수 있는 무소속 주문이 없어요"
              description="주문을 먼저 등록하면 여기서 그룹으로 묶을 수 있어요 — 모든 주문이 이미 그룹에 소속돼 있을 수도 있습니다."
              actionLabel="주문 등록으로 →" onAction={() => navigate('orderForm', {})} />
          ) : (
            <div className="rounded-lg border border-slate-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-950/60 border-b border-slate-800">
                    <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-purple-500" /></th>
                    <th className="px-2 py-2.5 font-medium">주문번호</th>
                    <th className="px-2 py-2.5 font-medium">주문명</th>
                    <th className="px-2 py-2.5 font-medium">상태</th>
                    <th className="px-3 py-2.5 font-medium text-right">금액 🔒</th>
                  </tr>
                </thead>
                <tbody>
                  {listOrders.map((o) => {
                    const on = memberIds.includes(o.id);
                    return (
                      <tr key={o.id} onClick={() => toggleMember(o.id)}
                        className={`border-b border-slate-800/60 last:border-0 cursor-pointer transition ${on ? 'bg-purple-500/10' : 'hover:bg-slate-800/40'}`}>
                        <td className="px-3 py-2.5"><input type="checkbox" checked={on} readOnly className="accent-purple-500 pointer-events-none" /></td>
                        <td className="px-2 py-2.5 font-mono text-xs text-slate-400">{o.id}</td>
                        <td className="px-2 py-2.5">
                          <div className="font-medium text-slate-200">{o.item}</div>
                          <div className="text-[11px] text-slate-500">{o.clientName} · {WG_PLATFORM_LABEL[o.platform] || o.platform}</div>
                        </td>
                        <td className="px-2 py-2.5"><EnumPill status={o.status} /></td>
                        <td className="px-3 py-2.5 text-right"><Money value={o.amount} locked /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>결과 <b className="text-slate-300 font-mono">{listOrders.length}</b>건</span>
            <span className="font-mono">‹ 1 ›</span>
          </div>
        </Card>

        {/* ── 우: 그룹 구성 미리보기 ── */}
        <Card className="xl:col-span-2 p-5 self-start">
          <div className="flex items-center justify-between mb-4">
            <SectionLabel color="pink">그룹 구성 미리보기</SectionLabel>
            {editing && <span className="text-[11px] font-mono text-slate-500">{group.id} · 수정 모드</span>}
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-400">그룹명 <span className="text-rose-400">*</span></span>
              <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setTouched(true); }}
                placeholder="예: 9월 뷰티 인플루언서 캠페인"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-400">작업 유형 <span className="text-rose-400">*</span></span>
                <select value={form.taskType} onChange={(e) => { setForm({ ...form, taskType: e.target.value }); setTouched(true); }}
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-2 text-sm outline-none focus:border-purple-500/60">
                  {WG_TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">작업 기한 <span className="text-rose-400">*</span></span>
                <div className="mt-1 flex items-center gap-2">
                  <input type="date" min={TODAY} value={form.dueDate} onChange={(e) => { setForm({ ...form, dueDate: e.target.value }); setTouched(true); }}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-sm outline-none focus:border-purple-500/60" />
                  {form.dueDate && <DdayBadge date={form.dueDate} />}
                </div>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">그룹 기한은 소속 작업 기한의 초깃값 — 기한 변경은 미배정(대기) 작업에만 일괄 반영됩니다</p>

            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">선택 주문</span>
                <span className="font-mono font-bold text-slate-100">{memberIds.length} 건</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 inline-flex items-center gap-1.5">매출 합계
                  <span title={`합산 검산 통과 · 집계 기준 ${AGGREGATED_AT} · 대상 주문 ${memberIds.length}건`}>
                    <Icon name="check" className="w-3 h-3 text-emerald-400" />
                  </span>
                </span>
                <Money value={sumAmount} size="md" locked />
              </div>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {memberOrders.length === 0 && <div className="text-xs text-slate-600 text-center py-4 border border-dashed border-slate-800 rounded-lg">좌측에서 주문을 체크하면 여기에 쌓입니다</div>}
              {memberOrders.map((o) => {
                const lock = editing && guarded && group.orderIds.includes(o.id);
                return (
                  <div key={o.id} className="flex items-center gap-2 rounded-lg bg-slate-800/40 border border-slate-700/50 px-2.5 py-2 text-xs">
                    <span className="font-mono text-slate-500 shrink-0">{o.id}</span>
                    <span className="truncate flex-1 text-slate-300">{o.item}</span>
                    <button onClick={() => !lock && toggleMember(o.id)} disabled={lock} title={lock ? guardTip : '미리보기에서 제거'}
                      className={`shrink-0 px-2 py-0.5 rounded ${lock ? 'text-slate-600 cursor-not-allowed' : 'text-rose-300 hover:bg-rose-500/15'}`}>
                      제외
                    </button>
                  </div>
                );
              })}
            </div>
            {editing && guarded && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-[11px] text-amber-200">
                <Icon name="alert" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{guardTip} · <button onClick={() => navigate('assign', { workGroupId: group.id })} className="underline underline-offset-2 hover:text-amber-100">배정 화면으로 →</button></span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── 하단 고정 액션 바 (IDEA-12 문법) ── */}
      <div className="sticky bottom-4 z-20">
        <Card className="px-5 py-3.5 bg-slate-900/95 backdrop-blur border-slate-600/60 shadow-2xl flex flex-wrap items-center gap-3">
          {editing ? (
            <span className="text-[11px] text-slate-500">마지막 변경 <span className="text-slate-300">{WG_LAST_MODIFIED[group.id] || '기록 없음'}</span> <span className="font-mono">· 이력 704</span></span>
          ) : (
            <span className="text-[11px] text-slate-500">그룹 등록 시 소속 작업이 <b className="text-slate-300">대기</b> 상태로 생성됩니다 (BS0005) · 등록·변경·해제는 예외 없이 이력 704(MG1004)로 기록</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {editing && (
              <button onClick={() => setDissolveOpen(true)} disabled={guarded} title={guarded ? guardTip : '그룹 해제 — 주문 미배정 복귀'}
                className="px-4 py-2 rounded-lg text-sm font-medium text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                그룹 해제
              </button>
            )}
            {editing ? (
              <button onClick={() => doUpdate(false)} disabled={!valid || !touched}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                구성 변경 저장
              </button>
            ) : (
              <button onClick={() => doCreate(false)} disabled={!valid}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                그룹 등록
              </button>
            )}
            <button onClick={() => (editing ? doUpdate(true) : doCreate(true))} disabled={!valid || (editing && !touched)}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
              저장 후 배정하기 <Icon name="arrowRight" className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>

      {/* 그룹 해제 확인 — 중위험: 그룹명·건수 재표시 (§4.6) */}
      <ConfirmDialog
        open={dissolveOpen} risk="mid" danger title="그룹 해제"
        message="소속 주문은 미배정으로 복귀하고, 해제 사유가 이력 704(MG1004)에 기록됩니다."
        summary={group && (
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">그룹명</span><b>{group.name}</b></div>
            <div className="flex justify-between"><span className="text-slate-400">소속 주문</span><span className="font-mono">{memberIds.length}건</span></div>
            <div className="flex justify-between"><span className="text-slate-400">매출 합계</span><Money value={sumAmount} /></div>
          </div>
        )}
        confirmLabel="해제 확정" onConfirm={doDissolve} onClose={() => setDissolveOpen(false)}
      />
    </div>
  );
}

window.WorkGroups = WorkGroups;
