// freelancers.jsx — 31 프리랜서 마스터 (route: freelancers)
// 모델: 5_프로토타입모델_프리랜서마스터.md · IDEA-02(그리드) · IDEA-06(행 훑기 패널) · IDEA-12(스냅샷 안내)
// 민감정보 마스킹 기본 + 원문 열람 감사 기록(MG1004/MG1005) · 삭제 없음, 비활성만(UC31-2) · BS0008 스냅샷
const { useState, useMemo, useEffect, useRef } = React;

// 로컬 보강 데이터 — data.js FREELANCERS에 없는 필드(유형·이메일·은행·예금주·원문값·누적완료·메모)
const FL_EXTRA = {
  "FR-101": { type: "FREELANCER",  email: "sy****@gmail.com",  emailRaw: "seoyeon.kim@gmail.com",  bank: "국민은행",   holder: "김*연", phoneRaw: "010-2841-4821", accountRaw: "국민 6845-02-4821",  completedTotal: 127, memo: "야간 작업 선호 · 월말 정산" },
  "FR-102": { type: "INFLUENCER",  email: "dh****@naver.com",  emailRaw: "dohyun.lee@naver.com",   bank: "우리은행",   holder: "이*현", phoneRaw: "010-5372-7702", accountRaw: "우리 1002-337-7702", completedTotal: 214, memo: "체험단 모집 리드타임 3일 필요" },
  "FR-103": { type: "FREELANCER",  email: "jw****@gmail.com",  emailRaw: "jiwoo.park@gmail.com",   bank: "신한은행",   holder: "박*우", phoneRaw: "010-8140-3390", accountRaw: "신한 110-482-3390",  completedTotal: 86,  memo: "상세페이지 전문 · 재의뢰율 높음" },
  "FR-104": { type: "FREELANCER",  email: "mj****@daum.net",   emailRaw: "minjun.choi@daum.net",   bank: "하나은행",   holder: "최*준", phoneRaw: "010-9203-5518", accountRaw: "하나 620-114-5518",  completedTotal: 152, memo: "카피 수정 회신 빠름" },
  "FR-105": { type: "INFLUENCER",  email: "hy****@gmail.com",  emailRaw: "hayoon.jung@gmail.com",  bank: "국민은행",   holder: "정*윤", phoneRaw: "010-4471-9047", accountRaw: "국민 9231-04-9047",  completedTotal: 98,  memo: "뷰티·리빙 시딩 네트워크 보유" },
  "FR-106": { type: "FREELANCER",  email: "jm****@kakao.com",  emailRaw: "jimin.han@kakao.com",    bank: "카카오뱅크", holder: "한*민", phoneRaw: "010-6620-2214", accountRaw: "카카오 3333-08-2214", completedTotal: 41, memo: "장비 업그레이드로 8월 복귀 예정" },
};
const FL_BANKS = ["국민은행", "우리은행", "신한은행", "하나은행", "카카오뱅크"];
const FL_TYPE_LABEL = { FREELANCER: "프리랜서", INFLUENCER: "인플루언서" };

