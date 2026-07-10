// admin.jsx — 09 시스템 설정: 조직·권한(역할×메뉴 매트릭스) / 외부 연동·AI 파싱 검수 / 감사 이력
// 2-1 동적 접근 권한 제어(RBAC 실시간 매핑) · 2-2 수집 연동(§12.10) · AI 후보 검수 후 반영(ADR-004)
// 감사 이력은 08 이력 화면과 중복 구현하지 않고 링크만 제공
const { useState: useState_a, useMemo: useMemo_a } = React;

// 직원 role(ADMIN|MANAGER|FINANCE|STAFF) → 라벨·색 — 승인선 ROLE_LABELS(팀장/재무/대표)와는 별개 축
const EMP_ROLE_META = {
  ADMIN:   { label: "시스템 관리자", short: "관리자", bg: "bg-purple-500/15",  text: "text-purple-300", dot: "bg-purple-400" },
  MANAGER: { label: "팀장",          short: "팀장",   bg: "bg-cyan-500/15",    text: "text-cyan-300",   dot: "bg-cyan-400" },
  FINANCE: { label: "재무",          short: "재무",   bg: "bg-amber-500/15",   text: "text-amber-300",  dot: "bg-amber-400" },
  STAFF:   { label: "일반 직원",      short: "직원",   bg: "bg-slate-500/15",   text: "text-slate-300",  dot: "bg-slate-400" },
};

// 권한 매트릭스 행 = 사이드바 9메뉴 (키·라벨·아이콘은 index.html 사이드바와 정합)
const MENU_META = [
  ["dashboard",  "대시보드",   "home"],
  ["orders",     "주문 관리",  "file"],
  ["kanban",     "작업 칸반",  "template"],
  ["console",    "환불 결재",  "send"],
  ["templates",  "결재 양식",  "shieldCheck"],
  ["settlement", "정산 관리",  "db"],
  ["hr",         "인사 · 조직", "user2"],
  ["history",    "이력 · 수집", "history"],
  ["admin",      "시스템 설정", "settings"],
];
const ROLE_ORDER = ["ADMIN", "MANAGER", "FINANCE", "STAFF"];

