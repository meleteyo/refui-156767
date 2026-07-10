// eval-input.jsx — 32 평가 입력 (route: evalInput)
// 모델: 5_프로토타입모델_평가입력.md · MG1006(작업당 1회, 5점 척도) · IDEA-16(완료→평가 릴레이)
// 기한 준수 = 시스템 자동 산출(조회 전용 배지) / 수동 입력은 품질 점수 + 코멘트만
const { useState, useMemo, useEffect } = React;

// 로컬 보강 — TASKS에 completedAt이 없어 완료일 매핑, 큐 시연용 데모 완료 작업 2건 추가 (DEMO 배지)
const EV_COMPLETED_AT = { "TSK-001": "2026-07-08", "TSK-008": "2026-07-09", "TSK-014": "2026-07-09" };
const EV_DEMO_TASKS = [
  { id: "TSK-D91", workGroupId: "WG-02", orderId: "ORD-2607-002", assigneeId: "FR-102", title: "체험단 1~7 리뷰 검수 정리", status: "DONE", dueDate: "2026-07-06", completedAt: "2026-07-08", demo: true },
  { id: "TSK-D92", workGroupId: "WG-03", orderId: "ORD-2607-006", assigneeId: "FR-104", title: "광고 소재 A안 카피 수정 반영", status: "DONE", dueDate: "2026-07-09", completedAt: "2026-07-09", demo: true },
];
const EV_TYPE_LABEL = { "FR-101": "프리랜서", "FR-102": "인플루언서", "FR-103": "프리랜서", "FR-104": "프리랜서", "FR-105": "인플루언서", "FR-106": "프리랜서" };
const EV_SCORE_HINT = { 1: "재의뢰 불가", 2: "미흡", 3: "보통", 4: "우수", 5: "매우 우수" };

