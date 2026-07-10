// eval-report.jsx — 33 평가 조회 (route: evalReport)
// 모델: 5_프로토타입모델_평가조회.md · IDEA-05(저장된 뷰) · IDEA-06(행 훑기 패널) · IDEA-02(그리드)
// 당기/전기 비교(%p·부호 병행) · 표본 부족 배지(완료 3건 미만) · 패널 6개월 스파크라인
const { useState, useMemo, useEffect } = React;

// 로컬 보강 — 기간별 지표·6개월 추이는 data.js에 없어 화면 로컬 집계 데이터로 구성
// (당기 값은 FREELANCERS.onTimeRate/qualityScore와 일치시켜 두 화면 숫자 정합 유지 — 모델 합의 2)
const ER_STATS = {
  "FR-101": { type: "프리랜서",   dept: "DEPT-1", p: { "2026-07": { on: 96.4, q: 4.8, done: 9 },  "2026-06": { on: 92.1, q: 4.5, done: 11 }, "2026-05": { on: 90.4, q: 4.4, done: 10 } }, trendOn: [90, 91, 92, 94, 95, 96.4], trendQ: [4.2, 4.3, 4.4, 4.5, 4.6, 4.8] },
  "FR-102": { type: "인플루언서", dept: "DEPT-1", p: { "2026-07": { on: 91.2, q: 4.2, done: 14 }, "2026-06": { on: 93.4, q: 4.4, done: 12 }, "2026-05": { on: 94.0, q: 4.3, done: 13 } }, trendOn: [95, 94.5, 94, 93.4, 92.1, 91.2], trendQ: [4.5, 4.4, 4.4, 4.4, 4.3, 4.2] },
  "FR-103": { type: "프리랜서",   dept: "DEPT-2", p: { "2026-07": { on: 98.1, q: 4.9, done: 5 },  "2026-06": { on: 97.5, q: 4.7, done: 6 },  "2026-05": { on: 96.8, q: 4.7, done: 4 } }, trendOn: [95, 96, 96.8, 97.2, 97.5, 98.1], trendQ: [4.5, 4.6, 4.7, 4.7, 4.7, 4.9] },
  "FR-104": { type: "프리랜서",   dept: "DEPT-3", p: { "2026-07": { on: 88.7, q: 3.9, done: 2 },  "2026-06": { on: 90.2, q: 4.1, done: 8 },  "2026-05": { on: 91.5, q: 4.0, done: 7 } }, trendOn: [93, 92, 91.5, 90.8, 90.2, 88.7], trendQ: [4.2, 4.1, 4.0, 4.1, 4.1, 3.9] },
  "FR-105": { type: "인플루언서", dept: "DEPT-4", p: { "2026-07": { on: 94.9, q: 4.5, done: 8 },  "2026-06": { on: 90.2, q: 4.1, done: 7 },  "2026-05": { on: 89.5, q: 4.0, done: 6 } }, trendOn: [88, 89, 89.5, 90.2, 92.6, 94.9], trendQ: [3.9, 4.0, 4.0, 4.1, 4.3, 4.5] },
  "FR-106": { type: "프리랜서",   dept: "DEPT-2", p: { "2026-07": { on: 92.0, q: 4.0, done: 1 },  "2026-06": { on: 92.0, q: 4.0, done: 2 },  "2026-05": { on: 91.0, q: 3.9, done: 5 } }, trendOn: [90, 90.5, 91, 91.5, 92, 92], trendQ: [3.8, 3.9, 3.9, 4.0, 4.0, 4.0] },
};
const ER_MONTHS = ["2026-07", "2026-06", "2026-05"];
const ER_VIEWS = [ // 로컬 저장된 뷰 (SAVED_VIEWS에 evalReport 뷰가 없어 화면 로컬 정의 — IDEA-05)
  { id: "EV-V1", name: "인플루언서만", count: 2, filters: { type: "인플루언서" } },
  { id: "EV-V2", name: "준수율 90% 미만", count: 1, filters: { band: "LT90" } },
  { id: "EV-V3", name: "하락 추세", count: 2, filters: { sort: "onAsc", compare: true } },
];
const ER_LOW_SAMPLE = 3; // 완료 3건 미만 → 표본 부족 배지 (모델 합의 3)
const ER_PAGE = 5;

