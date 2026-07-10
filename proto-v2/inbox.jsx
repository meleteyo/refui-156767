// inbox.jsx — 22L 결재함 (내 승인 대기/진행 중/완료/내 기안) · IDEA-09 트리아지 큐(J/K/A/R)
// SLA 경과 색상(24h slate → 48h amber → 초과 rose 상단 고정) + 저장된 뷰(IDEA-05) + 행 훑기 패널(IDEA-06)
const { useState, useMemo, useEffect, useRef, useCallback } = React;

const INBOX_NOW = typeof AGGREGATED_AT !== "undefined" ? AGGREGATED_AT : "2026-07-10 11:30";
const hoursSince = (ts) => {
  if (!ts) return 0;
  const ms = new Date(INBOX_NOW.replace(" ", "T")) - new Date(String(ts).replace(" ", "T"));
  return Math.max(0, ms / 3600000);
};

// 내 차례 판정 — PRIORITY: 첫 PENDING이 나 / BROADCAST: 내 PENDING 단계가 있으면
const myTurnStep = (doc, mode) => {
  if (doc.status !== "IN_PROGRESS") return null;
  if (mode === "BROADCAST") return doc.approvalLine.find((s) => s.status === "PENDING" && s.approverId === CURRENT_USER_ID) || null;
  const first = doc.approvalLine.find((s) => s.status === "PENDING");
  return first && first.approverId === CURRENT_USER_ID ? first : null;
};
// 대기 시작 = 직전 단계 처리 시각(없으면 기안 시각)
const waitStartOf = (doc) => {
  const idx = doc.approvalLine.findIndex((s) => s.status === "PENDING");
  if (idx > 0 && doc.approvalLine[idx - 1].decidedAt) return doc.approvalLine[idx - 1].decidedAt;
  return doc.createdAt;
};

const TABS = [
  { key: "PENDING",  label: "내 승인 대기" },
  { key: "RUNNING",  label: "진행 중" },
  { key: "DONE",     label: "완료" },
  { key: "MINE",     label: "내 기안" },
];