function EvalInput({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, ConfirmDialog, Icon } = window;

  const [evals, setEvals] = useState(EVALUATIONS);
  const [frFilter, setFrFilter] = useState(route?.payload?.freelancerId || "ALL"); // 딥링크: 미평가 큐를 해당 프리랜서로 필터
  const [periodFilter, setPeriodFilter] = useState("30");
  const [selectedId, setSelectedId] = useState(route && route.payload ? route.payload.taskId || null : null);
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doneTasks = useMemo(() => TASKS.filter((t) => t.status === "DONE")
    .map((t) => ({ ...t, completedAt: EV_COMPLETED_AT[t.id] || t.dueDate }))
    .concat(EV_DEMO_TASKS), []);

  const evaluatedIds = useMemo(() => new Set(evals.map((e) => e.taskId).filter(Boolean)), [evals]);

  // 큐: 완료 && 미평가, 완료 오래된 순 (MG1006 — 기평가 작업은 큐에서 제외)
  const queue = useMemo(() => doneTasks
    .filter((t) => !evaluatedIds.has(t.id))
    .filter((t) => frFilter === "ALL" || t.assigneeId === frFilter)
    .filter((t) => {
      if (periodFilter === "ALL") return true;
      const days = Math.round((new Date(TODAY) - new Date(t.completedAt)) / 86400000);
      return days <= Number(periodFilter);
    })
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt)), [doneTasks, evaluatedIds, frFilter, periodFilter]);

  const current = queue.find((t) => t.id === selectedId) || queue[0] || null;

  useEffect(() => { if (current && current.id !== selectedId) setSelectedId(current.id); }, [current, selectedId]);

  // 키보드: 1~5 점수 즉시 선택 (입력 필드 밖에서)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (["1", "2", "3", "4", "5"].includes(e.key) && current) setScore(Number(e.key));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  const frOf = (id) => FREELANCERS.find((f) => f.id === id);
  const wgOf = (id) => WORK_GROUPS.find((w) => w.id === id);
  const delayOf = (t) => Math.round((new Date(t.completedAt) - new Date(t.dueDate)) / 86400000);

  const DeadlineBadge = ({ task }) => {
    const d = delayOf(task);
    return d <= 0 ? (
      <span className="inline-flex items-center gap-1 rounded-md border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-2 py-0.5 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>준수
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md border bg-rose-500/15 text-rose-300 border-rose-500/30 px-2 py-0.5 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>지연 D+{d}
      </span>
    );
  };

  const loadTask = (id) => { setSelectedId(id); setScore(null); setComment(""); };
  const nextOf = (excludeId) => queue.find((t) => t.id !== excludeId) || null;

  const save = () => {
    if (!current) return;
    if (evaluatedIds.has(current.id)) { // MG1006 중복 입력 차단
      window.toast("이미 평가된 작업이에요 — 작업당 1회만 입력할 수 있습니다 (MG1006)", { tone: "error" });
      setConfirmOpen(false);
      return;
    }
    const fr = frOf(current.assigneeId);
    setEvals((s) => [...s, {
      id: `EV-${String(s.length + 1).padStart(3, "0")}`, freelancerId: current.assigneeId, taskId: current.id,
      orderId: current.orderId, evaluatorId: CURRENT_USER_ID, period: "2026-07",
      scores: { quality: score, deadline: delayOf(current) <= 0 ? 5 : 3, communication: null }, comment,
      createdAt: `${TODAY} 11:40`,
    }]);
    setConfirmOpen(false);
    const next = nextOf(current.id);
    const remain = queue.length - 1;
    if (next) { // IDEA-16 릴레이: 저장 후 다음 미평가 건
      loadTask(next.id);
      window.toast(`${fr ? fr.name : ""} 평가 저장 완료 — 남은 미평가 ${remain}건`, { actionLabel: "다음 미평가 작업 →", onAction: () => loadTask(next.id) });
    } else {
      window.toast("모든 완료 작업 평가를 마쳤어요 — 지표가 즉시 집계됩니다", { actionLabel: "평가 조회로 →", onAction: () => navigate("evalReport", { period: "2026-07" }) });
    }
  };

  const recentDone = evals.filter((e) => e.taskId).slice(-3).reverse();

  return (
    <div>
      <PageHeader
        label="RESOURCES · 32" labelColor="purple" title="평가 입력"
        desc="완료 작업의 품질 점수(5점 척도 + 코멘트)를 입력합니다 — 기한 준수는 시스템 자동 산출로 구분 표시 (MG1006)"
        actions={
          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${queue.length > 0 ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"}`}>
            <Icon name="clipboard" className="w-4 h-4" />미평가 완료 작업 <b className="tabular-nums">{queue.length}</b>건
          </span>
        }
      />

      {/* 필터 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-xs text-slate-500">프리랜서</label>
          <select value={frFilter} onChange={(e) => setFrFilter(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none">
            <option value="ALL">전체</option>
            {FREELANCERS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <label className="text-xs text-slate-500 ml-2">완료 기간</label>
          <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none">
            <option value="7">최근 7일</option><option value="30">최근 30일</option><option value="ALL">전체</option>
          </select>
          <span className="ml-auto text-[11px] text-slate-600">칸반 완료 드롭 시 릴레이 토스트로 이 화면에 직행합니다 (IDEA-16)</span>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        {/* 미평가 완료 작업 큐 — 완료 오래된 순 */}
        <Card className="col-span-12 lg:col-span-5 overflow-hidden self-start">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold">미평가 완료 작업 큐</h3>
            <span className="text-[11px] text-slate-500">완료 오래된 순 · 클릭 시 평가 폼 로드</span>
          </div>
          {queue.length === 0 ? (
            <div className="p-5">
              <window.EmptyState icon="check" title="미평가 완료 작업이 없어요"
                description="작업이 칸반에서 완료(DONE)되면 이 큐에 자동으로 쌓입니다"
                actionLabel="평가 조회로 →" onAction={() => navigate("evalReport")}
                secondaryLabel="칸반 보드 열기" onSecondary={() => navigate("kanban")} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2 font-medium">작업명</th>
                  <th className="px-3 py-2 font-medium">프리랜서</th>
                  <th className="px-3 py-2 font-medium">완료일</th>
                  <th className="px-5 py-2 font-medium">기한 준수(자동)</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((t) => {
                  const fr = frOf(t.assigneeId);
                  const sel = current && current.id === t.id;
                  return (
                    <tr key={t.id} onClick={() => loadTask(t.id)} className={`border-b border-slate-800/60 cursor-pointer transition ${sel ? "bg-purple-500/10" : "hover:bg-slate-800/30"}`}>
                      <td className="px-5 py-3">
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          {sel && <span className="w-1 h-4 rounded bg-gradient-to-b from-purple-500 to-pink-500 shrink-0"></span>}
                          {t.title}
                          {t.demo && <EnumPill status="DEMO" />}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{t.id} · {t.orderId}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">{fr ? fr.name : "-"}</td>
                      <td className="px-3 py-3 text-xs font-mono text-slate-400">{t.completedAt}</td>
                      <td className="px-5 py-3"><DeadlineBadge task={t} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* 선택 작업 평가 폼 */}
        <Card className="col-span-12 lg:col-span-7 self-start">
          {!current ? (
            <div className="p-8 text-center text-sm text-slate-500">평가할 작업이 없습니다</div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-purple-400">선택 작업 평가</div>
                  <h3 className="font-bold mt-1">{current.title}</h3>
                </div>
                <DeadlineBadge task={current} />
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm rounded-lg bg-slate-950/70 border border-slate-800 p-4">
                <div className="flex justify-between"><span className="text-slate-500 text-xs">프리랜서</span><span className="text-xs">{frOf(current.assigneeId) ? `${frOf(current.assigneeId).name} (${EV_TYPE_LABEL[current.assigneeId] || "프리랜서"})` : "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 text-xs">작업 그룹</span><span className="text-xs">{wgOf(current.workGroupId) ? wgOf(current.workGroupId).name : "-"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 text-xs">마감일</span><span className="text-xs font-mono">{current.dueDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 text-xs">완료일</span><span className="text-xs font-mono">{current.completedAt}</span></div>
                <div className="col-span-2 flex items-center justify-between border-t border-slate-800 pt-2 mt-1">
                  <span className="text-slate-500 text-xs">기한 준수</span>
                  <span className="flex items-center gap-2"><DeadlineBadge task={current} />
                    <span className="text-[10px] text-slate-600">시스템 자동 산출 항목입니다 (입력 불가)</span>
                  </span>
                </div>
              </div>

              {/* 품질 점수 — 수동 입력 (5점 라디오) */}
              <div>
                <label className="block text-xs text-slate-400 mb-2">* 품질 점수 <span className="text-slate-600">— 작업당 1회 (MG1006) · 키보드 1~5</span></label>
                <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="품질 점수">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} role="radio" aria-checked={score === n} onClick={() => setScore(n)}
                      className={`rounded-lg border py-3 text-center transition ${score === n ? "bg-gradient-to-b from-purple-600/30 to-pink-600/20 border-purple-500/60 text-white" : "bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                      <div className="flex items-center justify-center gap-1">
                        <Icon name="star" className={`w-3.5 h-3.5 ${score === n ? "text-amber-300" : "text-slate-600"}`} />
                        <span className="text-lg font-bold tabular-nums">{n}</span>
                      </div>
                      <div className="text-[10px] mt-0.5 text-slate-500">{EV_SCORE_HINT[n]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">코멘트 <span className="text-slate-600">(선택 · 최대 200자)</span></label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 200))} rows={3}
                  placeholder="예: 톤앤매너 반영 우수, 이미지 보정 재요청 1회"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60 resize-none" />
                <div className="text-[10px] text-slate-600 text-right mt-1 tabular-nums">{comment.length} / 200</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => { const n = nextOf(current.id); if (n) loadTask(n.id); else window.toast("다음 미평가 작업이 없어요", { tone: "warn" }); }}
                  className="px-3.5 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">다음 미평가 작업</button>
                <button onClick={() => (score == null ? window.toast("품질 점수를 선택해 주세요 (1~5)", { tone: "error" }) : setConfirmOpen(true))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${score == null ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"}`}>
                  평가 저장
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 최근 저장된 평가 — 맥락 확인용 */}
      {recentDone.length > 0 && (
        <Card className="mt-4 p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">최근 저장된 평가</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {recentDone.map((e) => {
              const fr = frOf(e.freelancerId);
              const t = doneTasks.find((x) => x.id === e.taskId);
              return (
                <div key={e.id} className="rounded-lg bg-slate-950/70 border border-slate-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{fr ? fr.name : e.freelancerId}</span>
                    <span className="text-xs font-bold text-amber-300 tabular-nums flex items-center gap-1"><Icon name="star" className="w-3 h-3" />{e.scores.quality}점</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{t ? t.title : e.taskId}</div>
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5">{e.createdAt}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 저장 확인 — 저위험(Enter 확정, §4.6) */}
      <ConfirmDialog
        open={confirmOpen} risk="low" title="평가 저장"
        message={current && score != null ? `${frOf(current.assigneeId) ? frOf(current.assigneeId).name : ""} · "${current.title}" — 품질 ${score}점으로 저장합니다. 작업당 1회만 입력할 수 있어요 (MG1006)` : ""}
        confirmLabel="저장" onConfirm={save} onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

window.EvalInput = EvalInput;
