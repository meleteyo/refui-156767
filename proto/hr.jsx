// hr.jsx — 07 인사·조직 (리소스 관리)
// 프리랜서/인플루언서 마스터 · 단가 이력(RATE_CHANGE 결재 경유) · 평가 지표(자동 준수율 + 팀장 수동 품질)
// 프리랜서는 관리 대상(계정 없음), 직원(EMPLOYEES)은 로그인 사용자 — 구분 유지
const { useState: useState_hr, useEffect: useEffect_hr } = React;

// 품질 점수 — 팀장 수동 평가(1~5점, Q17 척도 A 가정). 미확정 척도이므로 미입력 상태 병존
const QUALITY_SCORES = {
  "FR-101": 4.6, "FR-102": 4.1, "FR-103": 4.8, "FR-104": null, "FR-105": 4.3,
};

function HR({ tweaks, navigate }) {
  const [detail, setDetail] = useState_hr(null);   // 선택 프리랜서

  useEffect_hr(() => {
    const onKey = (e) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fr = window.FREELANCERS;
  const activeCount = fr.filter(f => f.activeTasks > 0).length;
  const avgOnTime = (fr.reduce((a, f) => a + f.onTimeRate, 0) / fr.length).toFixed(1);
  const outsourcingTotal = fr.reduce((a, f) => a + f.monthSettlement, 0);

  const parseJobOf = (name) => window.AI_PARSE_JOBS.find(j => j.extracted.name === name);
  const tasksOf = (id) => window.WORK_TASKS.filter(t => t.assigneeId === id);
  const orderOf = (id) => window.ORDERS.find(o => o.id === id);

  // 납기 준수율 색 그라데이션
  const rateColor = (v) =>
    v >= 95 ? { text: "text-emerald-300", bar: "from-emerald-500 to-emerald-300", dot: "bg-emerald-400" } :
    v >= 93 ? { text: "text-cyan-300",    bar: "from-cyan-500 to-cyan-300",       dot: "bg-cyan-400" } :
    v >= 90 ? { text: "text-amber-300",   bar: "from-amber-500 to-amber-300",     dot: "bg-amber-400" } :
              { text: "text-rose-300",    bar: "from-rose-500 to-rose-300",       dot: "bg-rose-400" };

  const rateTypeLabel = (t) => t === "FIXED" ? "건당 고정" : "변동 단가";

  // 단가 이력 목업 — 현재 단가는 실데이터, 과거는 예시. 단가 변경은 RATE_CHANGE 결재로만
  const rateHistoryOf = (f) => {
    const cur = f.rate;
    const round = (n) => Math.round(n / 1000) * 1000;
    return [
      { at: "2026-07-01", rate: cur,             reason: "RATE_CHANGE 결재 승인", current: true },
      { at: "2026-04-01", rate: round(cur * 0.9), reason: "RATE_CHANGE 결재 승인", current: false },
      { at: "2026-01-02", rate: round(cur * 0.8), reason: "최초 등록",             current: false },
    ];
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="pink">HR · 리소스 · 조직</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">인사 · 조직</h1>
          <p className="text-sm text-slate-300 mt-1">프리랜서/인플루언서 마스터 · 단가 이력 · 평가 지표 — 단가 변경은 결재(RATE_CHANGE)로만 반영됩니다</p>
        </div>
        <button className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center gap-2">
          <window.Icon name="plus" className="w-3.5 h-3.5" />프리랜서 등록
        </button>
      </div>

      {/* 상단 요약 3타일 */}
      <div className="grid grid-cols-12 gap-4">
        <window.Card className="col-span-12 md:col-span-4 p-5">
          <div className="text-xs text-slate-400 mb-1">활성 프리랜서</div>
          <div className="text-2xl font-bold tabular-nums">{activeCount}<span className="text-base ml-0.5 text-slate-500">명</span></div>
          <div className="mt-1 text-[11px] text-slate-500">전체 {fr.length}명 · 진행 작업 배정 기준</div>
        </window.Card>
        <window.Card className="col-span-12 md:col-span-4 p-5">
          <div className="text-xs text-slate-400 mb-1">평균 납기 준수율</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-300">{avgOnTime}<span className="text-base ml-0.5 text-slate-500">%</span></div>
          <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${avgOnTime}%` }}></div>
          </div>
        </window.Card>
        <window.Card className="col-span-12 md:col-span-4 p-5">
          <div className="text-xs text-slate-400 mb-1">이달 외주비 합계</div>
          <div className="text-2xl font-bold tabular-nums">₩{window.fmt(outsourcingTotal)}</div>
          <div className="mt-1 text-[11px] text-slate-500">프리랜서 지급 예정액 · 정산 관리와 연동</div>
        </window.Card>
      </div>

      {/* 프리랜서/인플루언서 마스터 목록 */}
      <window.Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold">프리랜서 · 인플루언서 마스터 <span className="text-pink-300 font-bold ml-1">{fr.length}</span></h3>
            <div className="text-xs text-slate-500 mt-0.5">행 클릭 시 단가 이력 · 평가 지표 · 최근 작업 상세</div>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <window.Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />계정 없는 관리 대상 · 직원(로그인)과 구분
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-6 py-2.5 font-medium">이름</th>
                <th className="px-3 py-2.5 font-medium">전문 분야</th>
                <th className="px-3 py-2.5 font-medium">단가 유형</th>
                <th className="px-3 py-2.5 font-medium text-right">단가</th>
                <th className="px-3 py-2.5 font-medium text-right">진행 작업</th>
                <th className="px-3 py-2.5 font-medium">납기 준수율</th>
                <th className="px-6 py-2.5 font-medium text-right">월 정산액</th>
              </tr>
            </thead>
            <tbody>
              {fr.map(f => {
                const c = rateColor(f.onTimeRate);
                return (
                  <tr key={f.id} onClick={() => setDetail(f)} className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition ${detail?.id === f.id ? 'bg-pink-500/10' : ''}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{f.name[0]}</div>
                        <div>
                          <div className="text-sm font-medium">{f.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{f.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-300">{f.specialty}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${f.rateType === 'FIXED' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-purple-500/15 text-purple-300'}`}>{rateTypeLabel(f.rateType)}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">₩{window.fmt(f.rate)}<span className="text-slate-600 text-[10px] ml-0.5">/건</span></td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-300">{f.activeTasks}건</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${c.bar}`} style={{ width: `${f.onTimeRate}%` }}></div>
                        </div>
                        <span className={`text-xs tabular-nums font-medium ${c.text}`}>{f.onTimeRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums font-semibold text-emerald-300">₩{window.fmt(f.monthSettlement)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </window.Card>

      {/* 직원 인센티브 계산 — 확장 지점 (미확정 · 잠금). 기능인 척 하지 않음 */}
      <window.Card className="p-6 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-lg">🔒</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-300">직원 인센티브 계산</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/40 border border-slate-600 text-slate-400">비활성</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">산식 미확정 · 발주자 질의서 Q8</span>
            </div>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-3xl">
              영업 실적(매출 이벤트 원장) 기반 직원 인센티브는 프리랜서 평가와 대칭 구조의 <span className="font-mono text-slate-300">IncentiveService</span> 확장 지점으로 예약되어 있습니다.
              산식이 확정되면(4주차 이전) 승인선 규칙과 같은 <b className="text-slate-300">정책 주입 방식</b>으로 추가만 하면 반영됩니다 — <b className="text-slate-300">산식 확정 시 조건부 1차 편입, 미확정 시 기본 Phase 2 분리</b> (실행계획 §5.5).
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button disabled className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-500 cursor-not-allowed flex items-center gap-2">
                <window.Icon name="settings" className="w-3.5 h-3.5" />산식 등록 (잠금)
              </button>
              <span className="text-[11px] text-slate-500">현 단계에서는 계산 기능을 제공하지 않습니다 — 화면상 자리표시만 노출</span>
            </div>
          </div>
        </div>
      </window.Card>

      {/* ── 상세 사이드패널 ── */}
      {detail && (() => {
        const f = detail;
        const c = rateColor(f.onTimeRate);
        const job = parseJobOf(f.name);
        const history = rateHistoryOf(f);
        const tasks = tasksOf(f.id);
        const quality = QUALITY_SCORES[f.id];
        return (
          <div className="fixed inset-0 z-30 flex">
            <div onClick={() => setDetail(null)} className="flex-1 bg-slate-950/70"></div>
            <div className="w-full max-w-md bg-slate-950 border-l border-slate-700/60 shadow-2xl shadow-pink-500/10 overflow-y-auto">
              <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-950 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-sm font-bold">{f.name[0]}</div>
                  <div>
                    <div className="text-[11px] font-mono text-slate-500">{f.id}</div>
                    <h3 className="font-bold text-lg">{f.name}</h3>
                  </div>
                </div>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-md hover:bg-white/10"><window.Icon name="x" className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-5">
                {/* 기본 정보 (계좌 마스킹) */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">기본 정보</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">전문 분야</span><span className="text-xs">{f.specialty}</span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">단가 유형</span><span className="text-xs"><span className={`px-1.5 py-0.5 rounded font-medium ${f.rateType === 'FIXED' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-purple-500/15 text-purple-300'}`}>{rateTypeLabel(f.rateType)}</span> <span className="font-mono text-slate-500 ml-1">{f.rateType}</span></span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">현재 단가</span><span className="tabular-nums font-semibold">₩{window.fmt(f.rate)} <span className="text-slate-500 text-xs font-normal">/건</span></span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">진행 작업</span><span className="tabular-nums text-xs">{f.activeTasks}건</span></div>
                    <div className="flex justify-between items-center py-1.5"><span className="text-slate-500">지급 계좌</span>
                      <span className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
                        {job ? job.bank : "●●●●-●●-●●●●"}
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">마스킹</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 단가 이력 — RATE_CHANGE 결재로만 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400">단가 이력</h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">단가 변경은 결재(RATE_CHANGE)로만</span>
                  </div>
                  <div className="space-y-1.5">
                    {history.map((h, i) => (
                      <div key={i} className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${h.current ? 'bg-emerald-500/[0.07] border-emerald-500/25' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium tabular-nums flex items-center gap-1.5">
                            ₩{window.fmt(h.rate)}
                            {h.current && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">현재</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{h.reason}</div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 tabular-nums flex-shrink-0">{h.at}</span>
                      </div>
                    ))}
                  </div>
                  {f.rateType === "VARIABLE" && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-start gap-1.5">
                      <window.Icon name="alert" className="w-3 h-3 mt-0.5 flex-shrink-0 text-purple-400" />
                      변동 단가 — 배정 시점 단가가 rateSnapshot으로 고정되어 이후 마스터 변경과 절연됩니다 (BS0008)
                    </div>
                  )}
                </div>

                {/* 평가 지표 카드 */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">평가 지표</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* 납기 준수율 — 자동 산출 */}
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-white/10">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>납기 준수율</div>
                      <div className={`text-xl font-bold tabular-nums mt-1 ${c.text}`}>{f.onTimeRate}%</div>
                      <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${c.bar}`} style={{ width: `${f.onTimeRate}%` }}></div>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1.5">시스템 자동 산출 (기한 준수 기반)</div>
                    </div>
                    {/* 품질 점수 — 팀장 수동 평가 */}
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-white/10">
                      <div className="text-[10px] text-slate-500">품질 점수</div>
                      {quality != null ? (
                        <>
                          <div className="text-xl font-bold tabular-nums mt-1 text-slate-100">{quality.toFixed(1)}<span className="text-sm text-slate-500 font-normal"> / 5.0</span></div>
                          <div className="mt-2 flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= Math.round(quality) ? 'bg-amber-400' : 'bg-white/10'}`}></div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1"><span className="text-sm font-semibold text-slate-500">미입력</span><span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">평가 대기</span></div>
                      )}
                      <div className="text-[9px] text-slate-500 mt-1.5">팀장 수동 평가 (1~5점 · Q17 척도 A 가정)</div>
                    </div>
                  </div>
                </div>

                {/* 최근 작업 — WORK_TASKS 조인 */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">최근 작업 <span className="text-slate-600">({tasks.length})</span></h4>
                  {tasks.length === 0 ? (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-500">배정된 작업 없음</div>
                  ) : (
                    <div className="space-y-1.5">
                      {tasks.map(t => {
                        const o = orderOf(t.orderId);
                        return (
                          <div key={t.id} className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-medium truncate">{t.title}</div>
                              <window.EnumPill status={t.status} />
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                              <span className="font-mono">{t.orderId}</span> · {o?.clientName}
                              <span className="ml-auto tabular-nums flex items-center gap-1"><window.Icon name="clock" className="w-2.5 h-2.5" />{t.dueDate}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

window.HR = HR;
