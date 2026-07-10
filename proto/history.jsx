// history.jsx — 03 이력: 결재 이력 탭 + 수집 이력 탭, 행 클릭 사이드패널(전 필드 + 감사 로그 + 재시도)
const { useState: useState_h, useEffect: useEffect_h } = React;

function History({ tweaks, navigate }) {
  const [tab, setTab] = useState_h("approvals");           // approvals | imports
  const [detail, setDetail] = useState_h(null);            // { kind, row }
  const [aStatus, setAStatus] = useState_h("ALL");
  const [aType, setAType] = useState_h("ALL");
  const [iStatus, setIStatus] = useState_h("ALL");
  const [iSource, setISource] = useState_h("ALL");
  const [q, setQ] = useState_h("");

  // Esc → 사이드패널 닫기
  useEffect_h(() => {
    const onKey = (e) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const orderOf = (id) => window.ORDERS.find(o => o.id === id);

  const approvals = window.APPROVALS.filter(a => {
    if (aStatus !== "ALL" && a.status !== aStatus) return false;
    if (aType !== "ALL" && a.type !== aType) return false;
    if (q && !a.id.includes(q) && !a.orderId.includes(q) && !a.requester.includes(q)) return false;
    return true;
  });

  const batches = window.IMPORT_BATCHES.filter(b => {
    if (iStatus !== "ALL" && b.status !== iStatus) return false;
    if (iSource !== "ALL" && b.source !== iSource) return false;
    if (q && !b.id.includes(q) && !(b.note || "").includes(q)) return false;
    return true;
  });

  const aStats = {
    total: window.APPROVALS.length,
    approved: window.APPROVALS.filter(a => a.status === "APPROVED").length,
    rejected: window.APPROVALS.filter(a => a.status === "REJECTED").length,
    failed: window.IMPORT_BATCHES.filter(b => b.status === "FAILED").length,
  };

  // 감사 로그 라인 합성 (mono) — 결재/수집 공용
  const auditLines = (kind, row) => {
    const lines = [];
    if (kind === "approval") {
      lines.push(`${row.createdAt} · ${row.status === "DRAFT" ? "DRAFT_SAVED" : "DRAFT_SUBMITTED"} · ${row.requester}`);
      row.approvalLine.forEach(s => {
        if (s.status === "APPROVED") lines.push(`${s.decidedAt || "—"} · STEP${s.step}_APPROVED · ${s.approver}`);
        if (s.status === "REJECTED") lines.push(`${s.decidedAt || "—"} · STEP${s.step}_REJECTED · ${s.approver}`);
      });
      if (row.status === "APPROVED") {
        lines.push(`${row.decidedAt} · CHAIN_EXECUTED(7) · system — TX committed`);
        lines.push(`${row.decidedAt} · NOTIFY_SENT · async-worker`);
      }
      if (row.status === "REJECTED") lines.push(`${row.decidedAt} · NO_DATA_CHANGE · system — 무변경 원칙(BS0006)`);
    } else {
      lines.push(`${row.collectedAt} · COLLECT_START · scheduler`);
      if (row.status === "FAILED") lines.push(`${row.collectedAt} · COLLECT_FAILED · ${row.note || ""}`);
      if (row.status === "SUCCESS") lines.push(`${row.collectedAt} · COMMITTED · ${row.totalRows - row.errorRows}/${row.totalRows} rows`);
      if (row.status === "REVIEW_PENDING") lines.push(`${row.collectedAt} · WAIT_REVIEW · ${row.errorRows} rows flagged`);
      if (row.fallbackOf) lines.push(`${row.collectedAt} · FALLBACK_OF · ${row.fallbackOf} (EXCEL_UPLOAD 대체 수집)`);
    }
    return lines;
  };

  const csvBtn = (
    <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center gap-2">
      <window.Icon name="download" className="w-3.5 h-3.5" />CSV 내보내기
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="emerald">HISTORY · 이력 조회</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">결재 · 수집 이력</h1>
          <p className="text-sm text-slate-300 mt-1">모든 변경은 감사 로그로 추적 — 반려된 결재는 데이터를 바꾸지 않습니다</p>
        </div>
        {csvBtn}
      </div>

      {/* 상단 통계 */}
      <div className="grid grid-cols-12 gap-4">
        <window.Card className="col-span-6 md:col-span-3 p-5">
          <div className="text-xs text-slate-400">금일 결재</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{aStats.total}</div>
          <div className="text-[11px] text-slate-500 mt-2">2026-07-10 기준</div>
        </window.Card>
        <window.Card className="col-span-6 md:col-span-3 p-5 !bg-emerald-950 !border-emerald-700">
          <div className="text-xs font-medium text-emerald-200">승인 · 7연쇄 반영</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-emerald-50">{aStats.approved}</div>
          <div className="text-[11px] text-emerald-200/80 mt-2">매출·정산·손익 자동 반영 완료</div>
        </window.Card>
        <window.Card className="col-span-6 md:col-span-3 p-5 !bg-rose-950 !border-rose-700">
          <div className="text-xs font-medium text-rose-200">반려 · 데이터 무변경</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-rose-50">{aStats.rejected}</div>
          <div className="text-[11px] text-rose-200/80 mt-2">감사 로그만 기록 — 재무 무변경</div>
        </window.Card>
        <window.Card className="col-span-6 md:col-span-3 p-5">
          <div className="text-xs text-slate-400">수집 실패 → 대체 완료</div>
          <div className="text-3xl font-bold tabular-nums mt-1 text-amber-300">{aStats.failed}</div>
          <div className="text-[11px] text-slate-500 mt-2">엑셀 업로드 fallback 경로 가동</div>
        </window.Card>
      </div>

      <window.Card className="overflow-hidden">
        {/* 탭 + 필터 */}
        <div className="px-6 pt-4 border-b border-white/10">
          <div className="flex items-center gap-1">
            {[["approvals", "결재 이력", "shieldCheck"], ["imports", "수집 이력", "db"]].map(([k, l, ic]) => (
              <button key={k} onClick={() => { setTab(k); setDetail(null); }}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 ${tab === k ? 'border-purple-500 text-purple-200' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <window.Icon name={ic} className="w-3.5 h-3.5" />{l}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 tabular-nums">{k === "approvals" ? window.APPROVALS.length : window.IMPORT_BATCHES.length}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-3.5 border-b border-white/10 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <window.Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={tab === "approvals" ? "결재번호·주문번호·기안자 검색" : "배치번호·오류 내용 검색"} className="w-full pl-9 pr-3 py-1.5 rounded-md bg-slate-950/60 border border-white/10 text-sm focus:border-purple-500 outline-none" />
          </div>
          {tab === "approvals" ? (
            <>
              <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-white/5 border border-white/10">
                {[["ALL", "전체"], ["DRAFT", "임시저장"], ["SUBMITTED", "상신"], ["APPROVED", "승인"], ["REJECTED", "반려"]].map(([k, l]) => (
                  <button key={k} onClick={() => setAStatus(k)} className={`px-2.5 py-1 rounded ${aStatus === k ? 'bg-purple-500/30 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
                ))}
              </div>
              <select value={aType} onChange={e => setAType(e.target.value)} className="px-2.5 py-1.5 rounded-md bg-slate-950/60 border border-white/10 text-xs text-slate-300 outline-none focus:border-purple-500">
                <option value="ALL">유형 전체</option>
                {Object.entries(window.APPROVAL_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-white/5 border border-white/10">
                {[["ALL", "전체"], ["SUCCESS", "성공"], ["FAILED", "실패"], ["REVIEW_PENDING", "검수 대기"]].map(([k, l]) => (
                  <button key={k} onClick={() => setIStatus(k)} className={`px-2.5 py-1 rounded ${iStatus === k ? 'bg-purple-500/30 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
                ))}
              </div>
              <select value={iSource} onChange={e => setISource(e.target.value)} className="px-2.5 py-1.5 rounded-md bg-slate-950/60 border border-white/10 text-xs text-slate-300 outline-none focus:border-purple-500">
                <option value="ALL">경로 전체</option>
                {Object.entries(window.SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </>
          )}
          <div className="text-xs text-slate-500 ml-auto">{tab === "approvals" ? approvals.length : batches.length}건 표시</div>
        </div>

        {/* ── 결재 이력 테이블 ── */}
        {tab === "approvals" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="px-6 py-2.5 font-medium">기안 시각</th>
                  <th className="px-3 py-2.5 font-medium">결재 번호</th>
                  <th className="px-3 py-2.5 font-medium">유형</th>
                  <th className="px-3 py-2.5 font-medium">대상 주문</th>
                  <th className="px-3 py-2.5 font-medium text-right">금액</th>
                  <th className="px-3 py-2.5 font-medium">승인선</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  <th className="px-6 py-2.5 font-medium text-right">액션</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map(a => {
                  const o = orderOf(a.orderId);
                  return (
                    <tr key={a.id} onClick={() => setDetail({ kind: "approval", row: a })} className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition ${detail?.row?.id === a.id ? 'bg-purple-500/10' : ''}`}>
                      <td className="px-6 py-3 text-slate-400 tabular-nums text-xs">{a.createdAt}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-400">{a.id}</td>
                      <td className="px-3 py-3 text-xs font-medium">{window.APPROVAL_TYPE_LABELS[a.type]}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs font-medium">{o?.item}</div>
                        <div className="text-[11px] text-slate-500">{o?.clientName} · <span className="font-mono">{a.orderId}</span></div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">₩{window.fmt(a.amount)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {a.approvalLine.map(s => (
                            <span key={s.step} title={`${s.approver} · ${window.ROLE_LABELS[s.role]}`}
                              className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${s.status === 'APPROVED' ? 'bg-emerald-500/30 text-emerald-200' : s.status === 'REJECTED' ? 'bg-rose-500/30 text-rose-200' : 'bg-white/5 text-slate-500'}`}>
                              {s.status === 'APPROVED' ? '✓' : s.status === 'REJECTED' ? '✕' : s.step}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3"><window.EnumPill status={a.status} /></td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={(e) => { e.stopPropagation(); setDetail({ kind: "approval", row: a }); }} className={`text-xs ${a.status === 'REJECTED' ? 'text-rose-300 hover:text-rose-200 font-medium' : 'text-slate-400 hover:text-purple-300'}`}>상세 →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 수집 이력 테이블 — fallback 쌍(IMP-003→IMP-004) 연속 2행 ── */}
        {tab === "imports" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="px-6 py-2.5 font-medium">수집 시각</th>
                  <th className="px-3 py-2.5 font-medium">배치 번호</th>
                  <th className="px-3 py-2.5 font-medium">수집 경로</th>
                  <th className="px-3 py-2.5 font-medium">플랫폼</th>
                  <th className="px-3 py-2.5 font-medium text-right">행 (성공/오류)</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  <th className="px-3 py-2.5 font-medium">비고</th>
                  <th className="px-6 py-2.5 font-medium text-right">액션</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} onClick={() => setDetail({ kind: "import", row: b })} className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition ${detail?.row?.id === b.id ? 'bg-purple-500/10' : ''}`}>
                    <td className="px-6 py-3 text-slate-400 tabular-nums text-xs">{b.collectedAt}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-400">{b.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {b.fallbackOf && <span className="text-[10px] text-amber-400 mr-0.5">대체→</span>}
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${b.source === 'SMARTSTORE_API' ? 'bg-cyan-500/15 text-cyan-300' : b.source === 'EXCEL_UPLOAD' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-purple-500/15 text-purple-300'}`}>
                          {window.SOURCE_LABELS[b.source]}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><window.PlatformBadge platform={b.platform} /></td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">
                      {b.totalRows > 0 ? <span>{b.totalRows}행 · <span className="text-emerald-400">{b.totalRows - b.errorRows}</span>/<span className={b.errorRows > 0 ? "text-rose-400" : "text-slate-500"}>{b.errorRows}</span></span> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-3 py-3"><window.EnumPill status={b.status} /></td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-[220px] truncate">{b.note || "—"}</td>
                    <td className="px-6 py-3 text-right">
                      {b.status === "FAILED"
                        ? <button onClick={(e) => { e.stopPropagation(); setDetail({ kind: "import", row: b }); }} className="text-xs text-rose-300 hover:text-rose-200 font-medium">재시도 →</button>
                        : <button onClick={(e) => { e.stopPropagation(); setDetail({ kind: "import", row: b }); }} className="text-xs text-slate-400 hover:text-purple-300">상세 →</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </window.Card>

      {/* ── 상세 사이드패널 ── */}
      {detail && (
        <div className="fixed inset-0 z-30 flex">
          <div onClick={() => setDetail(null)} className="flex-1 bg-slate-950/70"></div>
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-700/60 shadow-2xl shadow-purple-500/10 overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-950">
              <div>
                <div className="text-[11px] font-mono text-slate-500">{detail.row.id}</div>
                <h3 className="font-bold text-lg mt-0.5">{detail.kind === "approval" ? "결재 상세" : "수집 배치 상세"}</h3>
              </div>
              <button onClick={() => setDetail(null)} className="p-1.5 rounded-md hover:bg-white/10"><window.Icon name="x" className="w-4 h-4" /></button>
            </div>

            {detail.kind === "approval" ? (() => {
              const a = detail.row; const o = orderOf(a.orderId);
              return (
                <div className="p-5 space-y-4">
                  <div className={`p-3 rounded-lg border ${a.status === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/20' : a.status === 'REJECTED' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-2">
                      <window.EnumPill status={a.status} />
                      <span className="text-xs text-slate-400">{a.createdAt} 기안</span>
                    </div>
                    {a.resultNote && (
                      <div className={`mt-2 text-xs leading-relaxed ${a.status === 'REJECTED' ? 'text-rose-300' : 'text-emerald-300'}`}>{a.resultNote}</div>
                    )}
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">유형</span><span className="text-xs font-medium">{window.APPROVAL_TYPE_LABELS[a.type]} <span className="font-mono text-slate-500">{a.type}</span></span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">대상 주문</span><span className="font-mono text-xs">{a.orderId}</span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">주문명</span><span className="text-xs text-right max-w-[220px]">{o?.item}<br /><span className="text-slate-500">{o?.clientName}</span></span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">기안자</span><span className="text-xs">{a.requester}</span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">금액</span><span className="tabular-nums font-semibold">₩{window.fmt(a.amount)}</span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">기안 사유</span><span className="text-xs text-right max-w-[220px] text-slate-300">{a.opinion}</span></div>
                    <div className="flex justify-between py-1.5"><span className="text-slate-500">처리 완료</span><span className="text-xs tabular-nums">{a.decidedAt || "—"}</span></div>
                  </div>

                  <div className="pt-1">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">승인선</h4>
                    <div className="space-y-1.5">
                      {a.approvalLine.map(s => (
                        <div key={s.step} className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${s.status === 'APPROVED' ? 'bg-emerald-500/30 text-emerald-200' : s.status === 'REJECTED' ? 'bg-rose-500/30 text-rose-200' : 'bg-white/10 text-slate-400'}`}>{s.step}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">{s.approver} <span className="text-slate-500">· {window.ROLE_LABELS[s.role]}</span></div>
                            {s.comment && <div className="text-[11px] text-slate-500 truncate">"{s.comment}"</div>}
                          </div>
                          <window.EnumPill status={s.status} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {a.status === "REJECTED" && (
                    <div className="pt-1">
                      <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">재기안</h4>
                      <button onClick={() => navigate('console', { orderId: a.orderId })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-purple-500/10 hover:border-purple-500/30 text-left flex items-center gap-3 transition">
                        <window.Icon name="refresh" className="w-4 h-4 text-purple-300" />
                        <span className="text-xs text-slate-300 flex-1">증빙 보완 후 동일 내용으로 재기안</span>
                        <window.Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  )}

                  {(tweaks.showAuditLog !== false) && (
                    <div className="pt-2">
                      <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">감사 로그</h4>
                      <div className="space-y-1.5 text-[11px] font-mono text-slate-500">
                        {auditLines("approval", a).map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (() => {
              const b = detail.row;
              const fb = b.fallbackOf ? window.IMPORT_BATCHES.find(x => x.id === b.fallbackOf) : null;
              const fbChild = window.IMPORT_BATCHES.find(x => x.fallbackOf === b.id);
              return (
                <div className="p-5 space-y-4">
                  <div className={`p-3 rounded-lg border ${b.status === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500/20' : b.status === 'FAILED' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                    <div className="flex items-center gap-2">
                      <window.EnumPill status={b.status} />
                      <span className="text-xs text-slate-400">{b.collectedAt}</span>
                    </div>
                    {b.note && <div className={`mt-2 text-xs ${b.status === 'FAILED' ? 'text-rose-300' : 'text-slate-300'}`}>{b.note}</div>}
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">수집 경로</span><span className="text-xs font-medium">{window.SOURCE_LABELS[b.source]} <span className="font-mono text-slate-500">{b.source}</span></span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">플랫폼</span><window.PlatformBadge platform={b.platform} /></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">전체 행</span><span className="tabular-nums">{b.totalRows}행</span></div>
                    <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">성공 / 오류</span><span className="tabular-nums text-xs"><span className="text-emerald-300">{b.totalRows - b.errorRows}건 성공</span> · <span className={b.errorRows > 0 ? "text-rose-300" : "text-slate-500"}>{b.errorRows}건 오류</span></span></div>
                    <div className="flex justify-between py-1.5"><span className="text-slate-500">대체 원본</span><span className="font-mono text-xs">{b.fallbackOf || "—"}</span></div>
                  </div>

                  {fb && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
                      <window.Icon name="alert" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span><b className="font-mono">{fb.id}</b> {window.SOURCE_LABELS[fb.source]} 실패({fb.note}) → 이 배치가 <b>엑셀 업로드 대체 경로</b>로 수집을 완료했습니다. 업무 중단 없음.</span>
                    </div>
                  )}
                  {fbChild && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed flex items-start gap-2">
                      <window.Icon name="check" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>이 실패 배치는 <b className="font-mono">{fbChild.id}</b> 엑셀 업로드로 대체 수집되었습니다 ({fbChild.totalRows}행 중 {fbChild.totalRows - fbChild.errorRows}건 성공 / {fbChild.errorRows}건 오류).</span>
                    </div>
                  )}

                  {b.status === "FAILED" && (
                    <div className="pt-1">
                      <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">재시도</h4>
                      <div className="space-y-2">
                        <button className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-left flex items-center gap-3 transition">
                          <window.Icon name="refresh" className="w-4 h-4 text-cyan-300" />
                          <span className="text-xs text-slate-300 flex-1">API 재수집 시도 (세션 재발급 후)</span>
                          <window.Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-left flex items-center gap-3 transition">
                          <window.Icon name="file" className="w-4 h-4 text-emerald-300" />
                          <span className="text-xs text-slate-300 flex-1">엑셀 업로드로 대체 수집</span>
                          <window.Icon name="arrowRight" className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </div>
                    </div>
                  )}

                  {(tweaks.showAuditLog !== false) && (
                    <div className="pt-2">
                      <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">감사 로그</h4>
                      <div className="space-y-1.5 text-[11px] font-mono text-slate-500">
                        {auditLines("import", b).map((l, i) => <div key={i}>{l}</div>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

window.History = History;
