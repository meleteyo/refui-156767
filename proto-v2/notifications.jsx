// notifications.jsx — 공통-2 알림 센터 (IDEA-17 스레드 그룹핑 · IDEA-03)
// 같은 결재(approvalId)의 연속 알림을 스레드 1줄로 묶고, 펼치면 7연쇄 순 타임라인.
// 이메일 3상태(✉ 발송됨 / 인앱만 / ✉ 실패 — BS0011 비동기, 업무 반영과 무관)를 병기한다.
const { useState, useEffect, useMemo, useRef } = React;

// 알림 kind → 라벨 · 카테고리(탭) · 색
const KIND_META = {
  APPROVAL_REQUEST:  { label: '결재 요청',   cat: 'APPROVAL', color: 'amber' },
  APPROVAL_STEP:     { label: '결재 진행',   cat: 'APPROVAL', color: 'amber' },
  APPROVAL_REJECTED: { label: '반려',        cat: 'APPROVAL', color: 'rose' },
  APPROVAL_DONE:     { label: '반영 완료',   cat: 'CHAIN',    color: 'emerald' },
  SALES_REFLECT:     { label: '매출 반영',   cat: 'CHAIN',    color: 'emerald' },
  SETTLEMENT_RECALC: { label: '정산 재계산', cat: 'CHAIN',    color: 'cyan' },
  IMPORT_DONE:       { label: '수집 완료',   cat: 'CHAIN',    color: 'cyan' },
  TASK_REVIEW:       { label: '검수 요청',   cat: 'DEADLINE', color: 'amber' },
  DEADLINE:          { label: '기한 임박',   cat: 'DEADLINE', color: 'amber' },
};
// 스레드 펼침 시 7연쇄 순 정렬 랭크
const CHAIN_RANK = { APPROVAL_REQUEST: 1, APPROVAL_STEP: 2, APPROVAL_REJECTED: 3, APPROVAL_DONE: 4, SALES_REFLECT: 5, SETTLEMENT_RECALC: 6 };