function Inbox({ route, navigate, tweaks }) {
  const { Card, Icon, SectionLabel, PageHeader, EnumPill, Money, SidePanel, SavedViewChips, ConfirmDialog, fmt, toast } = window;
  const policyMode = tweaks.policyMode || "PRIORITY";
  const HIGH = Math.min(...APPROVAL_LINE_RULES.filter((r) => r.threshold != null).map((r) => r.threshold)); // MG1002 구간 참조

  const [approvals, setApprovals] = useState(() => APPROVALS.map((a) => ({ ...a, approvalLine: a.approvalLine.map((s) => ({ ...s })) })));
  const [tab, setTab] = useState("PENDING");
  const [keyword, setKeyword] = useState("");
  const [typeF, setTypeF] = useState("ALL");
  const [amtF, setAmtF] = useState("ALL");
  const [drafterF, setDrafterF] = useState("ALL");
  const [viewId, setViewId] = useState(null);
  const [selId, setSelId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: 'approve'|'reject', doc }
  const [rejectReason, setRejectReason] = useState("");
  const [remindedIds, setRemindedIds] = useState([]);
  const [polledAt, setPolledAt] = useState(INBOX_NOW.slice(11, 16));

  useEffect(() => { // 딥링크 프리셋 — home '내 결재 대기' 타일 → 내 승인 대기(내 차례) 탭 (P4)
    if (route.payload?.filter === "myTurn") { setTab("PENDING"); setSelId(null); setPanelOpen(false); }
  }, [route.payload]);

  useEffect(() => { // 30초 폴링 시뮬레이션 (BS0011)
    const t = setInterval(() => setPolledAt(new Date().toTimeString().slice(0, 5)), 30000);
    return () => clearInterval(t);
  }, []);

  const orderOf = (doc) => ORDERS.find((o) => o.id === doc.orderId) || null;
  const titleOf = (doc) => {
    const o = orderOf(doc);
    if (o) return `${o.clientName} · ${o.item}`;
    if (doc.freelancerId) { const f = FREELANCERS.find((x) => x.id === doc.freelancerId); return f ? `${f.name} (${f.specialty})` : doc.freelancerId; }
    if (doc.settlementId) { const s = SETTLEMENTS.find((x) => x.id === doc.settlementId); return s ? `${s.target} ${s.period} 정산` : doc.settlementId; }
    return "—";
  };

  const tabDocs = useMemo(() => ({
    PENDING: approvals.filter((d) => myTurnStep(d, policyMode)),
    RUNNING: approvals.filter((d) => d.status === "IN_PROGRESS" && !myTurnStep(d, policyMode) &&
      d.approvalLine.some((s) => s.approverId === CURRENT_USER_ID && s.status === "APPROVED")),
    DONE:    approvals.filter((d) => d.status !== "IN_PROGRESS"),
    MINE:    approvals.filter((d) => d.requesterId === CURRENT_USER_ID),
  }), [approvals, policyMode]);

  const drafters = useMemo(() => [...new Set(approvals.map((a) => a.requester))], [approvals]);

  const rows = useMemo(() => {
    let list = tabDocs[tab] || [];
    if (keyword) list = list.filter((d) => d.id.includes(keyword) || titleOf(d).includes(keyword) || (d.orderId || "").includes(keyword));
    if (typeF !== "ALL") list = list.filter((d) => d.type === typeF);
    if (amtF === "LT") list = list.filter((d) => d.amount < HIGH);
    if (amtF === "GTE") list = list.filter((d) => d.amount >= HIGH);
    if (drafterF !== "ALL") list = list.filter((d) => d.requester === drafterF);
    // SLA 48h 초과 상단 고정 (IDEA-11) → 이후 최신순
    return [...list].sort((a, b) => {
      const da = a.status === "IN_PROGRESS" && hoursSince(waitStartOf(a)) >= 48 ? 1 : 0;
      const db = b.status === "IN_PROGRESS" && hoursSince(waitStartOf(b)) >= 48 ? 1 : 0;
      if (da !== db) return db - da;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [tabDocs, tab, keyword, typeF, amtF, drafterF, HIGH]);

  const delayed = rows.filter((d) => d.status === "IN_PROGRESS" && hoursSince(waitStartOf(d)) >= 48);
  const sel = rows.find((d) => d.id === selId) || null;
  const selIdx = rows.findIndex((d) => d.id === selId);

  const moveSel = useCallback((dir) => {
    if (rows.length === 0) return;
    const next = selIdx < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, selIdx + dir));
    setSelId(rows[next].id);
  }, [rows, selIdx]);

  // ── A/R 처리 (트리아지 — 결재 상세와 동일 마찰 규칙 §4.6) ──────────────────
  const applyDecision = (doc, decision, reasonText) => {
    // 새 승인선·상태를 먼저 계산 (setState 업데이터는 지연 실행되므로 토스트 분기용 값은 즉시 산출)
    const line = doc.approvalLine.map((s) =>
      s.status === "PENDING" && s.approverId === CURRENT_USER_ID
        ? { ...s, status: decision, comment: decision === "REJECTED" ? reasonText : "확인 완료", decidedAt: INBOX_NOW }
        : s);
    const stillPending = decision !== "REJECTED" && line.some((s) => s.status === "PENDING");
    const status = decision === "REJECTED" ? "REJECTED" : stillPending ? "IN_PROGRESS" : "APPROVED";
    const becameFinal = status === "APPROVED";
    setApprovals((list) => list.map((d) => d.id !== doc.id ? d
      : { ...d, approvalLine: line, status, decidedAt: status === "IN_PROGRESS" ? d.decidedAt : INBOX_NOW,
          resultNote: status === "REJECTED" ? "반려 확정 — 데이터 변경 없음 (BS0006)" : d.resultNote }));
    setDialog(null); setRejectReason("");
    const remain = tabDocs.PENDING.filter((d) => d.id !== doc.id).length;
    if (decision === "REJECTED") {
      toast(`${doc.id} 반려 완료 — 데이터는 변경되지 않았습니다 (BS0006)`, { tone: "warn",
        actionLabel: remain > 0 ? `다음 건 → (대기 ${remain}건)` : null, onAction: () => moveSel(1) });
    } else if (becameFinal) {
      toast(`${doc.id} 최종 승인 — 7연쇄 반영 시작`, {
        actionLabel: "반영 영수증 보기 →", onAction: () => navigate("approvalDetail", { approvalId: doc.id, justApproved: true }) });
    } else {
      const next = doc.approvalLine.find((s) => s.status === "PENDING" && s.approverId !== CURRENT_USER_ID);
      toast(`${doc.id} 승인 완료 — 다음 차례 ${next ? next.approver : "확인"}`, {
        actionLabel: remain > 0 ? "다음 건 →" : null, onAction: () => moveSel(1) });
    }
    // 다음 건 자동 로드 (IDEA-09)
    const nextRows = rows.filter((d) => d.id !== doc.id);
    setSelId(nextRows.length ? nextRows[Math.min(selIdx, nextRows.length - 1)].id : null);
    if (nextRows.length === 0) setPanelOpen(false);
  };

  const canAct = sel && myTurnStep(sel, policyMode);

  // ── J/K/A/R/O 키보드 (IDEA-09) ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || dialog) return;
      const k = e.key.toLowerCase();
      if (k === "j") { e.preventDefault(); moveSel(1); }
      else if (k === "k") { e.preventDefault(); moveSel(-1); }
      else if (k === "enter" && sel) setPanelOpen(true);
      else if (k === "a" && canAct) setDialog({ kind: "approve", doc: sel });
      else if (k === "r" && canAct) setDialog({ kind: "reject", doc: sel });
      else if (k === "o" && sel && sel.orderId) navigate("orders", { orderId: sel.orderId });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSel, sel, canAct, dialog, navigate]);

  const remind = (doc) => {
    setRemindedIds((s) => [...s, doc.id]);
    toast(`${doc.id} 현재 차례 승인자에게 알림을 다시 보냈어요 — 하루 1회 (모델 705)`);
  };

  const slaChip = (doc) => {
    const h = hoursSince(waitStartOf(doc));
    if (h >= 48) return <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono font-bold bg-rose-500 text-white">D+{Math.floor(h / 24)} 지연</span>;
    const tone = h >= 24 ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" : "bg-slate-500/15 text-slate-300 border border-slate-500/30";
    return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono ${tone}`}>{h < 1 ? `${Math.round(h * 60)}분` : `${Math.round(h)}시간`}</span>;
  };

  const stepOf = (doc) => {
    const total = doc.approvalLine.length;
    const cur = doc.approvalLine.filter((s) => s.status !== "PENDING").length + (doc.status === "IN_PROGRESS" ? 1 : 0);
    return `${Math.min(cur, total)}/${total}`;
  };

  const activeChips = [
    typeF !== "ALL" && { k: "type", label: (window.ENUM_META[typeF] || {}).label || typeF, clear: () => setTypeF("ALL") },
    amtF !== "ALL" && { k: "amt", label: amtF === "GTE" ? `₩${fmt(HIGH)} 이상` : `₩${fmt(HIGH)} 미만`, clear: () => setAmtF("ALL") },
    drafterF !== "ALL" && { k: "dr", label: `기안자 ${drafterF}`, clear: () => setDrafterF("ALL") },
  ].filter(Boolean);

  const selBtn = "px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700 text-xs focus:border-purple-500/60 outline-none";

  return (
    <div className="space-y-4">
      <PageHeader label="APPROVAL · INBOX (22L)" labelColor="purple" title="결재함"
        desc="한 건씩 보되 빠르게 — J/K 이동 · A 승인 · R 반려 · O 원본 주문 · Enter 패널 (IDEA-09)"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="결재번호 · 주문명 검색"
                className="w-56 pl-9 pr-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-700 text-sm focus:border-purple-500/60 outline-none" />
            </div>
            <button onClick={() => toast("현재 탭·필터 상태를 뷰로 저장했어요 — 사이드바에서 1클릭 진입 (IDEA-05)")}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">뷰로 저장</button>
          </div>} />

      {/* 탭 + 저장된 뷰 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700/60">
          {TABS.map((t, i) => (
            <React.Fragment key={t.key}>
              {t.key === "MINE" && <span className="w-px h-5 bg-slate-700 mx-1"></span>}
              <button onClick={() => { setTab(t.key); setSelId(null); setPanelOpen(false); }}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-2 ${tab === t.key ? "bg-purple-500/20 text-purple-100" : "text-slate-400 hover:text-slate-200"}`}>
                {t.label}
                <span className={`font-mono text-[10px] px-1.5 rounded ${tab === t.key ? "bg-purple-500/30 text-purple-100" : "bg-slate-800 text-slate-400"}`}>{(tabDocs[t.key] || []).length}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
        <SavedViewChips views={SAVED_VIEWS.filter((v) => v.screen === "inbox")} activeId={viewId}
          onSelect={(id) => { setViewId(id); setTab("PENDING"); if (id) toast("저장된 뷰 '내 차례' 적용 (IDEA-05)"); }} allLabel="전체" />
      </div>

      {/* 필터 행 */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={selBtn}>
          <option value="ALL">유형 · 전체</option>
          {["ORDER_EDIT", "PARTIAL_REFUND", "FULL_REFUND", "REPAYMENT", "RATE_CHANGE", "SETTLEMENT_ADJUST"].map((t) => (
            <option key={t} value={t}>{(window.ENUM_META[t] || {}).label || t}</option>
          ))}
        </select>
        <select value={amtF} onChange={(e) => setAmtF(e.target.value)} className={selBtn}>
          <option value="ALL">금액 · 전체</option>
          <option value="LT">₩{fmt(HIGH)} 미만</option>
          <option value="GTE">₩{fmt(HIGH)} 이상</option>
        </select>
        <select value={drafterF} onChange={(e) => setDrafterF(e.target.value)} className={selBtn}>
          <option value="ALL">기안자 · 전체</option>
          {drafters.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {activeChips.map((c) => (
          <button key={c.k} onClick={c.clear} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-200 border border-purple-500/40">
            {c.label}<Icon name="x" className="w-3 h-3" />
          </button>
        ))}
        <span className="ml-auto text-slate-500">결과 <b className="text-slate-300 font-mono">{rows.length}</b>건</span>
      </div>

      {/* SLA 지연 고정 배너 (IDEA-11) */}
      {delayed.length > 0 && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-2 text-sm text-rose-200 flex items-center gap-2">
          <Icon name="alert" className="w-4 h-4 shrink-0" />
          대기 48시간 초과 <b className="font-mono">{delayed.length}건</b>을 상단에 고정했습니다 — SLA 지연 방지 (기준 48h · 정책 파라미터)
        </div>
      )}

      {/* 목록 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2.5 font-medium">결재번호</th>
                <th className="px-3 py-2.5 font-medium">유형</th>
                <th className="px-3 py-2.5 font-medium">주문명 / 대상</th>
                <th className="px-3 py-2.5 font-medium text-right">요청 금액</th>
                <th className="px-3 py-2.5 font-medium">기안자</th>
                {tab === "DONE" ? (<><th className="px-3 py-2.5 font-medium">처리 결과</th><th className="px-4 py-2.5 font-medium">처리일</th></>)
                : tab === "MINE" ? (<><th className="px-3 py-2.5 font-medium">상태</th><th className="px-4 py-2.5 font-medium">현재 차례</th></>)
                : (<><th className="px-3 py-2.5 font-medium">대기 경과</th><th className="px-4 py-2.5 font-medium">단계</th></>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  {tab === "PENDING" ? "내 차례의 결재가 없어요 — 새 기안이 상신되면 여기에 표시됩니다" : "표시할 결재 문서가 없어요"}
                  <div className="mt-2"><button onClick={() => navigate("draft")} className="text-purple-300 hover:text-purple-200 text-xs">기안 작성하기 →</button></div>
                </td></tr>
              )}
              {rows.map((d) => {
                const isSel = selId === d.id;
                const big = d.amount >= HIGH;
                const cur = d.approvalLine.find((s) => s.status === "PENDING");
                const isDelayed = d.status === "IN_PROGRESS" && hoursSince(waitStartOf(d)) >= 48;
                return (
                  <React.Fragment key={d.id}>
                    <tr tabIndex={0} onClick={() => { setSelId(d.id); setPanelOpen(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { setSelId(d.id); setPanelOpen(true); } }}
                      className={`border-b border-slate-800/70 cursor-pointer transition ${isSel ? "bg-purple-500/10" : "hover:bg-slate-800/40"}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{d.id}</td>
                      <td className="px-3 py-3"><EnumPill status={d.type} /></td>
                      <td className="px-3 py-3 max-w-[240px]"><span className="block truncate text-xs" title={titleOf(d)}>{titleOf(d)}</span></td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Money value={d.amount} className={big ? "font-bold" : ""} />
                        {big && <span className="ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30" title={`승인선 임계 ₩${fmt(HIGH)} 이상 (MG1002)`}>고액</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">{d.requester}</td>
                      {tab === "DONE" ? (
                        <><td className="px-3 py-3"><EnumPill status={d.status} /></td>
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">{(d.decidedAt || "").slice(0, 10)}</td></>
                      ) : tab === "MINE" ? (
                        <><td className="px-3 py-3"><span title="최종 승인 시에만 반영됩니다 (MG1001)"><EnumPill status={d.status} /></span></td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          {d.status === "IN_PROGRESS" && cur ? (
                            <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>{cur.step}단계 {cur.approver}</span>
                          ) : <span className="text-slate-600">—</span>}
                        </td></>
                      ) : (
                        <><td className="px-3 py-3">{slaChip(d)}</td>
                        <td className="px-4 py-3">
                          <span className="relative group font-mono text-xs text-slate-300 cursor-help">{stepOf(d)}
                            <span className="absolute z-40 hidden group-hover:block top-full right-0 mt-1 w-56 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-2.5 space-y-1">
                              {d.approvalLine.map((s) => (
                                <span key={s.step} className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">{s.step}단계 {s.approver}</span><EnumPill status={s.status} />
                                </span>
                              ))}
                            </span>
                          </span>
                        </td></>
                      )}
                    </tr>
                    {/* 반려 사유 미리보기 (BS0006) / 내 기안 서브 행 */}
                    {(tab === "DONE" || tab === "MINE") && d.status === "REJECTED" && (
                      <tr className="border-b border-slate-800/70 bg-rose-500/[0.04]">
                        <td colSpan={7} className="px-8 py-2 text-xs">
                          <span className="text-rose-300">└ 반려 사유: {(d.approvalLine.find((s) => s.status === "REJECTED") || {}).comment || d.resultNote}</span>
                          <span className="text-slate-500 ml-2">(데이터 변경 없음 — BS0006)</span>
                          {tab === "MINE" && (
                            <button onClick={(e) => { e.stopPropagation(); navigate("draft", { orderId: d.orderId, type: d.type }); }}
                              className="ml-3 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-purple-300 hover:text-purple-200">재기안 →</button>
                          )}
                        </td>
                      </tr>
                    )}
                    {tab === "MINE" && d.status === "IN_PROGRESS" && isDelayed && (
                      <tr className="border-b border-slate-800/70">
                        <td colSpan={7} className="px-8 py-2 text-xs text-slate-400">
                          └ 대기 D+{Math.floor(hoursSince(waitStartOf(d)) / 24)} 지연
                          <button disabled={remindedIds.includes(d.id)} onClick={(e) => { e.stopPropagation(); remind(d); }}
                            className="ml-3 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 disabled:opacity-40">알림 다시 보내기</button>
                          <span className="text-slate-600 ml-2">(하루 1회)</span>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 text-[11px] text-slate-500">
          <span>조회 기준 <span className="font-mono text-slate-400">{polledAt}</span> (30초 폴링 · BS0011)</span>
          <span className="flex items-center gap-2">
            <button className="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800">◀ 이전</button>
            <span className="font-mono">1 / 1</span>
            <button className="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800">다음 ▶</button>
          </span>
        </div>
      </Card>

      {/* 행 훑기 사이드 패널 (IDEA-06) — J/K로 내용 교체 */}
      <SidePanel open={panelOpen && !!sel} onClose={() => setPanelOpen(false)}
        title={sel ? sel.id : ""} subtitle={sel ? `${(window.ENUM_META[sel.type] || {}).label} · 기안 ${sel.requester} · ${sel.createdAt}` : ""}
        footer={sel && (
          <div className="flex items-center gap-2">
            {canAct && (<>
              <button onClick={() => setDialog({ kind: "approve", doc: sel })}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600">승인 (A)</button>
              <button onClick={() => setDialog({ kind: "reject", doc: sel })}
                className="flex-1 py-2 rounded-lg text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20">반려 (R)</button>
            </>)}
            <button onClick={() => navigate("approvalDetail", { approvalId: sel.id })}
              className="flex-1 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">전체 상세 →</button>
          </div>)}>
        {sel && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <EnumPill status={sel.status} size="md" />
              <Money value={sel.amount} size="lg" negative={sel.type.includes("REFUND")} />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed rounded-lg bg-slate-950/60 border border-slate-800 p-3">{sel.opinion}</p>
            <div>
              <SectionLabel color="amber">반영 예상 · PREVIEW</SectionLabel>
              <div className="mt-2 space-y-1.5 rounded-lg border border-dashed border-amber-500/30 p-3">
                {sel.expectedDiff.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-slate-500 shrink-0 max-w-[45%]">{r.label}</span>
                    {r.type === "money" ? (
                      <span className="font-mono tabular-nums text-right">₩{fmt(r.before)} → <b>₩{fmt(r.after)}</b>{" "}
                        <span className={r.delta < 0 ? "text-rose-300" : "text-emerald-300"}>({r.delta < 0 ? "−" : "+"}₩{fmt(Math.abs(r.delta))})</span></span>
                    ) : r.type === "status" ? (
                      <span className="flex items-center gap-1"><EnumPill status={r.before} /><Icon name="arrowRight" className="w-3 h-3 text-slate-500" /><EnumPill status={r.after} /></span>
                    ) : (<span className="text-slate-400 text-right">{r.note}</span>)}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel color="purple">승인선 {policyMode === "BROADCAST" ? "(병렬 합의)" : "(순차)"}</SectionLabel>
              <div className="mt-2 space-y-1.5">
                {sel.approvalLine.map((s) => {
                  const isTurn = myTurnStep(sel, policyMode) === s || (sel.status === "IN_PROGRESS" && s.status === "PENDING" && policyMode === "PRIORITY" && sel.approvalLine.find((x) => x.status === "PENDING") === s);
                  return (
                    <div key={s.step} className={`flex items-center gap-2.5 p-2 rounded-lg border ${isTurn ? "bg-amber-500/10 border-amber-500/30" : "bg-slate-950/50 border-slate-800"}`}>
                      <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${s.status === "APPROVED" ? "bg-emerald-500/30 text-emerald-200" : s.status === "REJECTED" ? "bg-rose-500/30 text-rose-200" : isTurn ? "bg-gradient-to-br from-purple-600 to-pink-600 text-white" : "bg-slate-800 text-slate-500"}`}>
                        {s.status === "APPROVED" ? <Icon name="check" className="w-3 h-3" /> : s.step}
                      </span>
                      <span className="text-xs flex-1">{s.approver} <span className="text-slate-500">· {(window.ENUM_META[s.role] || {}).label}</span></span>
                      {isTurn && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
                      <EnumPill status={s.status} />
                    </div>
                  );
                })}
              </div>
            </div>
            {sel.orderId && (
              <button onClick={() => navigate("orders", { orderId: sel.orderId })} className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1">
                <Icon name="external" className="w-3 h-3" />원본 주문 {sel.orderId} (O)
              </button>
            )}
            <p className="text-[10px] text-slate-600">J/K 이동 · A 승인 · R 반려 · O 원본 주문 · Esc 닫기 (IDEA-09)</p>
          </div>
        )}
      </SidePanel>

      {/* 승인 다이얼로그 — 위험도 3단 마찰 (§4.6) */}
      <ConfirmDialog open={!!dialog && dialog.kind === "approve"} risk={dialog ? dialog.doc.risk : "low"}
        title={dialog ? `${dialog.doc.id} 승인` : ""} confirmLabel="승인" confirmValue={dialog ? dialog.doc.amount : null}
        message="승인 시 다음 반영이 예약됩니다 — 최종 단계 승인이면 7연쇄가 즉시 실행됩니다."
        summary={dialog && (
          <div className="space-y-1">
            {dialog.doc.expectedDiff.filter((r) => r.type === "money").map((r, i) => (
              <div key={i} className="flex justify-between font-mono tabular-nums text-xs">
                <span className="text-slate-500">{r.label}</span>
                <span>₩{fmt(r.before)} → ₩{fmt(r.after)}</span>
              </div>
            ))}
          </div>)}
        onConfirm={() => applyDecision(dialog.doc, "APPROVED")} onClose={() => setDialog(null)} />

      {/* 반려 다이얼로그 — 사유 필수 (BS0006) */}
      <ConfirmDialog open={!!dialog && dialog.kind === "reject"} risk="mid" danger
        title={dialog ? `${dialog.doc.id} 반려` : ""} confirmLabel="반려"
        message="반려하면 이 문서는 종결되며 데이터는 변경되지 않습니다 (BS0006)."
        summary={<div className="text-xs text-slate-400">반려 시 7연쇄 반영은 어느 것도 실행되지 않습니다</div>}
        onConfirm={() => {
          if (!rejectReason.trim()) { toast("반려 사유를 입력해 주세요 — 사유 필수 (BS0006)", { tone: "error" }); return; }
          applyDecision(dialog.doc, "REJECTED", rejectReason.trim());
        }}
        onClose={() => { setDialog(null); setRejectReason(""); }}>
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1.5">반려 사유 *</label>
          <textarea autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}
            placeholder="예: 환불 산정 근거 부족 — 계약서 첨부 요망"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-rose-400 outline-none resize-none" />
        </div>
      </ConfirmDialog>
    </div>
  );
}
window.Inbox = Inbox;
