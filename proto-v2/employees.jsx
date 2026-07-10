// employees.jsx — 34 직원 관리 (route: employees)
// 모델: 5_프로토타입모델_직원관리.md · 공통 표준 정밀 적용 — §4.3 diff 이력 · §4.6 중위험 확인(퇴사)
// 퇴사 = 데이터 보존 + 접근 차단(삭제 없음, MG1004) · 승인권자 공석 경고 + 권한 설정 직행
const { useState, useMemo } = React;

// 로컬 보강 — EMPLOYEES에 없는 필드(이메일·근무 상태·최근 접속·최초 로그인 여부·변경 이력)
const EM_EXTRA = {
  "EMP-01": { email: "minseok.kim@agency.co.kr",  status: "EMPLOYED", lastLoginAt: "2026-07-10", firstLoginDone: true },
  "EMP-02": { email: "daeun.jung@agency.co.kr",   status: "EMPLOYED", lastLoginAt: "2026-07-10", firstLoginDone: true },
  "EMP-03": { email: "junhyuk.park@agency.co.kr", status: "EMPLOYED", lastLoginAt: "2026-07-10", firstLoginDone: true },
  "EMP-04": { email: "sumin.lee@agency.co.kr",    status: "EMPLOYED", lastLoginAt: "2026-07-09", firstLoginDone: true },
  "EMP-05": { email: "doyun.kim@agency.co.kr",    status: "ON_LEAVE", lastLoginAt: "2026-06-27", firstLoginDone: true },
  "EMP-06": { email: "haeun.jung@agency.co.kr",   status: "EMPLOYED", lastLoginAt: "2026-07-10", firstLoginDone: true },
  "EMP-07": { email: "soyul.han@agency.co.kr",    status: "EMPLOYED", lastLoginAt: "2026-07-09", firstLoginDone: true },
  "EMP-08": { email: "jiwon.seo@agency.co.kr",    status: "EMPLOYED", lastLoginAt: "2026-07-10", firstLoginDone: true },
  "EMP-09": { email: "sehun.oh@agency.co.kr",     status: "EMPLOYED", lastLoginAt: "2026-07-10", firstLoginDone: true },
  "EMP-10": { email: "gayoung.moon@agency.co.kr", status: "EMPLOYED", lastLoginAt: null,          firstLoginDone: false }, // 초대 메일 재발송 활성 케이스
};
const EM_HISTORY_SEED = {
  "EMP-03": [{ at: "2026-06-02", field: "역할", before: "STAFF", after: "TEAM_LEAD", by: "오세훈" }],
  "EMP-05": [{ at: "2026-07-01", field: "상태", before: "재직", after: "휴직", by: "오세훈" }],
  "EMP-02": [{ at: "2026-05-12", field: "직급", before: "재무 매니저", after: "재무팀장", by: "오세훈" }],
};
const EM_STATUS_META = {
  EMPLOYED: { label: "재직", c: "emerald" }, ON_LEAVE: { label: "휴직", c: "amber" }, RESIGNED: { label: "퇴사", c: "slate" },
};
const EM_POSITIONS = ["대표이사", "팀장", "매니저", "팀원"];
const EM_ROLES = ["ADMIN", "EXEC", "TEAM_LEAD", "FINANCE", "STAFF"];
// 부서×직급 조합의 권장 역할 (MG1005 초깃값)
const EM_RECOMMEND = (deptId, position) =>
  position === "대표이사" ? "EXEC" : deptId === "DEPT-5" && position === "팀장" ? "FINANCE" : position === "팀장" ? "TEAM_LEAD" : "STAFF";