function Notifications({ route, navigate, tweaks }) {
  const { Card, SectionLabel, PageHeader, EnumPill, Icon, DdayBadge, fmt, ddayOf, toast } = window;

  // 기한 임박 알림 — 일 배치(스케줄러)가 705 재발송하는 케이스를 TASKS에서 로컬 파생 (D-2 기준 §4.4)
  const derivedDeadlines = useMemo(() => TASKS
    .filter((t) => ['WAITING', 'IN_PROGRESS', 'REVIEW'].includes(t.status) && ddayOf(t.dueDate) <= 2)
    .map((t) => {
      const fr = FREELANCERS.find((f) => f.id === t.assigneeId);
      return {
        id: `NTF-D-${t.id}`, at: `${TODAY} 06:00`, kind: 'DEADLINE',
        title: `D-${Math.max(ddayOf(t.dueDate), 0)} 임박 — ${t.title} (${t.id})`,
        body: `기한 ${t.dueDate} · 담당 ${fr ? fr.name : '미배정'}`,
        approvalId: null, dueDate: t.dueDate, read: false, emailStatus: 'NONE',
        route: { name: 'kanban', payload: { taskId: t.id } },
      };
    }), []);

  const [items, setItems] = useState(() => [...NOTIFICATIONS, ...derivedDeadlines]);
  const [tab, setTab] = useState('ALL');                 // ALL | APPROVAL | CHAIN | DEADLINE
  const [unreadOnly, setUnreadOnly] = useState(!route?.payload?.approvalId); // 초깃값 켬 (딥링크 진입 시 끔)
  const [expanded, setExpanded] = useState(() => route?.payload?.approvalId ? { [route.payload.approvalId]: true } : {});
  const [muted, setMuted] = useState({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  // 폴링 30초 (BS0011) + 15초 뒤 새 알림 1건 수신 시뮬레이션
  const [polledAt, setPolledAt] = useState(AGGREGATED_AT.slice(11));
  useEffect(() => {
    const poll = setInterval(() => setPolledAt(new Date().toTimeString().slice(0, 5)), 30000);
    const sim = setTimeout(() => {
      setItems((s) => s.some((n) => n.id === 'NTF-SIM-01') ? s : [{
        id: 'NTF-SIM-01', at: `${TODAY} 11:31`, kind: 'APPROVAL_REQUEST',
        title: '새 결재 도착 — APR-2026-00147 단가변경 ₩90,000', body: '최민준 단가 인상 — 2단계 정다은 차례',
        approvalId: 'APR-2026-00147', read: false, emailStatus: 'QUEUED',
        route: { name: 'approvalDetail', payload: { approvalId: 'APR-2026-00147' } },
      }, ...s]);
      toast('새 알림 1건 — 결재 요청이 도착했어요', { actionLabel: '결재 상세 →', onAction: () => navigate('approvalDetail', { approvalId: 'APR-2026-00147' }) });
    }, 15000);
    return () => { clearInterval(poll); clearTimeout(sim); };
  }, []);

  const unreadCount = items.filter((n) => !n.read && !muted[n.approvalId || n.id]).length;

  // ── 스레드 그룹핑 (IDEA-17) — approvalId 단위, 2건 이상이면 묶음 ─────────
  const units = useMemo(() => {
    const map = new Map();
    items.forEach((n) => {
      const key = n.approvalId || n.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    });
    return Array.from(map.entries()).map(([key, list]) => {
      const sorted = [...list].sort((a, b) =>
        a.at === b.at ? (CHAIN_RANK[a.kind] || 9) - (CHAIN_RANK[b.kind] || 9) : a.at.localeCompare(b.at));
      return {
        key, list: sorted, latest: sorted[sorted.length - 1].at,
        isThread: sorted.length > 1 && !!sorted[0].approvalId,
        unread: sorted.filter((n) => !n.read).length,
        cats: new Set(sorted.map((n) => (KIND_META[n.kind] || {}).cat)),
      };
    }).sort((a, b) => b.latest.localeCompare(a.latest));
  }, [items]);

  const catCount = (cat) => units.filter((u) =>
    !muted[u.key] && (cat === 'ALL' || u.cats.has(cat)) && (!unreadOnly || u.unread > 0)).length;

  const visible = units.filter((u) =>
    !muted[u.key] && (tab === 'ALL' || u.cats.has(tab)) && (!unreadOnly || u.unread > 0));
  const totalPages = Math.max(Math.ceil(visible.length / PAGE_SIZE), 1);
  const curPage = Math.min(page, totalPages);
  const paged = visible.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  // ── 읽음 · 뮤트 · 딥링크 ─────────────────────────────────────────────────
  const markRead = (ids) => setItems((s) => s.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
  const openItem = (n) => {
    markRead([n.id]);
    if (n.route) navigate(n.route.name, n.route.payload);
  };
  const readThread = (u) => { markRead(u.list.map((n) => n.id)); }; // 묶음 읽음 = 전체 일괄 (합의 2)
  const muteThread = (u) => {
    const protectedItem = u.list.find((n) => n.kind === 'APPROVAL_REJECTED'
      || (n.kind === 'APPROVAL_REQUEST' && (n.body || '').includes('정다은')));
    if (protectedItem) {
      toast('반려·내 차례 결재 요청 알림은 끌 수 없어요 (MG1001 · BS0006)', { tone: 'warn' });
      return;
    }
    setMuted((m) => ({ ...m, [u.key]: true }));
    toast(`${u.key} 알림을 껐어요 — 인앱 알림만 뮤트됩니다`, {
      actionLabel: '되돌리기', duration: 6000,
      onAction: () => setMuted((m) => { const c = { ...m }; delete c[u.key]; return c; }),
    });
  };
  const markAllRead = () => {
    const ids = visible.flatMap((u) => u.list.map((n) => n.id));
    if (ids.length === 0) { toast('읽음 처리할 알림이 없어요', { tone: 'warn' }); return; }
    markRead(ids);
    toast(`${ids.length}건 읽음 처리 완료`, { actionLabel: '홈 대시보드 →', onAction: () => navigate('home') }); // IDEA-16
  };

  const timeOf = (at) => (at.slice(0, 10) === TODAY ? at.slice(11, 16) : `${at.slice(5, 7)}월 ${at.slice(8, 10)}일 ${at.slice(11, 16)}`);

  // 이메일 3상태 배지 (BS0011 — 이메일 실패는 업무 트랜잭션과 무관)
  const EmailBadge = ({ status }) => {
    if (status === 'SENT') return <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-emerald-300" title="이메일 발송 완료 (email_logs)"><Icon name="mail" className="w-3 h-3" />발송됨</span>;
    if (status === 'FAILED') return <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-rose-300" title="재시도 3회 초과 최종 실패 — 업무 반영과는 무관합니다 (BS0011)"><Icon name="mail" className="w-3 h-3" />실패</span>;
    return <span className="shrink-0 text-[11px] text-slate-500" title={status === 'QUEUED' ? '이메일 발송 대기 — 비동기 발송 중 (BS0011)' : '인앱 알림만 발송되는 유형입니다'}>인앱만</span>;
  };

  const actionLabelOf = (n) => {
    if (!n.route) return null;
    if (n.route.name === 'approvalDetail') return n.kind === 'APPROVAL_DONE' ? '반영 영수증 보기' : '결재 상세로';
    return { settlement: '정산 화면으로', orders: '주문으로 이동', kanban: '칸반으로 이동', paymentImport: '배치 보기', excelImport: '배치 보기' }[n.route.name] || '이동';
  };

  const ItemRow = ({ n, inThread = false, isLast = false }) => {
    const meta = KIND_META[n.kind] || { label: n.kind, color: 'slate' };
    const pc = window.PILL_COLORS[meta.color] || window.PILL_COLORS.slate;
    return (
      <div className={`flex items-center gap-3 ${inThread ? 'pl-9 pr-5 py-2' : 'px-5 py-3'} ${!n.read ? '' : 'opacity-70'}`}>
        {inThread && <span className="shrink-0 font-mono text-slate-600 -ml-4">{isLast ? '└' : '├'}</span>}
        <span className={`shrink-0 w-2 h-2 rounded-full ${!n.read ? 'bg-purple-400' : 'border border-slate-600'}`} title={n.read ? '읽음' : '미읽음'}></span>
        <span className="shrink-0 font-mono text-[11px] text-slate-500 w-24">{timeOf(n.at)}</span>
        {n.dueDate && <DdayBadge date={n.dueDate} />}
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">
            <span className={`mr-2 text-[11px] px-1.5 py-0.5 rounded border ${pc.bg} ${pc.text} ${pc.border}`}>{meta.label}</span>
            {n.title}
          </div>
          {n.body && (
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {n.body}
              {n.kind === 'APPROVAL_REJECTED' && <span className="ml-1 text-rose-400/80">— 데이터 변경 없음 (BS0006)</span>}
            </div>
          )}
        </div>
        <EmailBadge status={n.emailStatus} />
        {n.route && (
          <button onClick={(e) => { e.stopPropagation(); openItem(n); }}
            className="shrink-0 text-xs font-medium text-purple-300 hover:text-purple-200 inline-flex items-center gap-1">
            {actionLabelOf(n)} <Icon name="chevronRight" className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  const ThreadHeader = ({ u }) => {
    const first = u.list[0];
    const ap = APPROVALS.find((a) => a.id === u.key);
    const order = ap && ORDERS.find((o) => o.id === ap.orderId);
    const open = !!expanded[u.key];
    const doneItem = u.list.find((n) => n.kind === 'APPROVAL_DONE');
    const sales = ap && (ap.expectedDiff || []).find((d) => d.field === 'currentSales');
    return (
      <div className="px-5 py-3">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded((s) => ({ ...s, [u.key]: !open }))}>
          <span className={`shrink-0 w-2 h-2 rounded-full ${u.unread ? 'bg-purple-400' : 'border border-slate-600'}`}></span>
          <span className="shrink-0 font-mono text-[11px] text-slate-500 w-24">{timeOf(u.latest)}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">
              <span className="font-mono text-cyan-300">{u.key}</span>
              <span className="mx-1.5 text-[11px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">{u.list.length}건 묶음</span>
              {ap && <EnumPill status={ap.type} className="mr-1.5" />}
              <span className="text-slate-300">{order ? `${order.clientName} — ${order.item}` : (ap ? ap.opinion.slice(0, 26) : first.title)}</span>
            </div>
            {doneItem && sales && (
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                매출 ₩{fmt(sales.before)} <span className="text-slate-600">→</span> <span className={sales.after < sales.before ? 'text-rose-300' : 'text-emerald-300'}>₩{fmt(sales.after)}</span>
                <span className="text-slate-600 ml-1.5">· 7연쇄 반영 완료 (MG1001)</span>
              </div>
            )}
          </div>
          {u.unread > 0 && (
            <button onClick={(e) => { e.stopPropagation(); readThread(u); }}
              className="shrink-0 text-[11px] text-slate-500 hover:text-slate-200" title="묶음 전체 읽음 처리">묶음 읽음</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); muteThread(u); }}
            className="shrink-0 text-[11px] text-slate-500 hover:text-amber-300" title="이 문서의 인앱 알림 뮤트 (반려·내 차례는 불가)">알림 끄기</button>
          <span className="shrink-0 text-slate-500">
            <Icon name={open ? 'chevronDown' : 'chevronRight'} className="w-4 h-4" />
          </span>
        </div>
        {open && (
          <div className="mt-2 rounded-lg bg-slate-950/50 border border-slate-800/80 divide-y divide-slate-800/50" style={{ animation: 'fadeUp .2s ease-out' }}>
            {u.list.map((n, i) => <ItemRow key={n.id} n={n} inThread isLast={i === u.list.length - 1} />)}
            <div className="pl-9 pr-5 py-1.5 text-[10px] text-slate-600">펼침 = 7연쇄 순 타임라인 · 묶음 읽음은 전체 일괄 처리돼요 (IDEA-17)</div>
          </div>
        )}
      </div>
    );
  };

  const TABS = [
    { id: 'ALL', label: '전체' }, { id: 'APPROVAL', label: '결재' },
    { id: 'CHAIN', label: '반영 완료' }, { id: 'DEADLINE', label: '기한 임박' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        label="COMMON · NOTIFICATION CENTER" labelColor="purple"
        title="알림 센터"
        desc="같은 결재의 연속 알림은 스레드 1줄로 — 결재 1건이 최대 7연쇄 알림을 낳아도 폭주하지 않아요 (IDEA-17)"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              미읽음 <b className="text-purple-300 tabular-nums">{unreadCount}</b>건
              <span className="text-slate-600 mx-1.5">·</span>
              갱신 <span className="font-mono">{polledAt}</span> (30초)
            </span>
            <button onClick={markAllRead}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
              모두 읽음 처리
            </button>
          </div>
        }
      />

      {/* 유형 필터 탭 + 미읽음만 토글 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1.5 ${
                tab === t.id ? 'bg-purple-500/20 text-purple-200 border-purple-500/40' : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'}`}>
              {t.label}
              <span className="font-mono text-[10px] px-1 rounded bg-slate-700/80 text-slate-300">{catCount(t.id)}</span>
            </button>
          ))}
        </div>
        <button onClick={() => { setUnreadOnly((v) => !v); setPage(1); }} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200">
          <span className={`w-8 h-4.5 rounded-full p-0.5 transition ${unreadOnly ? 'bg-purple-600' : 'bg-slate-700'}`} style={{ height: 18 }}>
            <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${unreadOnly ? 'translate-x-3.5' : ''}`}></span>
          </span>
          미읽음만
        </button>
      </div>

      {/* 알림 목록 — 스레드/단건 혼합, 페이지네이션 (인피니트 스크롤 금지) */}
      <Card className="overflow-hidden">
        {paged.length === 0 ? (
          <window.EmptyState
            icon="bell" title="표시할 알림이 없어요"
            description={unreadOnly ? '미읽음 알림을 모두 처리했어요 — 토글을 끄면 지난 알림도 볼 수 있어요' : '결재·반영·기한 임박 알림이 여기에 쌓여요'}
            actionLabel="홈 대시보드로" onAction={() => navigate('home')}
            secondaryLabel={unreadOnly ? '지난 알림 보기' : null} onSecondary={() => setUnreadOnly(false)}
          />
        ) : (
          <div className="divide-y divide-slate-800/70">
            {paged.map((u) => u.isThread
              ? <ThreadHeader key={u.key} u={u} />
              : <div key={u.key} className="cursor-pointer hover:bg-slate-800/30" onClick={() => openItem(u.list[0])}><ItemRow n={u.list[0]} /></div>
            )}
          </div>
        )}
        {tab !== 'APPROVAL' && paged.length > 0 && (
          <div className="px-5 py-2 border-t border-slate-800 text-[11px] text-slate-600 flex items-center gap-1.5">
            <Icon name="clock" className="w-3 h-3" />
            결재 48시간 초과 지연 건 없음 — 지연 발생 시 현재 차례 승인권자에게만 D+n 알림이 발송돼요 (SLA §1.3)
          </div>
        )}
      </Card>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
        <button disabled={curPage <= 1} onClick={() => setPage((p) => p - 1)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 ${curPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}`}>
          <Icon name="chevronLeft" className="w-3.5 h-3.5" />이전
        </button>
        <span className="font-mono tabular-nums text-xs">{curPage} / {totalPages} 페이지</span>
        <button disabled={curPage >= totalPages} onClick={() => setPage((p) => p + 1)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 ${curPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'}`}>
          다음<Icon name="chevronRight" className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-slate-600 text-center">
        알림 보존 90일 · 감사 기록은 변경 이력에 별도 보존 (MG1004) · 읽음 상태는 수신자별 개별 관리
      </p>
    </div>
  );
}
window.Notifications = Notifications;