function Freelancers({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, Money, SidePanel, ConfirmDialog, Icon, fmt } = window;

  const [list, setList] = useState(() => FREELANCERS.map((f) => ({ ...f, ...FL_EXTRA[f.id] })));
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE"); // 초깃값: 활성 (모델 항목표)
  const [density, setDensity] = useState("cozy");             // 48px ↔ 40px 밀도 토글 (IDEA-02)
  const [cursor, setCursor] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mode, setMode] = useState("edit");                   // edit | new
  const [form, setForm] = useState(null);
  const [revealed, setRevealed] = useState({});               // { phone, email, account } — 열람 해제 상태
  const [revealAsk, setRevealAsk] = useState(null);           // 'phone' | 'email' | 'account'
  const [deactivateAsk, setDeactivateAsk] = useState(false);

  const filtered = useMemo(() => list.filter((f) => {
    if (statusFilter !== "ALL" && (statusFilter === "ACTIVE") !== f.active) return false;
    if (typeFilter !== "ALL" && f.type !== typeFilter) return false;
    if (keyword && !(f.name.includes(keyword) || f.specialty.includes(keyword))) return false;
    return true;
  }), [list, keyword, typeFilter, statusFilter]);

  const selected = panelOpen && mode === "edit" ? filtered[Math.min(cursor, filtered.length - 1)] : null;

  // 진행 중 결재(단가변경) 홀드 배지 근거
  const rateApprovalOf = (id) => APPROVALS.find((a) => a.type === "RATE_CHANGE" && a.freelancerId === id && a.status === "IN_PROGRESS");
  const assignCountOf = (id) => ASSIGNMENTS.filter((a) => a.freelancerId === id).length;

  const openRow = (idx) => {
    setCursor(idx); setMode("edit"); setRevealed({});
    const f = filtered[idx];
    setForm({ ...f });
    setPanelOpen(true);
  };
  const openNew = () => {
    setMode("new"); setRevealed({ phone: true, email: true, account: true });
    setForm({ id: `FR-${107 + list.length - 6}`, name: "", type: "FREELANCER", specialty: "", rateType: "FIXED", rate: "", phoneRaw: "", emailRaw: "", bank: FL_BANKS[0], accountRaw: "", holder: "", memo: "", active: true, activeTasks: 0, onTimeRate: null, qualityScore: null, completedTotal: 0 });
    setPanelOpen(true);
  };

  // 딥링크: route.payload.freelancerId → 해당 행 상세 패널 자동 오픈 (home ⌘K · audit-log openOrigin)
  useEffect(() => {
    const fid = route?.payload?.freelancerId;
    if (!fid) return;
    const f = list.find((x) => x.id === fid);
    if (!f) return;
    // 필터에 가려 있어도 보이도록 필터를 전체로 리셋 → filtered === list 이므로 cursor가 정렬됨
    setKeyword(""); setTypeFilter("ALL"); setStatusFilter("ALL");
    setCursor(list.findIndex((x) => x.id === fid));
    setMode("edit"); setRevealed({});
    setForm({ ...f });
    setPanelOpen(true);
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  // IDEA-02 엑셀 그리드: ↑↓ 행 이동(패널 열린 채 내용 교체 — IDEA-06), Enter 상세, Ctrl+C TSV 복사
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !window.getSelection().toString()) {
        const tsv = ["이름\t유형\t전문분야\t단가\t연락처\t진행중\t준수율\t상태"]
          .concat(filtered.map((f) => [f.name, FL_TYPE_LABEL[f.type], f.specialty, f.rate, f.phone, f.activeTasks, `${f.onTimeRate}%`, f.active ? "활성" : "비활성"].join("\t")))
          .join("\n");
        navigator.clipboard && navigator.clipboard.writeText(tsv);
        window.toast(`${filtered.length}행을 TSV로 복사했어요 — 엑셀에 그대로 붙습니다 (IDEA-02)`);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, Math.min(filtered.length - 1, cursor + (e.key === "ArrowDown" ? 1 : -1)));
        setCursor(next);
        if (panelOpen && mode === "edit") { setForm({ ...filtered[next] }); setRevealed({}); }
      }
      if (e.key === "Enter" && !panelOpen && filtered.length > 0) openRow(cursor);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, cursor, panelOpen, mode]);

  const rateChanged = form && selected && Number(form.rate) !== Number(selected.rate);

  const save = () => {
    if (!form.name || !form.rate || (mode === "new" && (!form.phoneRaw || !form.accountRaw || !form.holder))) {
      window.toast("필수 항목(이름·단가·연락처·계좌)을 확인해 주세요", { tone: "error" });
      return;
    }
    if (mode === "new") {
      const masked = { phone: window.maskPhone(form.phoneRaw), account: form.accountRaw.replace(/\d(?=\d{4})/g, "*"), email: form.emailRaw ? form.emailRaw.slice(0, 2) + "****" + form.emailRaw.slice(form.emailRaw.indexOf("@")) : "" };
      setList((s) => [...s, { ...form, rate: Number(form.rate), ...masked, monthPayout: 0 }]);
      setPanelOpen(false);
      window.toast(`${form.name} 등록 완료 — 민감정보는 암호화·마스킹 저장됐어요 (MG1004)`, { actionLabel: "작업 배정에서 후보 확인 →", onAction: () => navigate("assign", { freelancerId: form.id }) });
    } else {
      setList((s) => s.map((f) => (f.id === form.id ? { ...f, ...form, rate: Number(form.rate) } : f)));
      setPanelOpen(false);
      window.toast("저장 완료 — 변경 전/후 값이 이력으로 기록됐어요 (MG1004)", { actionLabel: "평가 조회에서 지표 확인 →", onAction: () => navigate("evalReport", { freelancerId: form.id }) });
    }
  };

  const deactivate = () => {
    setList((s) => s.map((f) => (f.id === form.id ? { ...f, active: false } : f)));
    setDeactivateAsk(false); setPanelOpen(false);
    window.toast(`${form.name} 비활성 처리 — 이력은 보존되고 신규 배정 후보에서 제외됩니다 (UC31-2)`, { actionLabel: "작업 배정에서 확인 →", onAction: () => navigate("assign") });
  };

  const reveal = (field) => {
    setRevealed((s) => ({ ...s, [field]: true }));
    setRevealAsk(null);
    window.toast("원문 열람이 감사 로그에 기록되었습니다 (MG1004) — 30초 후 자동 재마스킹", { tone: "warn", actionLabel: "변경 이력 보기 →", onAction: () => navigate("auditLog", { entityId: form.id }) });
    setTimeout(() => setRevealed((s) => ({ ...s, [field]: false })), 30000);
  };

  const py = density === "cozy" ? "py-3" : "py-2";
  const fld = "w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60";
  const lbl = "block text-xs text-slate-400 mb-1";
  const activeCnt = list.filter((f) => f.active).length;

  const statCard = (label, value, sub, onClick) => (
    <button onClick={onClick} disabled={!onClick} className={`rounded-lg bg-slate-950/70 border border-slate-800 p-3 text-left ${onClick ? "hover:border-purple-500/40 cursor-pointer" : "cursor-default"}`}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </button>
  );

  const sensitiveRow = (label, field, maskedVal, rawVal) => (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800/60">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`font-mono text-xs ${revealed[field] ? "text-amber-300" : "text-slate-300"}`}>{revealed[field] ? rawVal : maskedVal}</span>
      {!revealed[field] && mode === "edit" && (
        <button onClick={() => setRevealAsk(field)} className="shrink-0 text-[11px] px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300 flex items-center gap-1">
          <Icon name="eye" className="w-3 h-3" />원문 열람
        </button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        label="RESOURCES · 31" labelColor="purple" title="프리랜서 마스터"
        desc="목록 + 등록/수정 패널 단일 관리 — 민감정보는 마스킹 기본, 삭제 대신 비활성으로 이력을 보존합니다 (MG1004 · UC31-2)"
        actions={
          <button onClick={openNew} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-1.5">
            <Icon name="plus" className="w-4 h-4" />신규 등록
          </button>
        }
      />

      {/* 필터 바 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Icon name="search" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setCursor(0); }} placeholder="이름 · 전문 분야 검색" className="w-56 rounded-lg bg-slate-950 border border-slate-700 pl-8 pr-3 py-2 text-sm outline-none focus:border-purple-500/60" />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCursor(0); }} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none">
            <option value="ALL">유형 전체</option><option value="FREELANCER">프리랜서</option><option value="INFLUENCER">인플루언서</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCursor(0); }} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none">
            <option value="ACTIVE">활성</option><option value="INACTIVE">비활성</option><option value="ALL">전체</option>
          </select>
          <button onClick={() => window.toast(`검색 결과 ${filtered.length}명`)} className="px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm hover:bg-slate-700">조회</button>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span>검색 결과 <b className="text-slate-200 tabular-nums">{filtered.length}</b>명 · 활성 {activeCnt}명</span>
            <button onClick={() => setDensity((d) => (d === "cozy" ? "compact" : "cozy"))} className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 hover:text-slate-200 flex items-center gap-1" title="밀도 토글 (IDEA-02)">
              <Icon name="columns" className="w-3 h-3" />{density === "cozy" ? "48px" : "40px"}
            </button>
          </div>
        </div>
        <div className="text-[11px] text-slate-600 mt-2.5 flex items-center gap-1.5">
          <Icon name="info" className="w-3 h-3" />엑셀 그리드 모드: ↑↓ 행 이동 · Enter 상세 · Ctrl+C TSV 복사 — 연락처·계좌는 목록에서 마스킹 고정 (MG1005)
        </div>
      </Card>

      {/* 목록 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-5 py-2.5 font-medium">이름</th>
                <th className="px-3 py-2.5 font-medium">유형</th>
                <th className="px-3 py-2.5 font-medium">전문 분야</th>
                <th className="px-3 py-2.5 font-medium text-right">단가(원)</th>
                <th className="px-3 py-2.5 font-medium">연락처</th>
                <th className="px-3 py-2.5 font-medium text-right">진행중</th>
                <th className="px-3 py-2.5 font-medium text-right">준수율</th>
                <th className="px-5 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const holding = rateApprovalOf(f.id);
                return (
                  <tr key={f.id} onClick={() => openRow(i)}
                    className={`border-b border-slate-800/60 cursor-pointer transition ${i === cursor && panelOpen ? "bg-purple-500/10" : i === cursor ? "bg-slate-800/40" : "hover:bg-slate-800/30"}`}>
                    <td className={`px-5 ${py}`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{f.name[0]}</div>
                        <div>
                          <div className="font-medium">{f.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{f.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-3 ${py} text-xs text-slate-300`}>{FL_TYPE_LABEL[f.type]}</td>
                    <td className={`px-3 ${py} text-xs text-slate-400`}>{f.specialty}</td>
                    <td className={`px-3 ${py} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Money value={f.rate} />
                        {holding && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono whitespace-nowrap" title={`단가변경 결재 진행 중 — ${holding.id}`}>결재 중</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 ${py} font-mono text-xs text-slate-400`}>{f.phone}</td>
                    <td className={`px-3 ${py} text-right tabular-nums text-xs`}>{f.activeTasks}건</td>
                    <td className={`px-3 ${py} text-right tabular-nums text-xs ${f.onTimeRate >= 95 ? "text-emerald-300" : f.onTimeRate >= 90 ? "text-slate-200" : "text-amber-300"}`}>{f.onTimeRate}%</td>
                    <td className={`px-5 ${py}`}><EnumPill status={f.active ? "ACTIVE" : "INACTIVE"} /></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">조건에 맞는 프리랜서가 없어요 — 필터를 조정해 보세요</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 상세/등록 패널 (IDEA-06) */}
      <SidePanel
        open={panelOpen} onClose={() => setPanelOpen(false)}
        title={mode === "new" ? "신규 프리랜서 등록" : form ? `${form.name} · ${FL_TYPE_LABEL[form.type]}` : ""}
        subtitle={mode === "new" ? "민감정보는 저장 즉시 암호화·마스킹됩니다 (MG1004)" : form ? `${form.id} · ↑↓로 행 이동 · Esc 닫기` : ""}
        footer={form && (
          <div className="flex items-center justify-end gap-2">
            {mode === "edit" && form.active && (
              <button onClick={() => setDeactivateAsk(true)} className="px-3.5 py-2 rounded-lg text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20">비활성 처리</button>
            )}
            <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">저장</button>
          </div>
        )}
      >
        {form && (
          <div className="space-y-5">
            {mode === "edit" && (
              <div className="grid grid-cols-2 gap-2">
                {statCard("기한 준수율 (자동)", `${form.onTimeRate}%`, "기한 내 완료 / 전체 완료")}
                {statCard("품질 점수 (UC32 집계)", form.qualityScore != null ? `${form.qualityScore} / 5` : "미입력", "평가 입력 화면에서 집계 (MG1006)")}
                {statCard("진행 중 작업", `${form.activeTasks}건`, "클릭 → 칸반 필터 직행", () => navigate("kanban", { freelancerId: form.id }))}
                {statCard("누적 완료", `${fmt(form.completedTotal)}건`, null)}
              </div>
            )}
            {mode === "edit" && !form.active && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 flex items-start gap-2">
                <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" />비활성 상태 — 신규 배정 후보에서 제외되며 기존 배정·지급 이력은 유지됩니다 (UC31-2)
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>* 이름</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fld} /></div>
              <div><label className={lbl}>* 유형</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={fld}>
                  <option value="FREELANCER">프리랜서</option><option value="INFLUENCER">인플루언서</option>
                </select>
              </div>
            </div>
            <div><label className={lbl}>전문 분야</label><input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className={fld} /></div>

            <div>
              <label className={lbl}>* 기본 단가 (원)</label>
              <div className="flex items-center gap-2">
                <input value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/[^\d]/g, "") })} className={`${fld} font-mono tabular-nums text-right`} />
                <select value={form.rateType} onChange={(e) => setForm({ ...form, rateType: e.target.value })} className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-xs outline-none shrink-0">
                  <option value="FIXED">건당 고정</option><option value="VARIABLE">변동 단가</option>
                </select>
              </div>
              {rateChanged && (
                <div className="mt-2 rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <Icon name="info" className="w-3.5 h-3.5 mt-0.5 text-purple-300 shrink-0" />
                    <div>
                      단가를 변경해도 이미 배정된 <b className="text-purple-200">{assignCountOf(form.id)}건</b>은 배정 시점의 <b className="text-purple-200">스냅샷 단가 ₩{fmt(selected.rate)}</b>가 유지됩니다.
                      새 단가는 이후 신규 배정부터 적용돼요 <span className="font-mono text-[10px] text-slate-500">(BS0008)</span>
                    </div>
                  </div>
                  <div className="mt-2 pl-5 text-[11px] text-slate-500">
                    진행 중 배정 건의 단가 조정은 단가변경 결재로만 —{" "}
                    <button onClick={() => navigate("draft", { freelancerId: form.id, type: "RATE_CHANGE" })} className="text-purple-300 hover:text-purple-200 font-medium">단가변경 기안 작성 →</button>
                  </div>
                </div>
              )}
              {rateApprovalOf(form.id) && (
                <div className="mt-2 text-[11px] text-amber-300 flex items-center gap-1.5">
                  <Icon name="clock" className="w-3 h-3" />단가변경 결재 진행 중 — <span className="font-mono">{rateApprovalOf(form.id).id}</span>
                  <button onClick={() => navigate("approvalDetail", { approvalId: rateApprovalOf(form.id).id })} className="text-amber-200 underline underline-offset-2">진행 현황 →</button>
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-1.5 flex items-center gap-1.5">
                <Icon name="shield" className="w-3 h-3" />민감정보 — 마스킹 표시 · 열람 권한자만 원문 확인 (MG1005)
              </div>
              {mode === "new" ? (
                <div className="space-y-3">
                  <div><label className={lbl}>* 휴대전화</label><input value={form.phoneRaw} onChange={(e) => setForm({ ...form, phoneRaw: e.target.value })} placeholder="010-0000-0000" className={`${fld} font-mono`} /></div>
                  <div><label className={lbl}>이메일</label><input value={form.emailRaw} onChange={(e) => setForm({ ...form, emailRaw: e.target.value })} placeholder="name@example.com" className={`${fld} font-mono`} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className={lbl}>* 은행</label>
                      <select value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} className={fld}>{FL_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}</select>
                    </div>
                    <div><label className={lbl}>* 계좌번호</label><input value={form.accountRaw} onChange={(e) => setForm({ ...form, accountRaw: e.target.value })} className={`${fld} font-mono`} /></div>
                    <div><label className={lbl}>* 예금주</label><input value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} className={fld} /></div>
                  </div>
                  <p className="text-[11px] text-slate-500">저장 후 마스킹 표시로 전환되고 감사 로그에도 마스킹값만 기록됩니다 (MG1004)</p>
                </div>
              ) : (
                <div>
                  {sensitiveRow("* 휴대전화", "phone", form.phone, form.phoneRaw)}
                  {sensitiveRow("이메일", "email", form.email, form.emailRaw)}
                  {sensitiveRow(`* 계좌 (${form.bank} · 예금주 ${form.holder})`, "account", form.account, form.accountRaw)}
                </div>
              )}
            </div>

            <div><label className={lbl}>메모 <span className="text-slate-600">(저위험 — 인라인 편집 허용)</span></label>
              <textarea value={form.memo || ""} onChange={(e) => setForm({ ...form, memo: e.target.value.slice(0, 200) })} rows={2} className={`${fld} resize-none`} />
            </div>
          </div>
        )}
      </SidePanel>

      {/* 원문 열람 확인 — 열람 자체가 감사 기록 (MG1004) */}
      <ConfirmDialog
        open={!!revealAsk} risk="mid" title="민감정보 원문 열람"
        message="원문 열람 행위 자체가 감사 로그에 기록됩니다. 계속할까요?"
        summary={
          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex justify-between"><span>대상</span><span className="text-slate-200">{form ? `${form.name} · ${revealAsk === "phone" ? "휴대전화" : revealAsk === "email" ? "이메일" : "계좌번호"}` : ""}</span></div>
            <div className="flex justify-between"><span>기록 내용</span><span className="font-mono text-[11px]">열람자 · 시각 · 대상 필드 (MG1004)</span></div>
            <div className="flex justify-between"><span>자동 재마스킹</span><span>30초 후</span></div>
          </div>
        }
        confirmLabel="열람하고 기록 남기기" onConfirm={() => reveal(revealAsk)} onClose={() => setRevealAsk(null)}
      />

      {/* 비활성 처리 — 중위험, 영향 요약 재표시 */}
      <ConfirmDialog
        open={deactivateAsk} risk="mid" danger title="비활성 처리"
        message="삭제가 아니라 비활성입니다 — 거래 이력은 전부 보존됩니다 (UC31-2)"
        summary={form && (
          <div className="text-xs space-y-1.5">
            {form.activeTasks > 0 && (
              <div className="flex items-center gap-1.5 text-amber-300"><Icon name="alert" className="w-3.5 h-3.5" />진행 중 작업 {form.activeTasks}건이 남아 있어요 — 재배정 또는 완료 후 처리를 권장합니다</div>
            )}
            <div className="text-slate-400">신규 배정 후보에서 즉시 제외 · 기존 배정({assignCountOf(form ? form.id : "")}건)과 지급 이력은 유지</div>
          </div>
        )}
        confirmLabel="비활성 처리" onConfirm={deactivate} onClose={() => setDeactivateAsk(false)}
      />
    </div>
  );
}

window.Freelancers = Freelancers;