function Employees({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, ConfirmDialog, Icon, PILL_COLORS } = window;

  const [emps, setEmps] = useState(() => EMPLOYEES.map((e) => ({ ...e, ...EM_EXTRA[e.id] })));
  const [history, setHistory] = useState(EM_HISTORY_SEED);
  const [deptF, setDeptF] = useState("ALL");
  const [statusF, setStatusF] = useState("EMPLOYED"); // 초깃값: 재직 (모델 항목표)
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState(null);             // 'edit' | 'new' | null
  const [form, setForm] = useState(null);
  const [orig, setOrig] = useState(null);
  const [emailErr, setEmailErr] = useState(null);
  const [resignAsk, setResignAsk] = useState(false);
  const [resendCount, setResendCount] = useState(0);  // 하루 3회 제한

  const StatusPill = ({ status }) => {
    const m = EM_STATUS_META[status] || EM_STATUS_META.EMPLOYED;
    const c = PILL_COLORS[m.c];
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md border ${c.bg} ${c.text} ${c.border} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>{m.label}
      </span>
    );
  };

  const filtered = useMemo(() => emps.filter((e) => {
    if (deptF !== "ALL" && e.deptId !== deptF) return false;
    if (statusF !== "ALL" && e.status !== statusF) return false;
    if (keyword && !(e.name.includes(keyword) || e.email.includes(keyword))) return false;
    return true;
  }), [emps, deptF, statusF, keyword]);

  const counts = useMemo(() => ({
    e: emps.filter((x) => x.status === "EMPLOYED").length,
    l: emps.filter((x) => x.status === "ON_LEAVE").length,
    r: emps.filter((x) => x.status === "RESIGNED").length,
  }), [emps]);

  const deptOf = (id) => DEPARTMENTS.find((d) => d.id === id);
  // 승인권자 공석 경고 근거 — 진행 중 결재에서 이 직원 차례(PENDING)인 문서
  const pendingApprovalsOf = (empId) => APPROVALS.filter((a) => a.status === "IN_PROGRESS" && a.approvalLine.some((s) => s.approverId === empId && s.status === "PENDING"));

  const loadRow = (e) => {
    setMode("edit"); setForm({ ...e }); setOrig({ ...e }); setEmailErr(null);
  };
  const openNew = () => {
    setMode("new"); setOrig(null); setEmailErr(null);
    setForm({ id: `EMP-${String(emps.length + 1).padStart(2, "0")}`, name: "", email: "", deptId: "DEPT-1", position: "팀원", role: "STAFF", joinedAt: TODAY, status: "EMPLOYED", lastLoginAt: null, firstLoginDone: false, active: true });
  };

  const validateEmail = (email) => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "이메일 형식이 올바르지 않습니다";
    if (emps.some((e) => e.email === email && (!orig || e.id !== orig.id))) return "이미 등록된 이메일입니다";
    return null;
  };

  const save = () => {
    if (!form.name || !form.email) { window.toast("이름·이메일은 필수입니다", { tone: "error" }); return; }
    const err = validateEmail(form.email);
    setEmailErr(err);
    if (err) return;
    if (mode === "new") {
      setEmps((s) => [...s, form]);
      setMode("edit"); setOrig({ ...form });
      window.toast(`${form.name} 등록 완료 — 초대 메일 발송(발송대기, BS0011) · 본인이 첫 로그인에서 비밀번호를 설정합니다`, { actionLabel: "권한 설정에서 메뉴 노출 확인 →", onAction: () => navigate("permissions", { role: form.role }) });
    } else {
      // §4.3 diff — 변경 전/후 값 이력 적재 (MG1004)
      const diffs = [];
      const fields = [["role", "역할"], ["deptId", "부서"], ["position", "직급"], ["status", "상태"], ["email", "이메일"]];
      fields.forEach(([k, label]) => {
        if (orig[k] !== form[k]) {
          const disp = (v) => k === "deptId" ? (deptOf(v) ? deptOf(v).name : v) : k === "status" ? EM_STATUS_META[v].label : v;
          diffs.push({ at: TODAY, field: label, before: disp(orig[k]), after: disp(form[k]), by: "오세훈" });
        }
      });
      setEmps((s) => s.map((e) => (e.id === form.id ? { ...form } : e)));
      if (diffs.length) setHistory((h) => ({ ...h, [form.id]: [...diffs, ...(h[form.id] || [])] }));
      setOrig({ ...form });
      const roleChanged = diffs.some((d) => d.field === "역할");
      window.toast(diffs.length ? `저장 완료 — 변경 ${diffs.length}건이 이력으로 기록됐어요 (MG1004)${roleChanged ? " · 사이드바 메뉴 노출이 갱신됩니다 (MG1005)" : ""}` : "변경 사항이 없어요", diffs.length ? { actionLabel: "변경 이력 전체 →", onAction: () => navigate("auditLog", { entityId: form.id }) } : { tone: "warn" });
    }
  };

  const resign = () => {
    setEmps((s) => s.map((e) => (e.id === form.id ? { ...e, status: "RESIGNED", active: false } : e)));
    setHistory((h) => ({ ...h, [form.id]: [{ at: TODAY, field: "상태", before: EM_STATUS_META[form.status].label, after: "퇴사", by: "오세훈" }, ...(h[form.id] || [])] }));
    setForm((f) => ({ ...f, status: "RESIGNED" })); setOrig((o) => ({ ...o, status: "RESIGNED" }));
    setResignAsk(false);
    window.toast(`${form.name} 퇴사 처리 완료 — 접근은 즉시 차단, 작성 데이터는 전부 보존됩니다 (MG1004)`, { actionLabel: "변경 이력 확인 →", onAction: () => navigate("auditLog", { entityId: form.id }) });
  };

  const resendInvite = () => {
    if (resendCount >= 3) { window.toast("초대 메일은 하루 3회까지만 재발송할 수 있어요", { tone: "error" }); return; }
    setResendCount((c) => c + 1);
    window.toast(`초대 메일 재발송 (${resendCount + 1}/3) — ${form.email} · 발송대기(QUEUED)`, { tone: "warn" });
  };

  const pendingOfForm = form ? pendingApprovalsOf(form.id) : [];
  const fld = "w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60";
  const lbl = "block text-xs text-slate-400 mb-1";

  return (
    <div>
      <PageHeader
        label="SYSTEM · 34" labelColor="cyan" title="직원 관리"
        desc="계정 등록과 부서 · 직급 · 역할 연결 — 퇴사는 삭제가 아니라 접근 차단 + 데이터 보존입니다 (UC34 · MG1004)"
        actions={
          <button onClick={openNew} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-1.5">
            <Icon name="plus" className="w-4 h-4" />신규 직원 등록
          </button>
        }
      />

      {/* 필터 + 건수 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none">
            <option value="ALL">부서 전체</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none">
            <option value="EMPLOYED">재직</option><option value="ON_LEAVE">휴직</option><option value="RESIGNED">퇴사</option><option value="ALL">전체</option>
          </select>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="이름 / 이메일 검색" className="w-52 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60" />
          <button onClick={() => window.toast(`검색 결과 ${filtered.length}명`)} className="px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm hover:bg-slate-700">검색</button>
          <span className="ml-auto text-xs text-slate-500">
            재직 <b className="text-emerald-300 tabular-nums">{counts.e}</b> · 휴직 <b className="text-amber-300 tabular-nums">{counts.l}</b> · 퇴사 <b className="text-slate-300 tabular-nums">{counts.r}</b>
          </span>
        </div>
      </Card>

      {/* 직원 목록 */}
      <Card className="overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-5 py-2.5 font-medium">이름</th>
                <th className="px-3 py-2.5 font-medium">이메일</th>
                <th className="px-3 py-2.5 font-medium">부서 / 직급</th>
                <th className="px-3 py-2.5 font-medium">역할</th>
                <th className="px-3 py-2.5 font-medium">상태</th>
                <th className="px-5 py-2.5 font-medium">최근 접속</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} onClick={() => loadRow(e)} className={`border-b border-slate-800/60 cursor-pointer transition ${form && form.id === e.id && mode === "edit" ? "bg-purple-500/10" : "hover:bg-slate-800/30"}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{e.name}{e.id === CURRENT_USER_ID && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300">나</span>}</div>
                    <div className="text-[10px] font-mono text-slate-500">{e.id}</div>
                  </td>
                  <td className="px-3 py-3 text-xs font-mono text-slate-400">{e.email}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">{deptOf(e.deptId) ? deptOf(e.deptId).name : "-"} / {e.position}</td>
                  <td className="px-3 py-3"><EnumPill status={e.role} /></td>
                  <td className="px-3 py-3"><StatusPill status={e.status} /></td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-400">{e.lastLoginAt || <span className="text-amber-300">최초 로그인 전</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">조건에 맞는 직원이 없어요</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 등록/수정 폼 */}
      {form ? (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-bold">{mode === "new" ? "신규 직원 등록" : `직원 수정 — ${form.name}`}</h3>
              {mode === "edit" && <StatusPill status={form.status} />}
            </div>
            {mode === "edit" && (
              <span className="text-[11px] text-slate-500">재직/휴직 전환은 저장으로 · 퇴사는 아래 [퇴사 처리]로만 (모델 34)</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div><label className={lbl}>* 이름</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fld} disabled={form.status === "RESIGNED"} /></div>
            <div>
              <label className={lbl}>* 이메일 <span className="text-slate-600">— 초대 메일 수신 주소</span></label>
              <input value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailErr(null); }} onBlur={() => setEmailErr(form.email ? validateEmail(form.email) : null)} className={`${fld} font-mono ${emailErr ? "border-rose-500/60" : ""}`} disabled={form.status === "RESIGNED"} />
              {emailErr && <p className="text-xs text-rose-300 mt-1">{emailErr}</p>}
            </div>
            <div><label className={lbl}>* 부서</label>
              <select value={form.deptId} onChange={(e) => setForm({ ...form, deptId: e.target.value, role: mode === "new" ? EM_RECOMMEND(e.target.value, form.position) : form.role })} className={fld} disabled={form.status === "RESIGNED"}>
                {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className={lbl}>* 직급</label>
              <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value, role: mode === "new" ? EM_RECOMMEND(form.deptId, e.target.value) : form.role })} className={fld} disabled={form.status === "RESIGNED"}>
                {EM_POSITIONS.concat(EM_POSITIONS.includes(form.position) ? [] : [form.position]).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>* 역할 <span className="text-slate-600">— RBAC 5종 고정 (MG1005){mode === "new" ? ` · 권장: ${EM_RECOMMEND(form.deptId, form.position)}` : ""}</span></label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={fld} disabled={form.status === "RESIGNED"}>
                {EM_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>입사일</label><input type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} className={`${fld} font-mono`} disabled={form.status === "RESIGNED"} /></div>
              {mode === "edit" && form.status !== "RESIGNED" && (
                <div><label className={lbl}>상태 (재직/휴직)</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={fld}>
                    <option value="EMPLOYED">재직</option><option value="ON_LEAVE">휴직 (접근 일시 차단)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* 안내 배너 2종 */}
          <div className="mt-4 space-y-2">
            <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 text-xs text-slate-300 flex items-start gap-2">
              <Icon name="mail" className="w-3.5 h-3.5 mt-0.5 text-cyan-300 shrink-0" />
              등록 완료 시 위 이메일로 초대 메일이 발송되고, 직원 본인이 첫 로그인에서 비밀번호를 설정합니다. 관리자는 비밀번호를 설정·열람할 수 없어요. 역할에 따라 메뉴가 노출됩니다 (MG1005)
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-slate-300 flex items-start gap-2">
              <Icon name="alert" className="w-3.5 h-3.5 mt-0.5 text-amber-300 shrink-0" />
              퇴사 처리 시 이 계정의 로그인·접근은 즉시 차단되지만, 이 직원이 작성·처리한 주문/결재/배정 데이터는 삭제되지 않고 보존됩니다. 모든 계정 변경은 변경 전/후 값이 이력으로 남습니다 (MG1004)
            </div>
          </div>

          {/* 변경 이력 — §4.3 diff */}
          {mode === "edit" && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">변경 이력 (최근 3건)</span>
                <button onClick={() => navigate("auditLog", { entityId: form.id })} className="text-[11px] text-purple-300 hover:text-purple-200">전체 보기 →</button>
              </div>
              {(history[form.id] || []).length === 0 ? (
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-xs text-slate-500">기록된 변경 이력이 없어요</div>
              ) : (
                <div className="space-y-1.5">
                  {(history[form.id] || []).slice(0, 3).map((h, i) => (
                    <div key={i} className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-slate-600">{h.at}</span>
                      <span className="text-slate-400">{h.field}</span>
                      <span className="line-through text-slate-500">{h.before}</span>
                      <Icon name="arrowRight" className="w-3 h-3 text-slate-600" />
                      <b className="text-slate-200">{h.after}</b>
                      <span className="ml-auto text-slate-600">변경자 {h.by}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 액션 */}
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            {mode === "edit" && !form.firstLoginDone && form.status !== "RESIGNED" && (
              <button onClick={resendInvite} className="px-3.5 py-2 rounded-lg text-sm text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 flex items-center gap-1.5">
                <Icon name="mail" className="w-3.5 h-3.5" />초대 메일 재발송 <span className="font-mono text-[10px]">({resendCount}/3)</span>
              </button>
            )}
            {mode === "edit" && form.status !== "RESIGNED" && (
              <button onClick={() => setResignAsk(true)} className="px-3.5 py-2 rounded-lg text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20">퇴사 처리</button>
            )}
            {form.status !== "RESIGNED" && (
              <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">저장</button>
            )}
            {form.status === "RESIGNED" && <span className="text-xs text-slate-500">퇴사 계정 — 조회 전용 · 데이터는 보존됩니다</span>}
          </div>
        </Card>
      ) : (
        <window.EmptyState icon="users" title="직원을 선택하거나 신규 등록을 시작하세요"
          description="목록의 행을 클릭하면 이 자리에 수정 폼이 열립니다. 역할(RBAC 5종)에 따라 사이드바 메뉴 노출이 결정돼요 (MG1005)"
          actionLabel="신규 직원 등록" onAction={openNew}
          secondaryLabel="권한 설정 보기" onSecondary={() => navigate("permissions")} />
      )}

      {/* 퇴사 처리 — §4.6 중위험 + 승인권자 공석 경고 (모델 합의 2) */}
      <ConfirmDialog
        open={resignAsk} risk="mid" danger title="퇴사 처리"
        message={form ? `${form.name} (${form.position}) 계정을 퇴사 처리합니다` : ""}
        summary={form && (
          <div className="text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300"><Icon name="lock" className="w-3.5 h-3.5 text-slate-400" />로그인 · 접근이 즉시 차단됩니다</div>
            <div className="flex items-center gap-1.5 text-slate-300"><Icon name="db" className="w-3.5 h-3.5 text-emerald-400" />작성·처리한 주문/결재/배정 데이터는 삭제되지 않고 보존됩니다 (MG1004)</div>
            {pendingOfForm.length > 0 && (
              <div className="rounded-md bg-rose-500/10 border border-rose-500/30 p-2 mt-1">
                <div className="flex items-center gap-1.5 text-rose-300 font-medium"><Icon name="alert" className="w-3.5 h-3.5" />진행 중 결재 {pendingOfForm.length}건의 승인권자입니다</div>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">{pendingOfForm.map((a) => a.id).join(" · ")}</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  승인권자 공석은 상신 차단으로 이어져요 — 처리 전 승인선 재지정을 권장합니다.{" "}
                  <button onClick={() => { setResignAsk(false); navigate("permissions", { role: form.role }); }} className="text-rose-200 underline underline-offset-2">권한 설정으로 →</button>
                </div>
              </div>
            )}
            {form.deptId && DEPARTMENTS.some((d) => d.headId === form.id) && (
              <div className="flex items-center gap-1.5 text-amber-300"><Icon name="alert" className="w-3.5 h-3.5" />{deptOf(form.deptId) ? deptOf(form.deptId).name : ""} 부서장으로 지정되어 있어요 — 부서장 재지정 필요</div>
            )}
          </div>
        )}
        confirmLabel="퇴사 처리" onConfirm={resign} onClose={() => setResignAsk(false)}
      />
    </div>
  );
}

window.Employees = Employees;
