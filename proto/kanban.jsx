// kanban.jsx — 03 작업 칸반
// 4열(대기/진행중/검수/완료) × WORK_TASKS 카드 · ◀▶ 상태 이동(로컬) · 카드 클릭 → 배정 패널
// 전이 규칙 시연: DONE 카드 역행 시도 → 스냅백 + "완료 작업 변경은 결재를 통해서만" 토스트 (MG1001)
// 데이터: window.WORK_TASKS / FREELANCERS / ORDERS (data.js 무변경)
const { useState: useState_k, useEffect: useEffect_k, useMemo: useMemo_k } = React;

// 칸반 열 정의 — 저장은 대문자 ENUM, 라벨만 한글
const KANBAN_COLS = [
  { key: "TODO",        label: "대기",   accent: "slate",   dot: "bg-slate-400",   head: "text-slate-300" },
  { key: "IN_PROGRESS", label: "진행중", accent: "amber",   dot: "bg-amber-400",   head: "text-amber-300" },
  { key: "REVIEW",      label: "검수",   accent: "cyan",    dot: "bg-cyan-400",    head: "text-cyan-300" },
  { key: "DONE",        label: "완료",   accent: "emerald", dot: "bg-emerald-400", head: "text-emerald-300" },
];

function Kanban({ route, navigate, tweaks }) {
  const TODAY = new Date("2026-07-10T00:00:00");
  const COL_KEYS = KANBAN_COLS.map(c => c.key);

  // 작업 상태·배정은 로컬 상태로 복제 — 카드 이동/재배정이 화면에 즉시 반영 (data.js 무변경)
  const [tasks, setTasks] = useState_k(() => window.WORK_TASKS.map(t => ({ ...t })));
  const [panelId, setPanelId] = useState_k(null);    // 배정 패널 대상 작업 id
  const [pick, setPick] = useState_k(null);          // 배정 패널에서 선택한 후보 프리랜서 id
  const [savedNote, setSavedNote] = useState_k(false);
  const [toast, setToast] = useState_k(null);        // { msg }
  const [shakeId, setShakeId] = useState_k(null);    // 스냅백 애니메이션 대상 카드 id

  const freelancerOf = (id) => window.FREELANCERS.find(f => f.id === id) || null;
  const orderOf = (id) => window.ORDERS.find(o => o.id === id) || null;

  // D-day (오늘 2026-07-10 기준)
  const dday = (dateStr) => Math.round((new Date(dateStr + "T00:00:00") - TODAY) / 86400000);
  const ddayMeta = (t) => {
    if (t.status === "DONE") return { text: "완료", cls: "bg-emerald-500/15 text-emerald-300" };
    const d = dday(t.dueDate);
    if (d < 0) return { text: `지연 D+${-d}`, cls: "bg-rose-500/20 text-rose-200", urgent: true };
    if (d <= 2) return { text: d === 0 ? "D-DAY" : `D-${d}`, cls: "bg-rose-500/15 text-rose-300", urgent: true };
    if (d <= 5) return { text: `D-${d}`, cls: "bg-amber-500/15 text-amber-300" };
    return { text: `D-${d}`, cls: "bg-white/5 text-slate-400" };
  };
  const isUrgent = (t) => t.status !== "DONE" && dday(t.dueDate) <= 2;

  const imminentCount = tasks.filter(isUrgent).length;

  // 토스트 자동 소멸
  useEffect_k(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  // Esc → 배정 패널 닫기
  useEffect_k(() => {
    const onKey = (e) => { if (e.key === "Escape") setPanelId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 배정 패널 열릴 때 후보 선택 초기화
  useEffect_k(() => {
    const t = tasks.find(x => x.id === panelId);
    if (t) { setPick(t.assigneeId); setSavedNote(false); }
  }, [panelId]);

  const showToast = (msg) => setToast({ msg });

  // 상태 이동 — DONE 역행은 결재 필요(차단) → 스냅백 + 토스트
  const move = (task, dir) => {
    const idx = COL_KEYS.indexOf(task.status);
    if (task.status === "DONE" && dir < 0) {
      setShakeId(task.id);
      showToast("완료 작업 변경은 결재를 통해서만 가능합니다");
      setTimeout(() => setShakeId(null), 430);
      return;
    }
    const next = idx + dir;
    if (next < 0 || next >= COL_KEYS.length) return;
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: COL_KEYS[next] } : t));
  };

  const panelTask = tasks.find(t => t.id === panelId) || null;
  const applyReassign = () => {
    setTasks(ts => ts.map(t => t.id === panelId ? { ...t, assigneeId: pick } : t));
    setSavedNote(true);
  };

  return (
    <div className="space-y-5">
      {/* 스냅백 키프레임 (Tailwind CDN 미포함) */}
      <style>{`@keyframes kbSnap{0%,100%{transform:translateX(0)}20%{transform:translateX(7px)}40%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-3px)}}`}</style>

      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="amber">KANBAN · 작업 칸반</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">작업 칸반</h1>
          <p className="text-sm text-slate-300 mt-1">주문에서 분해된 작업을 대기 · 진행중 · 검수 · 완료로 추적 — 카드 클릭 시 담당자 배정을 조정합니다</p>
        </div>
        <div className="flex items-center gap-2">
          {KANBAN_COLS.map(c => {
            const n = tasks.filter(t => t.status === c.key).length;
            return (
              <div key={c.key} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
                <span className="text-xs text-slate-400">{c.label}</span>
                <span className="text-xs font-bold tabular-nums text-slate-200">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 납기 임박 경고 배너 */}
      {imminentCount > 0 && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5">
          <window.Icon name="alert" className="w-4 h-4 text-rose-300 flex-shrink-0" />
          <span className="text-sm text-rose-200">납기 임박(D-2 이내) <b className="mx-0.5">{imminentCount}건</b> — 우선 배정·검수를 권장합니다</span>
          <span className="ml-auto text-[11px] text-rose-300/70">오늘 2026-07-10 기준</span>
        </div>
      )}

      {/* 4열 보드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {KANBAN_COLS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="rounded-xl bg-slate-900/60 border border-slate-700/60 flex flex-col">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`}></span>
                  <span className={`text-sm font-semibold ${col.head}`}>{col.label}</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-slate-500">{colTasks.length}</span>
              </div>
              <div className="p-3 space-y-2.5 flex-1 min-h-[120px]">
                {colTasks.map(t => {
                  const f = freelancerOf(t.assigneeId);
                  const o = orderOf(t.orderId);
                  const dm = ddayMeta(t);
                  const idx = COL_KEYS.indexOf(t.status);
                  const leftDisabled = idx === 0;
                  const rightDisabled = idx === COL_KEYS.length - 1;
                  return (
                    <div key={t.id} onClick={() => setPanelId(t.id)}
                      style={shakeId === t.id ? { animation: "kbSnap 0.43s ease" } : undefined}
                      className={`rounded-lg bg-slate-900 border p-3 cursor-pointer transition hover:border-purple-500/40 ${shakeId === t.id ? 'border-rose-500/60' : isUrgent(t) ? 'border-rose-500/30' : 'border-slate-700/60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium leading-tight flex-1 min-w-0">{t.title}</div>
                        {t.priority === "HIGH" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 flex-shrink-0 font-medium">HIGH</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="font-mono">{t.orderId}</span>
                        {o && <span className="truncate">· {o.clientName}</span>}
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{f ? f.name[0] : "?"}</div>
                          <span className="text-[11px] text-slate-400">{f ? f.name : "미배정"}</span>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tabular-nums ${dm.cls}`}>{dm.text}</span>
                      </div>
                      {/* 상태 이동 */}
                      <div className="mt-2.5 pt-2.5 border-t border-white/5 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                        <button onClick={() => move(t, -1)} disabled={leftDisabled}
                          className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed" aria-label="이전 단계">
                          <window.Icon name="chevronLeft" className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] text-slate-500">{col.label}</span>
                        <button onClick={() => move(t, 1)} disabled={rightDisabled}
                          className="w-7 h-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed" aria-label="다음 단계">
                          <window.Icon name="chevronRight" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-[11px] text-slate-600">작업 없음</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <window.Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
        완료(DONE) 작업의 역행은 전자결재 승인을 거쳐야만 가능합니다 — 상태 전이표 밖의 이동은 차단됩니다 (BS0005 · MG1001)
      </div>

      {/* ── 배정 패널 (사이드) ── */}
      {panelTask && (() => {
        const current = freelancerOf(panelTask.assigneeId);
        const o = orderOf(panelTask.orderId);
        const dm = ddayMeta(panelTask);
        const changed = pick !== panelTask.assigneeId;
        return (
          <div className="fixed inset-0 z-30 flex">
            <div onClick={() => setPanelId(null)} className="flex-1 bg-slate-950/70"></div>
            <div className="w-full max-w-lg bg-slate-950 border-l border-slate-700/60 shadow-2xl shadow-purple-500/10 overflow-y-auto">
              <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-950 z-10">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">{panelTask.id}</div>
                  <h3 className="font-bold text-lg mt-0.5">작업 배정</h3>
                </div>
                <button onClick={() => setPanelId(null)} className="p-1.5 rounded-md hover:bg-white/10"><window.Icon name="x" className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <window.EnumPill status={panelTask.status} />
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium tabular-nums ${dm.cls}`}>{dm.text}</span>
                    {panelTask.priority === "HIGH" && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">HIGH</span>}
                  </div>
                  <div className="text-sm font-semibold">{panelTask.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5"><span className="font-mono">{panelTask.orderId}</span>{o && ` · ${o.clientName} · ${o.item}`}</div>
                </div>

                {/* 현재 담당 */}
                <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">현재 담당</div>
                  {current ? (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-sm font-bold">{current.name[0]}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{current.name} <span className="text-slate-500 text-xs">· {current.specialty}</span></div>
                        <div className="text-[11px] text-slate-500">단가 ₩{window.fmt(current.rate)}{current.rateType === "FIXED" ? " · 건당 고정" : " · 변동"} · 현재 부하 {current.activeTasks}건 · 준수율 {current.onTimeRate}%</div>
                      </div>
                    </div>
                  ) : <div className="text-xs text-slate-500">미배정</div>}
                </div>

                {/* 후보 비교 테이블 */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">후보 프리랜서 비교 — 단가 · 현재 부하 · 납기 준수율</div>
                  <div className="rounded-lg border border-white/10 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-white/[0.03] border-b border-white/10">
                          <th className="px-3 py-2 font-medium">프리랜서</th>
                          <th className="px-2 py-2 font-medium text-right">단가</th>
                          <th className="px-2 py-2 font-medium text-right">부하</th>
                          <th className="px-3 py-2 font-medium text-right">준수율</th>
                        </tr>
                      </thead>
                      <tbody>
                        {window.FREELANCERS.map(fr => {
                          const sel = pick === fr.id;
                          const isCur = panelTask.assigneeId === fr.id;
                          return (
                            <tr key={fr.id} onClick={() => setPick(fr.id)}
                              className={`border-b border-white/5 last:border-0 cursor-pointer transition ${sel ? 'bg-purple-500/15' : 'hover:bg-white/[0.03]'}`}>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'border-purple-400' : 'border-white/20'}`}>
                                    {sel && <span className="w-2 h-2 rounded-full bg-purple-400"></span>}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-200 truncate">{fr.name}{isCur && <span className="ml-1 text-[9px] text-slate-500">현재</span>}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{fr.specialty}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums text-slate-300">₩{window.fmt(fr.rate)}</td>
                              <td className="px-2 py-2.5 text-right tabular-nums">
                                <span className={fr.activeTasks >= 5 ? "text-rose-300" : fr.activeTasks >= 4 ? "text-amber-300" : "text-slate-300"}>{fr.activeTasks}건</span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                <span className={fr.onTimeRate >= 95 ? "text-emerald-300" : fr.onTimeRate >= 90 ? "text-slate-300" : "text-amber-300"}>{fr.onTimeRate}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-1.5 text-[10px] text-slate-500">부하 5건 이상은 rose · 준수율 95% 이상은 emerald로 강조됩니다</div>
                </div>

                {/* 배정 변경 */}
                <div className="pt-2 border-t border-white/10">
                  <button onClick={applyReassign} disabled={!changed}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed">
                    <window.Icon name="user2" className="w-4 h-4" />배정 변경
                  </button>
                  {savedNote && (
                    <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
                      <window.Icon name="check" className="w-3.5 h-3.5" />
                      {freelancerOf(pick)?.name}(으)로 배정 변경 · 변경 이력 저장됨 — 단가는 배정 시점 스냅샷으로 고정됩니다 (BS0008)
                    </div>
                  )}
                  {!savedNote && (
                    <div className="mt-2 text-[10px] text-slate-500 text-center">후보를 선택하면 배정 변경이 활성화됩니다 · 배정 시 단가가 스냅샷으로 고정됩니다</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-rose-950 border border-rose-700 shadow-2xl shadow-rose-500/20 flex items-center gap-2.5">
          <window.Icon name="alert" className="w-4 h-4 text-rose-300 flex-shrink-0" />
          <span className="text-sm text-rose-100">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

window.Kanban = Kanban;