function EvalReport({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, Money, SidePanel, Sparkline, Icon, fmt } = window;

  const [views, setViews] = useState(ER_VIEWS);
  const [activeView, setActiveView] = useState(null);
  const initPeriod = route?.payload?.period && ER_MONTHS.includes(route.payload.period) ? route.payload.period : "2026-07";
  const [period, setPeriod] = useState(initPeriod);
  const [compare, setCompare] = useState(initPeriod === "2026-06" ? "2026-05" : "2026-06"); // "" = 비교 없음 → 증감 열 숨김
  const [typeF, setTypeF] = useState("ALL");
  const [deptF, setDeptF] = useState("ALL");
  const [bandF, setBandF] = useState("ALL");
  const [sortKey, setSortKey] = useState("onAsc");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const [panelIdx, setPanelIdx] = useState(null); // rows 인덱스
  const [fullHistory, setFullHistory] = useState(false);

  const applyView = (id) => {
    setActiveView(id); setPage(0);
    setTypeF("ALL"); setBandF("ALL"); setSortKey("onAsc");
    const v = views.find((x) => x.id === id);
    if (!v) return;
    if (v.filters.type) setTypeF(v.filters.type);
    if (v.filters.band) setBandF(v.filters.band);
    if (v.filters.sort) setSortKey(v.filters.sort);
  };

  const rows = useMemo(() => {
    let r = FREELANCERS.map((f) => {
      const s = ER_STATS[f.id];
      const cur = s.p[period];
      const prev = compare ? s.p[compare] : null;
      return { f, s, cur, prev, low: cur.done < ER_LOW_SAMPLE };
    });
    if (typeF !== "ALL") r = r.filter((x) => x.s.type === typeF);
    if (deptF !== "ALL") r = r.filter((x) => x.s.dept === deptF);
    const inBand = (on) => bandF === "GTE90" ? on >= 90 : bandF === "B7090" ? on >= 70 && on < 90 : bandF === "LT70" ? on < 70 : on < 90; // LT90 = 저장된 뷰용
    if (bandF !== "ALL") r = r.filter((x) => !x.low && inBand(x.cur.on));
    if (keyword) r = r.filter((x) => x.f.name.includes(keyword));
    const cmp = {
      onAsc: (a, b) => a.cur.on - b.cur.on, onDesc: (a, b) => b.cur.on - a.cur.on,
      qDesc: (a, b) => b.cur.q - a.cur.q, doneDesc: (a, b) => b.cur.done - a.cur.done,
    }[sortKey];
    return r.slice().sort(cmp);
  }, [period, compare, typeF, deptF, bandF, sortKey, keyword]);

  const totalPages = Math.max(1, Math.ceil(rows.length / ER_PAGE));
  const pageRows = rows.slice(page * ER_PAGE, (page + 1) * ER_PAGE);
  const valid = rows.filter((x) => !x.low);
  const summary = {
    n: rows.length,
    done: rows.reduce((a, x) => a + x.cur.done, 0),
    on: valid.length ? (valid.reduce((a, x) => a + x.cur.on, 0) / valid.length).toFixed(1) : "-",
    q: valid.length ? (valid.reduce((a, x) => a + x.cur.q, 0) / valid.length).toFixed(1) : "-",
  };
  const panelRow = panelIdx != null ? rows[Math.min(panelIdx, rows.length - 1)] : null;

  // route.payload.freelancerId 소비 — 해당 행 사이드 패널 자동 오픈 (마운트 시 1회)
  useEffect(() => {
    const fid = route?.payload?.freelancerId;
    if (!fid) return;
    const idx = rows.findIndex((x) => x.f.id === fid);
    if (idx >= 0) { setPanelIdx(idx); setPage(Math.floor(idx / ER_PAGE)); setFullHistory(false); }
    return () => {};
  }, []);

  // 숫자키 1~3 뷰 전환 + ↑↓ 행 이동(패널) + Ctrl+C TSV (IDEA-02/05/06)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (["1", "2", "3"].includes(e.key)) { const v = views[Number(e.key) - 1]; if (v) applyView(activeView === v.id ? null : v.id); }
      if (panelIdx != null && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setPanelIdx((i) => Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
        setFullHistory(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && !window.getSelection().toString()) {
        const tsv = ["프리랜서\t유형\t완료\t준수율(당기)\t준수율(전기)\t품질(당기)\t품질(전기)\t진행중"]
          .concat(rows.map((x) => [x.f.name, x.s.type, x.cur.done, x.low ? "표본부족" : `${x.cur.on}%`, x.prev ? `${x.prev.on}%` : "-", x.cur.q, x.prev ? x.prev.q : "-", x.f.activeTasks].join("\t"))).join("\n");
        navigator.clipboard && navigator.clipboard.writeText(tsv);
        window.toast(`${rows.length}행을 TSV로 복사했어요 (IDEA-02)`);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, panelIdx, views, activeView]);

  const Delta = ({ v, unit, digits = 1 }) => {
    if (v == null) return <span className="text-slate-600">-</span>;
    const r = Number(v.toFixed(digits));
    if (r === 0) return <span className="text-slate-500 font-mono text-xs">0{unit}</span>;
    return <span className={`font-mono text-xs ${r > 0 ? "text-emerald-300" : "text-rose-300"}`}>{r > 0 ? "+" : "−"}{Math.abs(r)}{unit}</span>;
  };
  const LowSample = () => (
    <span className="inline-flex items-center gap-1 rounded-md border bg-slate-500/15 text-slate-300 border-slate-500/30 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" title={`완료 ${ER_LOW_SAMPLE}건 미만 — 소표본 오판 방지를 위해 수치 대신 배지로 표시합니다`}>
      <Icon name="alert" className="w-3 h-3" />표본 부족
    </span>
  );

  const saveView = () => {
    const name = `내 뷰 ${views.length + 1}`;
    setViews((s) => [...s, { id: `EV-V${s.length + 1}`, name, count: rows.length, filters: { type: typeF !== "ALL" ? typeF : null } }]);
    window.toast(`"${name}" 저장 완료 — 숫자키로 바로 전환할 수 있어요 (IDEA-05)`);
  };
  const exportXlsx = () => {
    window.toast(`현재 필터 결과 ${rows.length}명을 xlsx로 내보냈어요 (시뮬레이션)`, { actionLabel: "작업 배정에서 활용 →", onAction: () => navigate("assign") });
  };
  const recentEvalsOf = (fid) => EVALUATIONS.filter((e) => e.freelancerId === fid);

  const sel = "rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none";

  return (
    <div>
      <PageHeader
        label="RESOURCES · 33" labelColor="purple" title="평가 조회"
        desc="기한 준수율(자동) · 품질 점수(수동) · 완료 작업 수의 당기/전기 비교 — 다음 배정 의사결정을 데이터로 지원합니다 (UC33)"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={saveView} className="px-3.5 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700">뷰로 저장</button>
            <button onClick={exportXlsx} className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-1.5">
              <Icon name="download" className="w-3.5 h-3.5" />내보내기
            </button>
          </div>
        }
      />

      {/* 저장된 뷰 (IDEA-05, 숫자키 1~3) */}
      <div className="mb-4"><window.SavedViewChips views={views} activeId={activeView} onSelect={applyView} allLabel="전체" /></div>

      {/* 필터 */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-xs text-slate-500">* 기간</label>
          <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(0); }} className={sel}>
            {ER_MONTHS.map((m) => <option key={m} value={m}>{m.replace("-", "년 ")}월</option>)}
          </select>
          <label className="text-xs text-slate-500">비교 기간</label>
          <select value={compare} onChange={(e) => setCompare(e.target.value)} className={sel}>
            <option value="">비교 없음</option>
            {ER_MONTHS.filter((m) => m !== period).map((m) => <option key={m} value={m}>{m.replace("-", "년 ")}월</option>)}
          </select>
          <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(0); }} className={sel}>
            <option value="ALL">유형 전체</option><option value="프리랜서">프리랜서</option><option value="인플루언서">인플루언서</option>
          </select>
          <select value={deptF} onChange={(e) => { setDeptF(e.target.value); setPage(0); }} className={sel}>
            <option value="ALL">부서 전체</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={bandF} onChange={(e) => { setBandF(e.target.value); setPage(0); }} className={sel}>
            <option value="ALL">준수율 전체</option><option value="GTE90">90% 이상</option><option value="B7090">70~90%</option><option value="LT70">70% 미만</option><option value="LT90">90% 미만 (뷰)</option>
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className={sel}>
            <option value="onAsc">기한 준수율 낮은 순</option><option value="onDesc">기한 준수율 높은 순</option>
            <option value="qDesc">품질 점수 높은 순</option><option value="doneDesc">완료 작업 많은 순</option>
          </select>
          <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(0); }} placeholder="프리랜서 이름" className={`${sel} w-36`} />
          <button onClick={() => window.toast(`조회 완료 — 대상 ${rows.length}명`)} className="px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm hover:bg-slate-700">조회</button>
        </div>
      </Card>

      {/* 요약 스트립 */}
      <div className="mb-4 rounded-xl bg-slate-900 border border-slate-700/60 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-slate-400">대상 <b className="text-slate-100 tabular-nums">{summary.n}</b>명</span>
        <span className="text-slate-400">완료 작업 <b className="text-slate-100 tabular-nums">{fmt(summary.done)}</b>건</span>
        <span className="text-slate-400">평균 기한 준수율 <b className="text-emerald-300 tabular-nums">{summary.on}%</b> <span className="text-[10px] text-slate-600">(자동 산출)</span></span>
        <span className="text-slate-400">평균 품질 <b className="text-amber-300 tabular-nums">{summary.q}점</b> <span className="text-[10px] text-slate-600">(5점 척도 · MG1006)</span></span>
        <span className="ml-auto text-[10px] text-slate-600">표본 부족(완료 {ER_LOW_SAMPLE}건 미만)은 평균에서 제외</span>
      </div>

      {/* 지표 테이블 — 자체 가로 스크롤 + 첫 열 고정 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-5 py-2.5 font-medium sticky left-0 bg-slate-900 z-10">프리랜서명</th>
                <th className="px-3 py-2.5 font-medium">유형</th>
                <th className="px-3 py-2.5 font-medium text-right">완료 작업</th>
                <th className="px-3 py-2.5 font-medium text-right">준수율 당기</th>
                {compare && <th className="px-3 py-2.5 font-medium text-right">전기</th>}
                {compare && <th className="px-3 py-2.5 font-medium text-right">증감</th>}
                <th className="px-3 py-2.5 font-medium text-right">품질 당기</th>
                {compare && <th className="px-3 py-2.5 font-medium text-right">전기</th>}
                {compare && <th className="px-3 py-2.5 font-medium text-right">증감</th>}
                <th className="px-5 py-2.5 font-medium text-right">진행 중</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((x) => {
                const gIdx = rows.indexOf(x);
                const open = panelRow && panelRow.f.id === x.f.id;
                return (
                  <tr key={x.f.id} onClick={() => { setPanelIdx(gIdx); setFullHistory(false); }}
                    className={`border-b border-slate-800/60 cursor-pointer transition ${open ? "bg-purple-500/10" : "hover:bg-slate-800/30"}`}>
                    <td className={`px-5 py-3 sticky left-0 z-10 ${open ? "bg-slate-900" : "bg-slate-900"}`}>
                      <div className="font-medium text-sm flex items-center gap-2">{x.f.name}{!x.f.active && <EnumPill status="INACTIVE" />}</div>
                      <div className="text-[10px] font-mono text-slate-500">{x.f.id}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-300">{x.s.type}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">{x.cur.done}</td>
                    <td className="px-3 py-3 text-right">{x.low ? <LowSample /> : <span className={`tabular-nums text-sm ${x.cur.on >= 95 ? "text-emerald-300" : x.cur.on < 90 ? "text-amber-300" : ""}`}>{x.cur.on}%</span>}</td>
                    {compare && <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-500">{x.low ? "-" : `${x.prev.on}%`}</td>}
                    {compare && <td className="px-3 py-3 text-right">{x.low ? <span className="text-slate-600 text-xs">-</span> : <Delta v={x.cur.on - x.prev.on} unit="p" />}</td>}
                    <td className="px-3 py-3 text-right tabular-nums text-sm">{x.cur.q}</td>
                    {compare && <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-500">{x.prev ? x.prev.q : "-"}</td>}
                    {compare && <td className="px-3 py-3 text-right"><Delta v={x.prev ? x.cur.q - x.prev.q : null} unit="" /></td>}
                    <td className="px-5 py-3 text-right tabular-nums text-xs">{x.f.activeTasks}건</td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-slate-500">조건에 맞는 대상이 없어요</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-slate-800 text-sm">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className={`px-2.5 py-1 rounded-md ${page === 0 ? "text-slate-600" : "text-slate-300 hover:bg-slate-800"}`}>이전</button>
          <span className="text-xs text-slate-500 tabular-nums">{page + 1} / {totalPages} 페이지</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className={`px-2.5 py-1 rounded-md ${page >= totalPages - 1 ? "text-slate-600" : "text-slate-300 hover:bg-slate-800"}`}>다음</button>
        </div>
      </Card>

      {/* 행 훑기 사이드 패널 (IDEA-06) */}
      <SidePanel
        open={!!panelRow} onClose={() => setPanelIdx(null)}
        title={panelRow ? `${panelRow.f.name} (${panelRow.s.type})` : ""}
        subtitle={panelRow ? `${panelRow.f.id} · ${panelRow.f.specialty} · ↑↓로 행 이동` : ""}
        footer={panelRow && (
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setFullHistory((v) => !v)} className="px-3.5 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">{fullHistory ? "요약으로" : "평가 이력 전체"}</button>
            <button onClick={() => navigate("assign", { freelancerId: panelRow.f.id })} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">작업 배정으로</button>
          </div>
        )}
      >
        {panelRow && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <EnumPill status={panelRow.f.active ? "ACTIVE" : "INACTIVE"} />
              <span className="text-xs text-slate-500">진행 중 {panelRow.f.activeTasks}건 · 배정 화면과 동일 산출 (IDEA-12)</span>
            </div>
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 text-xs">현재 마스터 단가</span>
                <Money value={panelRow.f.rate} />
              </div>
              <div className="text-[10px] text-slate-600 mt-1.5">단가는 배정 시점 스냅샷 적용 — 변경은 신규 배정부터 (BS0008)</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">월별 기한 준수율 추이 (최근 6개월)</span>
                <span className="text-xs font-mono tabular-nums text-emerald-300">{panelRow.s.trendOn[0]}% → {panelRow.s.trendOn[5]}%</span>
              </div>
              <Sparkline data={panelRow.s.trendOn} color="#34d399" height={40} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">월별 품질 점수 추이 (최근 6개월)</span>
                <span className="text-xs font-mono tabular-nums text-amber-300">{panelRow.s.trendQ[0]}점 → {panelRow.s.trendQ[5]}점</span>
              </div>
              <Sparkline data={panelRow.s.trendQ} color="#fbbf24" height={40} />
            </div>
            {panelRow.low && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 flex items-start gap-2">
                <Icon name="alert" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
                당기 완료 작업 {panelRow.cur.done}건 — 표본이 적어 준수율 수치는 표시하지 않아요 (소표본 오판 방지)
              </div>
            )}

            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">{fullHistory ? "평가 이력 전체" : "최근 평가 이력"}</div>
              {recentEvalsOf(panelRow.f.id).length === 0 ? (
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 text-xs text-slate-500">
                  저장된 평가가 아직 없어요 —{" "}
                  <button onClick={() => navigate("evalInput", { freelancerId: panelRow.f.id })} className="text-purple-300 hover:text-purple-200">평가 입력으로 →</button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(fullHistory ? recentEvalsOf(panelRow.f.id) : recentEvalsOf(panelRow.f.id).slice(0, 3)).map((e) => (
                    <div key={e.id} className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs truncate">{e.comment}</div>
                        <div className="text-[10px] font-mono text-slate-600 mt-0.5">{e.createdAt} · {e.taskId || "총평"}</div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-amber-300 tabular-nums flex items-center gap-1"><Icon name="star" className="w-3.5 h-3.5" />{e.scores.quality}점</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

window.EvalReport = EvalReport;
