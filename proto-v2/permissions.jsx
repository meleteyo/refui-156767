// permissions.jsx — 35 권한 설정 (update2) · window.Permissions
// 역할(부서×직급 프리셋) × 메뉴 권한 매트릭스(MG1005). 조회는 하위 권한의 전제(해제 시 연쇄 해제),
// 무의미 조합은 "-" 고정, ADMIN 자기 잠금 방지 가드(합의 3 — 막지 않고 안내, P5),
// [이 역할로 화면 미리보기] = §3.2 메뉴 노출 연동 시뮬레이션, 저장 = §4.6 중위험 마찰 + §4.3 감사 스니펫.
// 스펙: models/5_프로토타입모델_권한설정.md
const { useState, useMemo, useEffect } = React;

const P_ROLES = ['ADMIN', 'EXEC', 'TEAM_LEAD', 'FINANCE', 'STAFF'];
const P_COMBO = {
  ADMIN: '경영지원팀 × 시스템 관리자', EXEC: '경영지원팀 × 대표이사', TEAM_LEAD: '각 사업팀 × 팀장',
  FINANCE: '경영지원팀 × 재무팀장', STAFF: '각 사업팀 × 매니저',
};
// 매트릭스 행 = 모델 ASCII 그대로. caps: 화면 성격상 존재하는 기능만 true (없으면 "-" 고정)
const P_ROWS = [
  { id: 'orders',    group: 'ORDERS',    label: '주문 목록/등록',        code: '11',    routes: ['orders', 'orderForm'],              caps: { read: 1, create: 1, update: 1, del: 1 } },
  { id: 'excel',     group: 'ORDERS',    label: '주문 엑셀 업로드',      code: '12',    routes: ['excelImport'],                      caps: { read: 1, create: 1, update: 0, del: 0 } },
  { id: 'tasks',     group: 'TASKS',     label: '작업 그룹/배정',        code: '13·14', routes: ['workGroups', 'assign'],             caps: { read: 1, create: 1, update: 1, del: 1 } },
  { id: 'kanban',    group: 'TASKS',     label: '칸반 보드',             code: '15',    routes: ['kanban'],                           caps: { read: 1, create: 0, update: 1, del: 0 } },
  { id: 'approvals', group: 'APPROVALS', label: '기안 작성/결재함',      code: '21·22', routes: ['draft', 'inbox', 'approvalDetail'], caps: { read: 1, create: 1, update: 1, del: 0 } },
  { id: 'finance',   group: 'FINANCE',   label: '결제내역/정산/명세서',  code: '24~26', routes: ['paymentImport', 'settlement', 'payout'], caps: { read: 1, create: 1, update: 1, del: 1 } },
  { id: 'tax',       group: 'FINANCE',   label: '세금계산서 발행 요청',  code: '27',    routes: ['taxInvoice'],                       caps: { read: 1, create: 1, update: 0, del: 0 } },
  { id: 'profit',    group: 'FINANCE',   label: '손익 대시보드',         code: '28',    routes: ['profit'],                           caps: { read: 1, create: 0, update: 0, del: 0 } },
  { id: 'resources', group: 'RESOURCES', label: '프리랜서/평가',         code: '31~33', routes: ['freelancers', 'evalInput', 'evalReport'], caps: { read: 1, create: 1, update: 1, del: 1 } },
  { id: 'system',    group: 'SYSTEM',    label: '직원/권한/변경 이력',   code: '34~36', routes: ['employees', 'permissions', 'auditLog'],   caps: { read: 1, create: 1, update: 1, del: 1 } },
];
const P_CAPS = [['read', '조회'], ['create', '등록'], ['update', '수정'], ['del', '삭제']];
const P_GROUP_LABEL = { ORDERS: '주문', TASKS: '작업', APPROVALS: '결재', FINANCE: '재무', RESOURCES: '리소스', SYSTEM: '시스템' };

