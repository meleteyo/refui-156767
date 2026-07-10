// audit-log.jsx — 36 변경 이력 조회 (inquiry2) · window.AuditLog
// AUDIT_LOGS 감사 로그 조회: 기간/변경자/대상/행위/대상 ID 필터 + 저장된 뷰(IDEA-05, 숫자키),
// 행 훑기 사이드 패널(IDEA-06, ↑↓ 이동), 필드 diff(§4.3 — 취소선→굵게, ± 부호+색 병행),
// 7연쇄 자동 반영 건 = "시스템(자동)" + 원인 결재 반영 영수증 딥링크(IDEA-07, 문제 104·110).
// append-only — 수정/삭제 UI 없음 (합의 2). 스펙: models/5_프로토타입모델_변경이력조회.md
const { useState, useMemo, useEffect } = React;

const AL_ENTITY = {
  ORDER: '주문', APPROVAL: '결재', SETTLEMENT: '정산', PAYOUT: '정산(지급명세서)',
  FREELANCER: '프리랜서', EMPLOYEE: '직원', PERMISSION: '권한', TASK: '작업', AUDIT_EXPORT: '이력 다운로드',
};
// 행위 — 감사 로그는 append-only라 '삭제'가 없다. 이벤트를 4그룹으로 조회 (모델 표기 규약 §4.1 준수)
const AL_ACTION = {
  FIELD_CHANGE:  { label: '수정',       color: 'amber',   grp: 'UPDATE' },
  STATUS_CHANGE: { label: '상태변경',   color: 'amber',   grp: 'UPDATE' },
  RECALC:        { label: '재계산',     color: 'amber',   grp: 'UPDATE' },
  SALES_EVENT:   { label: '이벤트 적재', color: 'emerald', grp: 'APPEND' },
  ADJUSTMENT:    { label: '조정 적재',   color: 'emerald', grp: 'APPEND' },
  DEDUCTION_ADD: { label: '차감 적재',   color: 'emerald', grp: 'APPEND' },
  CONFIRM:       { label: '확정',       color: 'emerald', grp: 'CONFIRM' },
  REJECT:        { label: '반려',       color: 'rose',    grp: 'REJECT' },
  EXPORT:        { label: '다운로드',   color: 'cyan',    grp: 'EXPORT' },
};
const AL_FIELD = {
  status: '상태', refundedAmount: '기환불 누계', currentSales: '현재 매출', profit: '정산 손익',
  total: '지급 총액', account: '계좌번호', adjustments: '조정 이벤트', 'STAFF.profit': '권한 · STAFF × 손익 대시보드',
};
const AL_DEF = { from: '2026-07-04', to: '2026-07-10', actor: 'ALL', entity: 'ALL', action: 'ALL', q: '', fields: null };
const AL_PAGE = 8;

const alMoneyish = (s) => /^[\d,]+$/.test(String(s == null ? '' : s).trim());
const alNum = (s) => Number(String(s).replace(/,/g, ''));