// 연동 수집 방식 배지 (history.jsx 수집 경로 색상과 동일 언어)
const METHOD_META = {
  API:   { label: "API",    bg: "bg-cyan-500/15",    text: "text-cyan-300" },
  EXCEL: { label: "엑셀",    bg: "bg-emerald-500/15", text: "text-emerald-300" },
  CRAWL: { label: "크롤링",  bg: "bg-purple-500/15",  text: "text-purple-300" },
};
// 연동 상태 — CONNECTED(정상)·MANUAL(수동 대체)·ERROR(장애)
const INT_STATUS_META = {
  CONNECTED: { label: "정상 연동", bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400", border: "border-emerald-700/50" },
  MANUAL:    { label: "수동 대체", bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400",   border: "border-amber-700/50" },
  ERROR:     { label: "연동 오류", bg: "bg-rose-500/15",    text: "text-rose-300",    dot: "bg-rose-400",     border: "border-rose-700/50" },
};

const confColor = (c) => (c >= 0.9 ? "#10b981" : c >= 0.75 ? "#f59e0b" : "#f43f5e");
const nowClock = () => {
  const d = new Date();
  return `2026-07-10 ${window.pad(d.getHours())}:${window.pad(d.getMinutes())}:${window.pad(d.getSeconds())}`;
};

function Admin({ navigate }) {
  const [tab, setTab] = useState_a("org");   // org | integrations | audit

  // ── 권한 매트릭스 로컬 상태 (ROLE_MATRIX 초기값 복제 — data.js 무변경) ──
  const [matrix, setMatrix] = useState_a(() => {
    const m = {};
    ROLE_ORDER.forEach(r => { m[r] = { ...window.ROLE_MATRIX[r] }; });
    return m;
  });
  const [changeLog, setChangeLog] = useState_a([]);   // 최근 토글 이력 (감사 스니펫)

  const togglePerm = (role, menu) => {
    if (role === "ADMIN") return;   // 시스템 관리자는 전 메뉴 고정 (직무 분리 기준선)
    const next = !matrix[role][menu];
    setMatrix(m => ({ ...m, [role]: { ...m[role], [menu]: next } }));
    const menuLabel = MENU_META.find(x => x[0] === menu)[1];
    setChangeLog(l => [
      { at: nowClock(), role, menu, menuLabel, value: next },
      ...l,
    ].slice(0, 4));
  };

  // ── AI 파싱 검수 로컬 상태 ──
  const [reviewed, setReviewed] = useState_a({});     // jobId → true (반영 완료)
  const [editingId, setEditingId] = useState_a(null); // 수정 모드(데모) 표시용

  // ── 부서 → 소속 직원 그룹 ──
  const empByDept = useMemo_a(() => {
    const g = {};
    window.EMPLOYEES.forEach(e => { (g[e.deptId] = g[e.deptId] || []).push(e); });
    return g;
  }, []);
  const empName = (id) => (window.EMPLOYEES.find(e => e.id === id) || {}).name || "—";

  // ── 연동 상태 요약 ──
  const intStats = useMemo_a(() => {
    const s = { CONNECTED: 0, MANUAL: 0, ERROR: 0 };
    window.INTEGRATION_SOURCES.forEach(i => { s[i.status] = (s[i.status] || 0) + 1; });
    return s;
  }, []);

  const TABS = [
    ["org",          "조직 · 권한",   "user2"],
    ["integrations", "외부 연동",     "db"],
    ["audit",        "감사 이력",     "shieldCheck"],
  ];

  return (
    <div className="space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="purple">ADMIN · 시스템 설정</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">조직 · 권한 · 연동</h1>
          <p className="text-sm text-slate-300 mt-1">역할–메뉴 접근을 실시간으로 매핑하고, 외부 수집 연동과 AI 추출 검수를 관리합니다</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/60 text-slate-300">
            연동 <b className="tabular-nums">{window.INTEGRATION_SOURCES.length}</b> · 정상 <b className="text-emerald-300 tabular-nums">{intStats.CONNECTED}</b> · 대체 <b className="text-amber-300 tabular-nums">{intStats.MANUAL}</b> · 오류 <b className="text-rose-300 tabular-nums">{intStats.ERROR}</b>
          </span>
        </div>
      </div>

      {/* ── 탭 바 ── */}
      <div className="border-b border-slate-700/60 flex items-center gap-1">
        {TABS.map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 ${tab === k ? 'border-purple-500 text-purple-200' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <window.Icon name={ic} className="w-3.5 h-3.5" />{l}
          </button>
        ))}
      </div>

      {/* ══════════ 탭 1 · 조직 · 권한 (2-1 동적 접근 권한 제어) ══════════ */}
      {tab === "org" && (
        <div className="grid grid-cols-12 gap-4">
          {/* 좌 · 부서 트리 + 직원 목록 */}
          <window.Card className="col-span-12 lg:col-span-5 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">부서 · 직원</h3>
              <span className="text-[10px] font-mono text-slate-500">{window.DEPARTMENTS.length}개 부서 · {window.EMPLOYEES.length}명</span>
            </div>
            <div className="space-y-3">
              {window.DEPARTMENTS.map(dept => (
                <div key={dept.id} className="rounded-lg bg-slate-950/60 border border-slate-700/60 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <window.Icon name="user2" className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-100">{dept.name}</span>
                      <span className="text-[10px] font-mono text-slate-600">{dept.id}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">부서장 <span className="text-slate-200 font-medium">{empName(dept.headId)}</span></span>
                  </div>
                  <div className="divide-y divide-slate-800/70">
                    {(empByDept[dept.id] || []).map(e => {
                      const rm = EMP_ROLE_META[e.role];
                      return (
                        <div key={e.id} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{e.name[0]}</div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-100 flex items-center gap-1.5">
                                {e.name}
                                {e.id === dept.headId && <span className="text-[9px] px-1 py-px rounded bg-slate-700/60 text-slate-300">장</span>}
                              </div>
                              <div className="text-[10px] text-slate-500">{e.position}</div>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-md ${rm.bg} ${rm.text} px-2 py-0.5 text-[10px] font-medium flex-shrink-0`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rm.dot}`}></span>{rm.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/50 text-[10px] text-slate-500 leading-relaxed">
              프리랜서 · 인플루언서는 로그인 계정이 없습니다 (외주 인력 — 07 인사·조직에서 별도 관리)
            </div>
          </window.Card>

          {/* 우 · 역할 × 메뉴 권한 매트릭스 */}
          <window.Card className="col-span-12 lg:col-span-7 p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="font-semibold text-sm">역할 × 메뉴 접근 권한</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">부서 · 직급 기준 동적 접근 제어 — 셀을 클릭하면 즉시 반영되고 변경 이력이 저장됩니다 (RBAC 실시간 매핑)</p>
              </div>
              <span className="text-[10px] font-mono text-slate-600 flex-shrink-0 ml-2">MG1002</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50">
                    <th className="text-left px-2 py-2 font-medium">메뉴</th>
                    {ROLE_ORDER.map(r => (
                      <th key={r} className="px-2 py-2 font-medium text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={EMP_ROLE_META[r].text}>{EMP_ROLE_META[r].short}</span>
                          {r === "ADMIN" && <span className="text-[8px] text-slate-600 normal-case tracking-normal">고정</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MENU_META.map(([key, label, icon]) => (
                    <tr key={key} className="border-b border-slate-800/70">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                          <window.Icon name={icon} className="w-3.5 h-3.5 text-slate-500" />{label}
                        </div>
                      </td>
                      {ROLE_ORDER.map(r => {
                        const on = matrix[r][key];
                        const locked = r === "ADMIN";
                        return (
                          <td key={r} className="px-2 py-2 text-center">
                            <button
                              onClick={() => togglePerm(r, key)}
                              disabled={locked}
                              aria-label={`${EMP_ROLE_META[r].short} ${label} 접근 ${on ? '허용' : '차단'}`}
                              title={locked ? "시스템 관리자 — 전 메뉴 고정" : `클릭하여 ${on ? '차단' : '허용'}`}
                              className={`w-8 h-8 rounded-md border inline-flex items-center justify-center transition ${
                                on
                                  ? 'bg-emerald-500/15 border-emerald-600/50 text-emerald-300'
                                  : 'bg-slate-950/60 border-slate-700/60 text-slate-600'
                              } ${locked ? 'opacity-70 cursor-not-allowed' : 'hover:border-purple-500/50 cursor-pointer'}`}>
                              <window.Icon name={on ? "check" : "x"} className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 변경 이력 스니펫 — 즉시 반영 + 감사 저장 */}
            <div className="mt-4 rounded-lg bg-slate-950/60 border border-slate-700/60 p-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-300 mb-1.5">
                <window.Icon name="history" className="w-3.5 h-3.5 text-purple-300" />
                <span className="font-medium">변경 이력 저장됨 · 즉시 반영</span>
                <span className="text-slate-600">— 모든 권한 변경은 전 / 후 값과 함께 감사 로그에 기록됩니다</span>
              </div>
              {changeLog.length === 0 ? (
                <div className="text-[11px] text-slate-500">셀을 클릭하면 역할별 메뉴 접근이 즉시 전환되고, 아래에 변경 이력이 남습니다.</div>
              ) : (
                <div className="space-y-1 font-mono text-[11px] text-slate-400">
                  {changeLog.map((c, i) => (
                    <div key={i} className={i === 0 ? "text-slate-200" : ""}>
                      {c.at} · PERM_UPDATE · {c.role}.{c.menu} = {c.value ? "GRANT" : "REVOKE"}
                      <span className="text-slate-600"> · {EMP_ROLE_META[c.role].short} “{c.menuLabel}” {c.value ? "허용" : "차단"} · 변경자 김민석(관리자)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 text-[10px] text-slate-500 leading-relaxed">
              1차는 역할 기반(RBAC) 실시간 매핑입니다 — 행 단위 데이터 권한(자기 부서만 조회)은 Phase 2 확장 대상입니다.
            </div>
          </window.Card>
        </div>
      )}

      {/* ══════════ 탭 2 · 외부 연동 (2-2 수집 · §12.10) + AI 파싱 검수 ══════════ */}
      {tab === "integrations" && (
        <div className="space-y-5">
          {/* 연동 소스 카드 4장 */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-semibold text-sm">플랫폼 연동 소스</h3>
              <span className="text-[10px] text-slate-500">PoC 검증된 플랫폼만 연동 — 신규 소스 탐색은 Phase 2 (§12.10)</span>
            </div>
            <div className="grid grid-cols-12 gap-4">
              {window.INTEGRATION_SOURCES.map(src => {
                const st = INT_STATUS_META[src.status];
                const mt = METHOD_META[src.method];
                return (
                  <window.Card key={src.id} className={`col-span-12 md:col-span-6 xl:col-span-3 p-4 ${src.status === 'ERROR' ? '!border-rose-700/50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">{src.name}</div>
                        <span className={`inline-flex items-center mt-1.5 rounded-md ${mt.bg} ${mt.text} px-2 py-0.5 text-[10px] font-medium`}>{mt.label}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-md ${st.bg} ${st.text} px-2 py-0.5 text-[10px] font-medium flex-shrink-0`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>{st.label}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">최근 동기화</span>
                        <span className="font-mono text-slate-400 tabular-nums">{src.lastSync}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-relaxed">{src.note}</div>
                    </div>
                    {src.status === "ERROR" && (
                      <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-700/50 p-2.5">
                        <div className="flex items-start gap-1.5 text-[11px] text-rose-200 leading-relaxed">
                          <window.Icon name="alert" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <span>→ 수동 업로드 대체 경로 활성 (<b className="font-mono">IMP-004</b>) — 업무 중단 없음</span>
                        </div>
                        <button onClick={() => navigate("history")}
                          className="mt-2 w-full px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700/60 hover:border-rose-500/50 text-[11px] text-slate-200 flex items-center justify-center gap-1.5 transition">
                          <window.Icon name="history" className="w-3 h-3" />수집 이력에서 대체 배치 보기
                          <window.Icon name="arrowRight" className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    )}
                  </window.Card>
                );
              })}
            </div>
          </div>

          {/* AI 파싱 검수 미니 (ADR-004 — 검수 후 반영) */}
          <window.Card className="p-5">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <window.Icon name="sparkles" className="w-4 h-4 text-purple-300" />
                <h3 className="font-semibold text-sm">AI 파싱 검수</h3>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-700/50 leading-tight text-right">
                AI 결과는 즉시 반영하지 않고 담당자 검수 후 반영 · Phase 2 옵션 (ADR-004)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">비정형 문서(정산서 PDF · 세금계산서)에서 추출한 후보 값을 검수한 뒤 본 테이블에 반영합니다. 계좌 등 민감정보는 마스킹 표시됩니다.</p>

            <div className="grid grid-cols-12 gap-4">
              {window.AI_PARSE_JOBS.map(job => {
                const done = reviewed[job.id];
                const ex = job.extracted;
                const pct = Math.round(job.confidence * 100);
                return (
                  <div key={job.id} className="col-span-12 lg:col-span-6 rounded-xl bg-slate-950/60 border border-slate-700/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <window.Icon name="file" className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">{job.source}</div>
                          <div className="text-[10px] font-mono text-slate-500">{job.id}</div>
                        </div>
                      </div>
                      <window.EnumPill status={job.status} />
                    </div>

                    {/* 신뢰도 게이지 */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-500">추출 신뢰도</span>
                        <span className="font-mono tabular-nums" style={{ color: confColor(job.confidence) }}>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: confColor(job.confidence) }}></div>
                      </div>
                      {job.confidence < 0.85 && (
                        <div className="mt-1 text-[10px] text-amber-300/90">신뢰도 낮음 — 추출 값을 특히 꼼꼼히 검수하세요</div>
                      )}
                    </div>

                    {/* 추출 필드 표 */}
                    <div className="mt-3 rounded-lg border border-slate-700/60 overflow-hidden">
                      {[
                        ["이름", ex.name],
                        ["계좌", <span className="font-mono">{ex.bank}</span>],
                        ["금액", `₩${window.fmt(ex.amount)}`],
                        ["캠페인", ex.campaign],
                      ].map(([k, v], i, arr) => (
                        <div key={k} className={`flex text-[11px] ${i < arr.length - 1 ? 'border-b border-slate-800/70' : ''}`}>
                          <div className="w-16 flex-shrink-0 px-2.5 py-1.5 bg-slate-900 text-slate-500 border-r border-slate-800/70">{k}</div>
                          <div className="flex-1 px-2.5 py-1.5 text-slate-200">{v}</div>
                        </div>
                      ))}
                    </div>

                    {editingId === job.id && !done && (
                      <div className="mt-2 text-[10px] text-cyan-300 flex items-center gap-1.5">
                        <window.Icon name="alert" className="w-3 h-3" />추출 값 수정 모드 (데모) — 검수 후 반영 시 수정 내용이 저장됩니다
                      </div>
                    )}

                    {/* 액션 — 로컬 시뮬 */}
                    {done ? (
                      <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-700/50 p-2.5 text-[11px] text-emerald-200 flex items-start gap-1.5">
                        <window.Icon name="check" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span>검수 승인 완료 · 본 테이블에 반영 — 감사 로그 기록 ({nowClock()})</span>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => setEditingId(id => id === job.id ? null : job.id)}
                          className="py-2 rounded-md bg-slate-900 border border-slate-700/60 hover:border-cyan-500/50 text-xs text-slate-200 flex items-center justify-center gap-1.5 transition">
                          <window.Icon name="file" className="w-3 h-3" />수정
                        </button>
                        <button onClick={() => setReviewed(r => ({ ...r, [job.id]: true }))}
                          className="py-2 rounded-md bg-emerald-500/15 border border-emerald-600/50 hover:bg-emerald-500/25 text-xs text-emerald-200 font-medium flex items-center justify-center gap-1.5 transition">
                          <window.Icon name="check" className="w-3 h-3" />검수 승인 후 반영
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </window.Card>
        </div>
      )}

      {/* ══════════ 탭 3 · 감사 이력 (링크만 — 08 이력 화면과 중복 구현 금지) ══════════ */}
      {tab === "audit" && (
        <div className="grid grid-cols-12 gap-4">
          <window.Card className="col-span-12 lg:col-span-8 p-6">
            <div className="flex items-center gap-2">
              <window.Icon name="shieldCheck" className="w-4 h-4 text-emerald-300" />
              <h3 className="font-semibold">모든 데이터 변경은 전 / 후 값과 함께 저장됩니다</h3>
            </div>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              결재 승인·반려, 정산 재계산·조정, 권한 매트릭스 변경, 외부 수집 배치까지 — 시스템의 모든 변경 이벤트는
              변경자 · 시각 · 변경 전후 값과 함께 감사 로그로 남습니다. 반려된 결재는 데이터를 바꾸지 않으며, 그 사실 또한 기록됩니다(무변경 원칙 BS0006).
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["결재 이력", "shieldCheck", `${window.APPROVALS.length}건 · 승인선·후속 7연쇄 반영 결과`],
                ["수집 이력", "db", `${window.IMPORT_BATCHES.length}건 · API 실패 → 엑셀 대체 fallback 포함`],
                ["권한 변경", "user2", "역할–메뉴 매핑 변경 (본 화면 · 즉시 반영)"],
                ["정산 조정", "activity", "확정 후 조정 이벤트로만 반영 (MG1003)"],
              ].map(([t, ic, d]) => (
                <div key={t} className="rounded-lg bg-slate-950/60 border border-slate-700/60 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                    <window.Icon name={ic} className="w-3.5 h-3.5 text-slate-400" />{t}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{d}</div>
                </div>
              ))}
            </div>
            <button onClick={() => navigate("history")}
              className="mt-5 w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20">
              변경 이력 전체 보기
              <window.Icon name="arrowRight" className="w-4 h-4" />
            </button>
            <div className="mt-2 text-[10px] text-slate-500 text-center">대상 · 기간 · 변경자 검색과 전/후 값 비교는 08 이력 · 수집 화면에서 제공됩니다</div>
          </window.Card>

          <window.Card className="col-span-12 lg:col-span-4 p-6 flex flex-col justify-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center">
              <window.Icon name="history" className="w-5 h-5 text-purple-300" />
            </div>
            <div className="text-sm font-semibold text-slate-100">감사 추적성 보장</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              누가 · 언제 · 무엇을 바꿨는지 되짚을 수 있어야 재무 정합성과 책임 소재가 유지됩니다. 이력은 삭제·수정할 수 없고 append-only로 축적됩니다.
            </p>
            <div className="mt-1 pt-3 border-t border-slate-700/50 text-[10px] font-mono text-slate-500 space-y-1">
              <div>append-only · immutable</div>
              <div>before → after 값 저장</div>
              <div>actor · timestamp · reason</div>
            </div>
          </window.Card>
        </div>
      )}
    </div>
  );
}

window.Admin = Admin;