// 미리보기 시뮬레이션용 셸 사이드바 사본 (index.html NAV_GROUPS·REGISTRY 라벨 — CONTRACT §3 하드코딩 허용)
const P_NAV = [
  ['개요 · OVERVIEW', ['home', 'notifications', 'profit']],
  ['주문 · ORDERS', ['orders', 'orderForm', 'excelImport']],
  ['작업 · TASKS', ['workGroups', 'assign', 'kanban']],
  ['결재 · APPROVALS', ['draft', 'inbox', 'approvalDetail']],
  ['재무 · FINANCE', ['paymentImport', 'settlement', 'payout', 'taxInvoice']],
  ['리소스 · RESOURCES', ['freelancers', 'evalInput', 'evalReport']],
  ['시스템 · SYSTEM', ['employees', 'permissions', 'auditLog']],
];
const P_ROUTE_META = {
  home: ['홈', 'home'], notifications: ['알림 센터', 'bell'], profit: ['손익 대시보드', 'chart'],
  orders: ['주문 목록', 'file'], orderForm: ['주문 등록', 'plus'], excelImport: ['주문 엑셀 업로드', 'upload'],
  workGroups: ['작업 그룹', 'layers'], assign: ['작업 배정', 'users'], kanban: ['작업 칸반', 'columns'],
  draft: ['기안 작성', 'edit'], inbox: ['결재함', 'inbox'], approvalDetail: ['결재 상세', 'shieldCheck'],
  paymentImport: ['결제내역 등록', 'creditCard'], settlement: ['정산 확정', 'lock'], payout: ['지급 명세서', 'wallet'],
  taxInvoice: ['세금계산서', 'receipt'], freelancers: ['프리랜서 마스터', 'user2'], evalInput: ['평가 입력', 'star'],
  evalReport: ['평가 조회', 'activity'], employees: ['직원 관리', 'user'], permissions: ['권한 설정', 'shield'],
  auditLog: ['변경 이력', 'history'],
};
const P_ROUTE_ROW = {};
P_ROWS.forEach((row) => row.routes.forEach((r) => { P_ROUTE_ROW[r] = row.id; }));

// 초기 매트릭스 — 조회는 ROLE_MATRIX(route boolean)에서 유도, 등록/수정/삭제는 화면 로컬 보강
// (data.js ROLE_MATRIX는 라우트 단위 boolean만 보유 — CRUD 세분화는 프로토타입 시뮬레이션)
const pBuildInitial = () => {
  const m = {};
  P_ROLES.forEach((role) => {
    m[role] = {};
    P_ROWS.forEach((row) => {
      const read = row.routes.some((r) => ROLE_MATRIX[role][r]);
      m[role][row.id] = {
        read,
        create: row.caps.create ? (read && role !== 'EXEC') : null,
        update: row.caps.update ? (read && role !== 'EXEC') : null,
        del:    row.caps.del ? role === 'ADMIN' : null,
      };
    });
  });
  return m;
};
const pClone = (m) => JSON.parse(JSON.stringify(m));
const pNow = () => {
  const d = new Date();
  return `${TODAY} ${window.pad(d.getHours())}:${window.pad(d.getMinutes())}`;
};