const alApply = (logs, f) => logs.filter((l) => {
  const d = l.at.slice(0, 10);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  if (f.actor === 'SYSTEM' && l.actorType !== 'SYSTEM') return false;
  if (f.actor !== 'ALL' && f.actor !== 'SYSTEM' && l.actor !== f.actor) return false;
  if (f.entity === 'SETTLEMENT') { if (l.entityType !== 'SETTLEMENT' && l.entityType !== 'PAYOUT') return false; }
  else if (f.entity !== 'ALL' && l.entityType !== f.entity) return false;
  if (f.action !== 'ALL' && (AL_ACTION[l.event] || {}).grp !== f.action) return false;
  if (f.fields && !f.fields.includes(l.field)) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hay = `${l.entityId} ${l.approvalId || ''} ${l.actor} ${l.note || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
});

function AuditLog({ route, navigate, tweaks }) {
  const { Card, Icon, PageHeader, EnumPill, SavedViewChips, SidePanel, toast, fmt, pad } = window;
  const [flt, setFltRaw] = useState(() => {
    const p = route.payload || {};
    const base = { ...AL_DEF };
    if (p.entityType) base.entity = p.entityType;
    if (p.approvalId) base.q = p.approvalId;
    if (p.entityId) base.q = p.entityId;
    return base;
  });
  const [viewId, setViewId] = useState(null);
  const [page, setPage] = useState(1);
  const [selId, setSelId] = useState(null);      // 사이드 패널 대상 로그 id
  const [localLogs, setLocalLogs] = useState([]); // 엑셀 다운로드 행위 기록 (합의 3)
  const [myViews, setMyViews] = useState([]);

  const setFlt = (patch, keepView) => {
    setFltRaw((f) => ({ ...f, ...patch }));
    if (!keepView) setViewId(null);
    setPage(1);
  };

  const allLogs = useMemo(() => [...localLogs, ...AUDIT_LOGS], [localLogs]);
  const filtered = useMemo(() => alApply(allLogs, flt), [allLogs, flt]);
  const pages = Math.max(1, Math.ceil(filtered.length / AL_PAGE));
  const pageRows = filtered.slice((page - 1) * AL_PAGE, page * AL_PAGE);
  const sysCount = filtered.filter((l) => l.actorType === 'SYSTEM').length;

  const actors = useMemo(() => [...new Set(AUDIT_LOGS.filter((l) => l.actorType === 'USER').map((l) => l.actor))], []);

  // 저장된 뷰 — SV-05(data.js) + 로컬 보강 2종 + 사용자 저장 뷰 (IDEA-05, 숫자키 1~n)
  const views = useMemo(() => {
    const defs = [
      { id: 'V-CHAIN', name: '결재 반영분', f: { actor: 'SYSTEM' } },
      { id: 'V-PERM',  name: '권한 변경',   f: { entity: 'PERMISSION' } },
      { id: 'SV-05',   name: '금액 변경만', f: { fields: ['refundedAmount', 'profit', 'total'] } },
      ...myViews,
    ];
    return defs.map((v) => ({ ...v, count: alApply(allLogs, { ...AL_DEF, ...v.f }).length }));
  }, [allLogs, myViews]);

  const selectView = (id) => {
    if (id == null) { setFltRaw({ ...AL_DEF, from: '', to: '' }); setViewId(null); setPage(1); return; }
    const v = views.find((x) => x.id === id);
    if (!v) return;
    setFltRaw({ ...AL_DEF, ...v.f });
    setViewId(id); setPage(1);
  };

  const saveView = () => {
    const name = `내 뷰 ${myViews.length + 1}`;
    const f = { ...flt };
    setMyViews((s) => [...s, { id: `MY-${s.length + 1}`, name, f }]);
    toast(`"${name}" 저장 완료 — 숫자키 ${views.length + 1}번으로 전환할 수 있어요 (IDEA-05)`);
  };

  // 숫자키 1~n 뷰 전환 + 패널 ↑↓ 행 훑기 (IDEA-06)
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= views.length) { selectView(views[n - 1].id); return; }
      if (selId == null) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = filtered.findIndex((l) => l.id === selId);
        const next = e.key === 'ArrowDown' ? Math.min(filtered.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelId(filtered[next].id);
        setPage(Math.floor(next / AL_PAGE) + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [views, filtered, selId]);

  // 엑셀 다운로드 — 마스킹 유지 + 다운로드 행위 자체를 이력으로 기록 (합의 3) + 릴레이(IDEA-16)
  const doExport = () => {
    const me = EMPLOYEES.find((e) => e.id === CURRENT_USER_ID) || { name: '—' };
    const d = new Date();
    const fname = `audit_${TODAY.replace(/-/g, '')}.xlsx`;
    setLocalLogs((s) => [{
      id: `LOG-EXP-${s.length + 1}`, at: `${TODAY} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      actorType: 'USER', actor: me.name, entityType: 'AUDIT_EXPORT', entityId: fname,
      event: 'EXPORT', field: null, before: null, after: null, approvalId: null,
      note: `현재 필터 ${filtered.length}건 다운로드 — 민감 필드 마스킹 유지 (MG1004)`,
    }, ...s]);
    const firstApr = filtered.find((l) => l.approvalId);
    toast(`${fname} 다운로드 완료 — ${filtered.length}건 · 마스킹 유지 · 다운로드 행위도 이력으로 기록했어요`, firstApr ? {
      actionLabel: `원인 결재 ${firstApr.approvalId} 열기 →`,
      onAction: () => navigate('approvalDetail', { approvalId: firstApr.approvalId }),
    } : {});
  };

  // 대상 명칭·원본 화면 딥링크 (P4)
  const entityTitle = (l) => {
    if (l.entityType === 'ORDER') { const o = ORDERS.find((x) => x.id === l.entityId); return o ? `${o.clientName} · ${o.item}` : ''; }
    if (l.entityType === 'SETTLEMENT') { const s = SETTLEMENTS.find((x) => x.id === l.entityId); return s ? `${s.target} · ${s.period}` : ''; }
    if (l.entityType === 'PAYOUT') { const p = PAYOUT_STATEMENTS.find((x) => x.id === l.entityId); const f = p && FREELANCERS.find((x) => x.id === p.freelancerId); return p ? `${f ? f.name : ''} · ${p.period}` : ''; }
    if (l.entityType === 'APPROVAL') { const a = APPROVALS.find((x) => x.id === l.entityId); return a ? `${(window.ENUM_META[a.type] || {}).label || a.type} · ₩${fmt(a.amount)}` : ''; }
    if (l.entityType === 'FREELANCER') { const f = FREELANCERS.find((x) => x.id === l.entityId); return f ? `${f.name} · ${f.specialty}` : ''; }
    if (l.entityType === 'TASK') { const t = TASKS.find((x) => x.id === l.entityId); return t ? t.title : ''; }
    if (l.entityType === 'PERMISSION') return '역할 × 메뉴 매트릭스';
    return '';
  };
  const openOrigin = (l) => {
    const map = {
      ORDER: ['orders', { orderId: l.entityId }], APPROVAL: ['approvalDetail', { approvalId: l.entityId }],
      SETTLEMENT: ['settlement', { settlementId: l.entityId }], PAYOUT: ['payout', { statementId: l.entityId }],
      FREELANCER: ['freelancers', { freelancerId: l.entityId }], PERMISSION: ['permissions', null],
      TASK: ['kanban', { taskId: l.entityId }], EMPLOYEE: ['employees', null],
    };
    const t = map[l.entityType];
    if (t) navigate(t[0], t[1]);
  };

  const ActPill = ({ event }) => {
    const m = AL_ACTION[event] || { label: event, color: 'slate' };
    const c = window.PILL_COLORS[m.color] || window.PILL_COLORS.slate;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md border ${c.bg} ${c.text} ${c.border} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>{m.label}
      </span>
    );
  };

  // 필드 diff — 이전값 취소선 → 새값 굵게, 금액은 ± 부호 + 색 병행 (§4.3-1)
  const DiffRow = ({ l }) => {
    if (!l.field) return null;
    const money = alMoneyish(l.before) && alMoneyish(l.after);
    const delta = money ? alNum(l.after) - alNum(l.before) : null;
    const masked = l.field === 'account';
    const isEnum = !money && window.ENUM_META[l.before] && window.ENUM_META[l.after];
    return (
      <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">필드 diff — 변경 필드만 표시 (§4.3)</div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-xs text-slate-400 w-24 shrink-0">{AL_FIELD[l.field] || l.field}</span>
          {isEnum ? (
            <>
              <span className="opacity-60 line-through"><EnumPill status={l.before} /></span>
              <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
              <EnumPill status={l.after} />
            </>
          ) : (
            <>
              <span className={`line-through text-slate-500 ${money || masked ? 'font-mono tabular-nums' : ''}`}>{money ? `₩${l.before}` : l.before}</span>
              <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
              <b className={`text-slate-100 ${money || masked ? 'font-mono tabular-nums' : ''}`}>{money ? `₩${l.after}` : l.after}</b>
            </>
          )}
          {delta != null && delta !== 0 && (
            <span className={`font-mono tabular-nums text-xs ${delta < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
              ({delta < 0 ? '−' : '+'}₩{fmt(Math.abs(delta))})
            </span>
          )}
        </div>
        {masked && (
          <div className="mt-2 text-[11px] text-amber-300/90 flex items-center gap-1.5">
            <Icon name="lock" className="w-3 h-3" />기록 시점에 마스킹되어 어떤 권한으로도 원본을 열람할 수 없어요 — 화면·엑셀 동일 (MG1004)
          </div>
        )}
      </div>
    );
  };

  const sel = filtered.find((l) => l.id === selId) || allLogs.find((l) => l.id === selId);
  const selApr = sel && sel.approvalId ? APPROVALS.find((a) => a.id === sel.approvalId) : null;

  // 적용 필터 칩
  const chips = [];
  if (flt.from || flt.to) chips.push({ k: 'period', label: (flt.from === AL_DEF.from && flt.to === AL_DEF.to) ? '기간: 최근 7일' : `기간: ${flt.from || '…'} ~ ${flt.to || '…'}`, clear: () => setFlt({ from: '', to: '' }) });
  if (flt.actor !== 'ALL') chips.push({ k: 'actor', label: `변경자: ${flt.actor === 'SYSTEM' ? '시스템(자동)' : flt.actor}`, clear: () => setFlt({ actor: 'ALL' }) });
  if (flt.entity !== 'ALL') chips.push({ k: 'entity', label: `대상: ${AL_ENTITY[flt.entity] || flt.entity}`, clear: () => setFlt({ entity: 'ALL' }) });
  if (flt.action !== 'ALL') chips.push({ k: 'action', label: `행위: ${{ UPDATE: '수정', APPEND: '이벤트 적재', CONFIRM: '확정', REJECT: '반려', EXPORT: '다운로드' }[flt.action]}`, clear: () => setFlt({ action: 'ALL' }) });
  if (flt.q) chips.push({ k: 'q', label: `대상 ID: ${flt.q}`, clear: () => setFlt({ q: '' }) });
  if (flt.fields) chips.push({ k: 'fields', label: '필드: 금액 변경만', clear: () => setFlt({ fields: null }) });

  const inputCls = 'rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs outline-none focus:border-purple-500/60 text-slate-200';

  return (
    <div>
      <PageHeader
        label="SYSTEM · 변경 이력 (36)" labelColor="purple" title="변경 이력 조회"
        desc="누가 · 언제 · 무엇을 · 왜 — 감사 로그는 append-only, 반려 건도 '데이터 무변경'으로 조회됩니다 (MG1004 · BS0006)"
        actions={
          <button onClick={doExport}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-slate-200 flex items-center gap-2">
            <Icon name="download" className="w-3.5 h-3.5 text-emerald-300" />엑셀 다운로드
          </button>
        }
      />

      {/* 필터 카드 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div>
            <div className="text-[11px] text-slate-500 mb-1">기간 <span className="text-rose-300">*</span> <span className="text-slate-600">(초깃값: 최근 7일)</span></div>
            <div className="flex items-center gap-1.5">
              <input type="date" value={flt.from} onChange={(e) => setFlt({ from: e.target.value })} className={inputCls} />
              <span className="text-slate-600 text-xs">~</span>
              <input type="date" value={flt.to} onChange={(e) => setFlt({ to: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">변경자</div>
            <select value={flt.actor} onChange={(e) => setFlt({ actor: e.target.value })} className={inputCls}>
              <option value="ALL">전체</option>
              <option value="SYSTEM">시스템(자동)</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">대상</div>
            <select value={flt.entity} onChange={(e) => setFlt({ entity: e.target.value })} className={inputCls}>
              <option value="ALL">전체</option>
              <option value="ORDER">주문</option>
              <option value="APPROVAL">결재</option>
              <option value="SETTLEMENT">정산 (지급명세서 포함)</option>
              <option value="FREELANCER">프리랜서</option>
              <option value="EMPLOYEE">직원</option>
              <option value="PERMISSION">권한</option>
              <option value="TASK">작업</option>
            </select>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 mb-1">행위 <span className="text-slate-600">(append-only — 삭제 없음)</span></div>
            <select value={flt.action} onChange={(e) => setFlt({ action: e.target.value })} className={inputCls}>
              <option value="ALL">전체</option>
              <option value="UPDATE">수정 (재계산 포함)</option>
              <option value="APPEND">이벤트 적재</option>
              <option value="CONFIRM">확정</option>
              <option value="REJECT">반려</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <div className="text-[11px] text-slate-500 mb-1">대상 ID</div>
            <div className="relative">
              <Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={flt.q} onChange={(e) => setFlt({ q: e.target.value })} placeholder="주문·결재 번호 등"
                className={`${inputCls} w-full pl-8`} />
            </div>
          </div>
          <button onClick={() => toast(`재조회 완료 — ${filtered.length}건`)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
            조회
          </button>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-500 shrink-0">저장된 뷰</span>
          <SavedViewChips views={views} activeId={viewId} onSelect={selectView} allLabel="전체 이력" />
          <button onClick={saveView} className="px-2.5 py-1 rounded-full text-xs border border-dashed border-slate-600 text-slate-400 hover:text-purple-300 hover:border-purple-500/50">
            + 뷰로 저장
          </button>
          <span className="text-[10px] font-mono text-slate-600 ml-auto">숫자키 1~{views.length} 전환 · 패널 열고 ↑↓ 행 이동 (IDEA-05·06)</span>
        </div>
      </Card>

      {/* 적용 필터 칩 + 결과 요약 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-[11px] text-slate-500">적용 필터</span>
        {chips.length === 0 && <span className="text-[11px] text-slate-600">없음 — 전체 기간</span>}
        {chips.map((c) => (
          <button key={c.k} onClick={c.clear}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-purple-500/15 text-purple-200 border border-purple-500/30 hover:bg-purple-500/25">
            {c.label}<Icon name="x" className="w-3 h-3" />
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          조회 결과 <b className="font-mono tabular-nums text-slate-200">{filtered.length}</b>건
          <span className="text-slate-600"> · 시스템(자동) {sysCount} · 수기 {filtered.length - sysCount}</span>
        </span>
      </div>

      {/* 결과 테이블 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                <th className="pl-5 pr-3 py-2.5 font-medium">시각</th>
                <th className="px-3 py-2.5 font-medium">대상</th>
                <th className="px-3 py-2.5 font-medium">행위</th>
                <th className="px-3 py-2.5 font-medium">변경자</th>
                <th className="px-3 py-2.5 font-medium">트리거 / 사유</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((l) => (
                <tr key={l.id} onClick={() => setSelId(l.id)}
                  className={`border-b border-slate-800/70 cursor-pointer transition hover:bg-slate-800/30 ${selId === l.id ? 'bg-purple-500/10' : ''}`}>
                  <td className="pl-5 pr-3 py-2.5 font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">{l.at}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-slate-500 mr-1.5">{AL_ENTITY[l.entityType] || l.entityType}</span>
                    <span className="font-mono text-xs text-slate-200">{l.entityId}</span>
                    <div className="text-[10px] text-slate-600 truncate max-w-[240px]">{entityTitle(l)}</div>
                  </td>
                  <td className="px-3 py-2.5"><ActPill event={l.event} /></td>
                  <td className="px-3 py-2.5">
                    {l.actorType === 'SYSTEM' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-cyan-300">
                        <Icon name="zap" className="w-3 h-3" />시스템(자동)
                      </span>
                    ) : <span className="text-xs text-slate-300">{l.actor}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.approvalId ? (
                      <button onClick={(e) => { e.stopPropagation(); navigate('approvalDetail', { approvalId: l.approvalId }); }}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-300 hover:text-cyan-200 border-b border-dotted border-cyan-500/50">
                        결재 {l.approvalId}<Icon name="arrowRight" className="w-3 h-3" />
                      </button>
                    ) : <span className="text-[11px] text-slate-500 truncate block max-w-[260px]">{l.note || '—'}</span>}
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                  조건에 맞는 이력이 없어요 — 필터 칩의 ×를 눌러 조건을 넓혀 보세요
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* 페이지네이션 — 인피니트 스크롤 없음 (건수 파악·감사 추적) */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-800 text-xs text-slate-400">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className={`px-2.5 py-1 rounded border border-slate-700 ${page === 1 ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-800'}`}>
            ‹ 이전
          </button>
          <span className="font-mono tabular-nums">{page} / {pages} 페이지</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
            className={`px-2.5 py-1 rounded border border-slate-700 ${page === pages ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-800'}`}>
            다음 ›
          </button>
        </div>
      </Card>

      {/* ══ 변경 상세 사이드 패널 (IDEA-06 — ↑↓ 행 이동, Esc 닫기) ══ */}
      <SidePanel
        open={!!sel} onClose={() => setSelId(null)}
        title="변경 상세" subtitle={sel ? `이력 ${sel.id} · ↑↓로 다음 행` : ''}
        footer={sel && (
          <div className="flex gap-2">
            <button onClick={() => { setFltRaw({ ...AL_DEF, from: '', to: '', q: sel.entityId }); setViewId(null); setPage(1); setSelId(null); }}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 flex items-center justify-center gap-1.5">
              <Icon name="filter" className="w-3.5 h-3.5" />이 대상의 전체 이력
            </button>
            <button onClick={() => openOrigin(sel)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center justify-center gap-1.5">
              원본 화면 열기<Icon name="external" className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      >
        {sel && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-800">
                <span className="text-slate-500 text-xs">기록 시각</span>
                <span className="font-mono text-xs tabular-nums text-slate-200">{sel.at}</span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-800 items-center">
                <span className="text-slate-500 text-xs">행위</span><ActPill event={sel.event} />
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-800">
                <span className="text-slate-500 text-xs shrink-0">대상</span>
                <span className="text-right text-xs">
                  <span className="text-slate-400">{AL_ENTITY[sel.entityType] || sel.entityType}</span>{' '}
                  <span className="font-mono text-slate-200">{sel.entityId}</span>
                  {entityTitle(sel) && <span className="block text-slate-500 mt-0.5">{entityTitle(sel)}</span>}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-800">
                <span className="text-slate-500 text-xs">변경자</span>
                <span className="text-right text-xs">
                  {sel.actorType === 'SYSTEM' ? (
                    <span className="text-cyan-300 inline-flex items-center gap-1"><Icon name="zap" className="w-3 h-3" />시스템(자동)
                      <span className="text-slate-500 font-mono text-[10px]">7연쇄 자동 반영 — MG1001</span></span>
                  ) : <span className="text-slate-200">{sel.actor}</span>}
                </span>
              </div>
              <div className="flex justify-between gap-3 py-1.5">
                <span className="text-slate-500 text-xs shrink-0">사유</span>
                <span className="text-right text-xs text-slate-300 max-w-[300px]">{sel.note || '—'}</span>
              </div>
            </div>

            {/* 원인 결재 — 반영 영수증 역추적 (IDEA-07·08, 문제 104·110) */}
            {sel.approvalId && (
              <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">원인 결재 · 역추적</div>
                <button onClick={() => navigate('approvalDetail', { approvalId: sel.approvalId })}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-cyan-500/30 hover:border-cyan-400/60 text-left flex items-center gap-2.5 transition">
                  <Icon name="receipt" className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-slate-200">결재 <b className="font-mono">{sel.approvalId}</b> 반영 영수증 열기</span>
                    {selApr && <span className="block text-[10px] text-slate-500 truncate">{selApr.opinion}</span>}
                  </span>
                  {selApr && <EnumPill status={selApr.status} />}
                  <Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
                {sel.event === 'RECALC' && (
                  <button onClick={() => navigate('settlement', { settlementId: sel.entityId })}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-[11px] text-cyan-300 hover:bg-cyan-500/20">
                    <Icon name="calculator" className="w-3 h-3" />정산 재계산 이력 {sel.entityId} — 이전액/재계산액/차액 3열 (BS0007)
                  </button>
                )}
              </div>
            )}

            <DiffRow l={sel} />

            {sel.event === 'REJECT' && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-[11px] text-rose-200 flex items-start gap-2">
                <Icon name="shieldCheck" className="w-3.5 h-3.5 mt-px shrink-0" />
                반려 건 — 주문·매출·정산 데이터는 변경되지 않았고, 그 사실만 이력으로 남았습니다 (무변경 원칙 BS0006)
              </div>
            )}
            <div className="text-[10px] text-slate-600 leading-relaxed">
              감사 로그는 append-only — 이 화면은 수정·삭제 기능을 제공하지 않습니다. 업무 처리(704)와 동일 트랜잭션으로 적재되어 조회 결과는 항상 정합합니다.
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}
window.AuditLog = AuditLog;