function Permissions({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, ConfirmDialog, toast } = window;
  // 딥링크 — employees.jsx '권한 설정에서 메뉴 노출 확인 →' 릴레이가 { role } 전달 (P4)
  const payloadRole = P_ROLES.includes(route?.payload?.role) ? route.payload.role : null;
  const [role, setRole] = useState(payloadRole || 'TEAM_LEAD');
  useEffect(() => {
    if (payloadRole) setRole(payloadRole);
  }, [payloadRole]);
  const [matrix, setMatrix] = useState(pBuildInitial);
  const [saved, setSaved] = useState(pBuildInitial);
  const [preview, setPreview] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [localAudit, setLocalAudit] = useState([]); // 저장 시 감사 스니펫 적재 (704 시뮬레이션)

  const me = EMPLOYEES.find((e) => e.id === CURRENT_USER_ID) || { name: '—' };
  const memberCount = EMPLOYEES.filter((e) => e.role === role && e.active).length;

  // 미저장 변경 목록 (전 역할 대상 — 저장은 매트릭스 전체 트랜잭션)
  const changes = useMemo(() => {
    const out = [];
    P_ROLES.forEach((r) => P_ROWS.forEach((row) => P_CAPS.forEach(([cap, capLabel]) => {
      if (!row.caps[cap]) return;
      const b = saved[r][row.id][cap];
      const a = matrix[r][row.id][cap];
      if (b !== a) out.push({ role: r, row, cap, capLabel, before: b, after: a });
    })));
    return out;
  }, [matrix, saved]);

  // ADMIN 자기 잠금 방지 — SYSTEM 그룹의 조회/수정은 해제 불가 (합의 3)
  const isSelfLock = (r, row, cap) => r === 'ADMIN' && row.group === 'SYSTEM' && (cap === 'read' || cap === 'update');

  const toggle = (row, cap) => {
    if (isSelfLock(role, row, cap)) {
      toast('자기 잠금 방지 — ADMIN의 시스템 그룹 조회·수정 권한은 해제할 수 없어요', { tone: 'warn' });
      return;
    }
    setMatrix((m) => {
      const cur = m[role][row.id];
      const next = { ...cur, [cap]: !cur[cap] };
      // 조회 해제 → 같은 행의 등록/수정/삭제 자동 해제 (조회는 하위 권한의 전제)
      if (cap === 'read' && cur.read) {
        const hadChild = ['create', 'update', 'del'].some((c) => next[c]);
        ['create', 'update', 'del'].forEach((c) => { if (next[c] !== null) next[c] = false; });
        if (hadChild) toast('조회 해제 — 등록·수정·삭제도 함께 해제했어요 (조회는 하위 권한의 전제)', { tone: 'warn' });
      }
      return { ...m, [role]: { ...m[role], [row.id]: next } };
    });
  };

  const doSave = () => {
    const n = changes.length;
    const at = pNow();
    setLocalAudit((l) => [{
      at, actor: me.name,
      lines: changes.map((c) => `${P_COMBO[c.role]} · ${c.row.label}(${c.row.code}) ${c.capLabel}: ${c.before ? '허용' : '미허용'} → ${c.after ? '허용' : '미허용'}`),
    }, ...l]);
    setSaved(pClone(matrix));
    setConfirmSave(false);
    toast(`권한 ${n}건 저장 완료 — 다음 요청부터 적용돼요 (세션 강제 종료 없음)`, {
      actionLabel: '변경 이력에서 확인 →',
      onAction: () => navigate('auditLog', { entityType: 'PERMISSION' }),
    });
  };
  const doRevert = () => {
    setMatrix(pClone(saved));
    setConfirmRevert(false);
    toast('미저장 변경을 폐기하고 마지막 저장 상태로 되돌렸어요');
  };

  // 미리보기 — 현재 편집 중(미저장 포함) 매트릭스 기준 라우트 노출 계산 (§3.2)
  const routeVisible = (rk) => {
    if (rk === 'home' || rk === 'notifications') return true; // 개요 공통 노출
    const rowId = P_ROUTE_ROW[rk];
    return rowId ? matrix[role][rowId].read : true;
  };
  const visibleRoutes = Object.keys(P_ROUTE_META).filter(routeVisible);
  const hiddenRoutes = Object.keys(P_ROUTE_META).filter((rk) => !routeVisible(rk));
  useEffect(() => {
    if (!preview) return;
    const onKey = (e) => { if (e.key === 'Escape') setPreview(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  // 최근 변경 이력 스니펫 — 로컬 저장분 + data.js PERMISSION 로그 (§4.3 mono 라인)
  const baseAudit = AUDIT_LOGS.filter((l) => l.entityType === 'PERMISSION').map((l) => ({
    at: l.at, actor: l.actor, lines: [`${l.field.replace('.', ' × ')} : ${l.before} → ${l.after}${l.note ? ` — ${l.note}` : ''}`],
  }));
  const auditSnips = [...localAudit, ...baseAudit].slice(0, 3);

  const roleSample = EMPLOYEES.find((e) => e.role === role);
  const dirty = changes.length;

  const cell = (row, cap) => {
    if (!row.caps[cap]) return <span className="text-slate-600 select-none" title="화면 성격상 없는 기능">–</span>;
    const on = matrix[role][row.id][cap];
    const locked = isSelfLock(role, row, cap);
    const needsRead = cap !== 'read' && !matrix[role][row.id].read;
    const changed = saved[role][row.id][cap] !== on;
    return (
      <button
        onClick={() => !needsRead && toggle(row, cap)}
        disabled={needsRead}
        title={locked ? '자기 잠금 방지 — ADMIN의 시스템 그룹 조회·수정은 해제 불가 (합의 3)'
          : needsRead ? '조회를 먼저 허용하세요 — 조회는 하위 권한의 전제'
          : `클릭하여 ${on ? '해제' : '허용'}`}
        aria-label={`${row.label} ${P_CAPS.find(([k]) => k === cap)[1]} ${on ? '허용' : '미허용'}`}
        className={`relative w-7 h-7 rounded-md border inline-flex items-center justify-center transition ${
          on ? 'bg-emerald-500/15 border-emerald-600/50 text-emerald-300' : 'bg-slate-950/60 border-slate-700/60 text-slate-600'
        } ${locked ? 'cursor-help' : needsRead ? 'opacity-40 cursor-not-allowed' : 'hover:border-purple-500/60 cursor-pointer'}`}
      >
        <Icon name={locked ? 'lock' : on ? 'check' : 'x'} className="w-3.5 h-3.5" />
        {changed && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" title="미저장 변경"></span>}
      </button>
    );
  };

  return (
    <div>
      <PageHeader
        label="SYSTEM · 권한 설정 (35)" labelColor="purple" title="권한 설정"
        desc="역할(부서×직급)별 메뉴·기능 권한을 매트릭스로 설정합니다 — 역할 기반 RBAC · MG1005 (행 단위 데이터 권한은 Phase 2)"
        actions={
          <button onClick={() => navigate('auditLog', { entityType: 'PERMISSION' })}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 flex items-center gap-2">
            <Icon name="history" className="w-3.5 h-3.5 text-purple-300" />변경 이력 전체 보기
          </button>
        }
      />

      {/* 역할 선택 스트립 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">역할 (부서 × 직급) <span className="text-rose-300">*</span></div>
            <div className="flex items-center gap-2">
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60 min-w-[220px]">
                {P_ROLES.map((r) => (
                  <option key={r} value={r}>{P_COMBO[r]} — {window.ENUM_META[r].label}</option>
                ))}
              </select>
              <EnumPill status={role} />
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">적용 대상 직원</div>
            <div className="text-sm font-mono tabular-nums text-slate-200">{memberCount}명
              {roleSample && <span className="ml-2 text-xs font-sans text-slate-500">예: {roleSample.name} · {roleSample.position}</span>}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">권한 방식</div>
            <div className="text-sm text-slate-300">역할 기반(RBAC) <span className="font-mono text-[11px] text-slate-500">MG1005</span></div>
          </div>
          <button onClick={() => setPreview(true)}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-2">
            <Icon name="eye" className="w-4 h-4" />이 역할로 화면 미리보기
          </button>
        </div>
      </Card>

      {/* 권한 매트릭스 */}
      <Card className="overflow-hidden mb-4">
        <div className="px-5 pt-4 pb-2 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm">권한 매트릭스</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">조회 해제 시 같은 행의 등록·수정·삭제가 자동 해제됩니다 — 화면 성격상 없는 기능은 "–"</p>
          </div>
          {dirty > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-amber-500/15 text-amber-300 border-amber-500/30 px-2 py-0.5 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>미저장 변경 {dirty}건
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                <th className="text-left pl-5 pr-2 py-2.5 font-medium w-24">그룹</th>
                <th className="text-left px-2 py-2.5 font-medium">메뉴 (모델 번호)</th>
                {P_CAPS.map(([k, l]) => <th key={k} className="px-2 py-2.5 font-medium text-center w-20">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {P_ROWS.map((row, i) => {
                const firstOfGroup = i === 0 || P_ROWS[i - 1].group !== row.group;
                const selfLockRow = role === 'ADMIN' && row.group === 'SYSTEM';
                return (
                  <tr key={row.id} className={`border-b border-slate-800/70 ${firstOfGroup ? 'border-t border-t-slate-700/50' : ''} hover:bg-slate-800/20`}>
                    <td className="pl-5 pr-2 py-2 align-top">
                      {firstOfGroup && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{row.group}<br />
                          <span className="text-slate-600 normal-case">{P_GROUP_LABEL[row.group]}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                        {row.label} <span className="font-mono text-[10px] text-slate-600">({row.code})</span>
                        {selfLockRow && (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 px-1.5 py-px text-[10px]">
                            <Icon name="lock" className="w-2.5 h-2.5" />자기 잠금 방지
                          </span>
                        )}
                      </div>
                      {!matrix[role][row.id].read && (
                        <div className="text-[10px] text-slate-600 mt-0.5">조회 미허용 — 사이드바에서 렌더링되지 않음 (§3.2)</div>
                      )}
                    </td>
                    {P_CAPS.map(([k]) => <td key={k} className="px-2 py-2 text-center">{cell(row, k)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 매트릭스 안내문 */}
        <div className="mx-5 my-4 rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-[11px] text-slate-400 leading-relaxed">
          <div className="flex items-start gap-2"><Icon name="info" className="w-3.5 h-3.5 mt-px text-cyan-300 shrink-0" />
            <span>조회를 해제하면 해당 메뉴는 사이드바에서 <b className="text-slate-200">렌더링되지 않습니다</b>(비활성이 아님 — §3.2).
              금액 수정 권한을 허용해도 <b className="text-slate-200">금액 변경은 결재 승인으로만 반영</b>됩니다 <span className="font-mono text-slate-500">(MG1001)</span>.</span>
          </div>
        </div>
      </Card>

      {/* 최근 변경 이력 (감사 스니펫 §4.3) */}
      <Card className="p-5 mb-24">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="history" className="w-4 h-4 text-purple-300" />최근 변경 이력
          </div>
          <span className="text-[10px] text-slate-500">저장 시 변경 이력 기록(704)이 동일 트랜잭션으로 수행됩니다 <span className="font-mono">MG1004</span></span>
        </div>
        {auditSnips.length === 0 ? (
          <div className="text-[11px] text-slate-500">아직 변경 이력이 없습니다 — 매트릭스를 수정하고 저장하면 여기에 기록됩니다.</div>
        ) : (
          <div className="space-y-2">
            {auditSnips.map((s, i) => (
              <div key={i} className={`font-mono text-[11px] ${i === 0 ? 'text-slate-300' : 'text-slate-500'}`}>
                <div>{s.at} · PERMISSION_UPDATED · {s.actor}</div>
                {s.lines.map((ln, j) => <div key={j} className="pl-4 text-slate-500">{ln}</div>)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 하단 고정 저장 바 */}
      <div className="fixed bottom-0 left-60 right-0 z-40 border-t border-slate-800 bg-slate-950/90 backdrop-blur px-8 py-3 flex items-center gap-3">
        <span className="text-sm text-slate-400">변경 <b className={`font-mono tabular-nums ${dirty > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{dirty}</b>건
          {dirty > 0 && <span className="text-[11px] text-slate-600 ml-2">저장 전에는 어떤 권한도 적용되지 않아요</span>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => dirty > 0 && setConfirmRevert(true)} disabled={dirty === 0}
            className={`px-4 py-2 rounded-lg text-sm ${dirty === 0 ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            되돌리기
          </button>
          <button onClick={() => dirty > 0 && setConfirmSave(true)} disabled={dirty === 0}
            className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${dirty === 0
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 animate-pulse'}`}>
            저장 ({dirty}건)
          </button>
        </div>
      </div>

      {/* 저장 확인 — §4.6 중위험: 변경 요약 카드 재표시 + 명시 클릭 */}
      <ConfirmDialog
        open={confirmSave} risk="mid" title="권한 변경 저장" confirmLabel={`${dirty}건 저장 확정`}
        message="저장 즉시 권한이 반영되며, 이미 로그인한 사용자에게는 다음 요청부터 적용됩니다 (세션 강제 종료 없음 — 합의 4)."
        summary={
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {changes.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <EnumPill status={c.role} />
                <span className="text-slate-300 flex-1 truncate">{c.row.label} · {c.capLabel}</span>
                <span className={`${c.before ? 'text-emerald-300' : 'text-slate-500'} line-through`}>{c.before ? '허용' : '미허용'}</span>
                <span className="text-slate-600">→</span>
                <b className={c.after ? 'text-emerald-300' : 'text-rose-300'}>{c.after ? '허용' : '미허용'}</b>
              </div>
            ))}
          </div>
        }
        onConfirm={doSave} onClose={() => setConfirmSave(false)}
      />
      <ConfirmDialog
        open={confirmRevert} risk="low" title="미저장 변경 폐기" danger
        message={`미저장 변경 ${dirty}건을 폐기하고 마지막 저장 상태로 복원합니다. 이 동작은 되돌릴 수 없어요.`}
        confirmLabel="폐기하고 되돌리기" onConfirm={doRevert} onClose={() => setConfirmRevert(false)}
      />

      {/* ══ 미리보기 모드 — 편집 중(미저장 포함) 매트릭스로 읽기 전용 셸 시뮬레이션 ══ */}
      {preview && (
        <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: '#020617' }}>
          <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/40 px-5 py-2.5 flex items-center gap-3">
            <Icon name="eye" className="w-4 h-4 text-amber-300" />
            <span className="text-sm text-amber-200 font-medium">
              미리보기 중 — {P_COMBO[role]} <span className="font-mono text-xs">({role})</span> 역할의 메뉴 구성 · 저장되지 않은 변경 포함
            </span>
            <span className="text-[11px] text-amber-300/70 hidden xl:inline">조회 미허용 메뉴는 비활성이 아니라 렌더링되지 않습니다 (§3.2)</span>
            <button onClick={() => setPreview(false)}
              className="ml-auto px-3 py-1.5 rounded-lg bg-slate-900 border border-amber-500/40 text-sm text-amber-200 hover:bg-slate-800 flex items-center gap-1.5">
              <Icon name="x" className="w-3.5 h-3.5" />나가기 <span className="font-mono text-[10px] text-amber-300/60">Esc</span>
            </button>
          </div>
          <div className="flex-1 flex overflow-hidden">
            {/* 시뮬레이션 사이드바 — 해당 역할 노출만 렌더 */}
            <aside className="w-60 shrink-0 bg-slate-950 border-r border-slate-800 p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: tweaks.brandColor }}>
                  {(tweaks.brandName || 'E')[0]}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{tweaks.brandName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">미리보기 세션</div>
                </div>
              </div>
              <div className="mb-4 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                <Icon name="user" className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-300 truncate">{roleSample ? `${roleSample.name} · ${roleSample.position}` : '역할 표본 없음'}</span>
                <EnumPill status={role} />
              </div>
              <nav className="space-y-4">
                {P_NAV.map(([group, items]) => {
                  const vis = items.filter(routeVisible);
                  if (vis.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-3 mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-600">{group}</div>
                      <div className="space-y-0.5">
                        {vis.map((rk) => (
                          <div key={rk} className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm text-slate-400">
                            <Icon name={P_ROUTE_META[rk][1]} className="w-4 h-4 shrink-0" />
                            <span className="flex-1 truncate">{P_ROUTE_META[rk][0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </aside>
            {/* 미리보기 본문 — 노출/숨김 요약 */}
            <main className="flex-1 overflow-y-auto p-8">
              <SectionLabel color="amber">PREVIEW · 읽기 전용</SectionLabel>
              <h2 className="text-2xl font-bold mt-1 mb-1">{window.ENUM_META[role].label} 역할이 보는 화면</h2>
              <p className="text-sm text-slate-400 mb-6">메뉴 노출 <b className="font-mono text-slate-200">{visibleRoutes.length}</b> / 22 · 버튼 활성화는 행별 등록·수정·삭제 권한을 따릅니다</p>
              <div className="grid grid-cols-12 gap-4 max-w-4xl">
                <Card className="col-span-12 lg:col-span-7 p-5">
                  <h3 className="text-sm font-semibold mb-3">노출 메뉴의 기능 권한</h3>
                  <div className="space-y-2">
                    {P_ROWS.filter((row) => matrix[role][row.id].read).map((row) => (
                      <div key={row.id} className="flex items-center gap-2 text-xs rounded-lg bg-slate-950/60 border border-slate-800 px-3 py-2">
                        <span className="text-slate-200 font-medium flex-1 truncate">{row.label} <span className="font-mono text-[10px] text-slate-600">({row.code})</span></span>
                        {P_CAPS.map(([k, l]) => row.caps[k] ? (
                          <span key={k} className={`px-1.5 py-px rounded border text-[10px] ${matrix[role][row.id][k]
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/60 text-slate-600 border-slate-700 line-through'}`}>{l}</span>
                        ) : <span key={k} className="px-1.5 py-px text-[10px] text-slate-700">–</span>)}
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="col-span-12 lg:col-span-5 p-5">
                  <h3 className="text-sm font-semibold mb-1">렌더링되지 않는 메뉴 <span className="font-mono text-xs text-slate-500">{hiddenRoutes.length}</span></h3>
                  <p className="text-[11px] text-slate-500 mb-3">§3.2 — 사이드바에서 아예 그리지 않습니다 (비활성 아님)</p>
                  {hiddenRoutes.length === 0 ? (
                    <div className="text-xs text-emerald-300 flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5" />모든 메뉴가 노출됩니다</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {hiddenRoutes.map((rk) => (
                        <span key={rk} className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700 text-[11px] text-slate-500">{P_ROUTE_META[rk][0]}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed">
                    이 미리보기는 <b className="text-amber-300">저장되지 않은 편집 상태</b>를 그대로 반영합니다. 실제 적용은 저장 후 다음 요청부터입니다.
                  </div>
                </Card>
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
window.Permissions = Permissions;
