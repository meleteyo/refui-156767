// orders.jsx — 02 주문 관리
// 요약 스탯 · 상태/플랫폼/검색 필터 · 주문 목록(캠페인 그룹 보기) · 엑셀 업로드 3단계 모달 · 사이드패널
// 사이드패널의 매출 이벤트 타임라인 → "환불 기안 작성"이 navigate('console', { orderId })로 크로스링크
// 데이터: window.ORDERS / SALES_EVENTS / FREELANCERS / DEPARTMENTS / PLATFORM_META (data.js 무변경)
const { useState: useState_o, useEffect: useEffect_o, useMemo: useMemo_o } = React;

// 상태 필터 칩 순서 — 라벨은 STATUS_META(대시보드) 재사용, 저장/비교는 대문자 ENUM
const ORDER_STATUS_FILTERS = ["ALL", "RECEIVED", "ASSIGNED", "IN_PROGRESS", "DONE", "REFUND_REQUESTED", "PARTIALLY_REFUNDED", "CANCELLED"];

function Orders({ route, navigate, tweaks }) {
  const TODAY = "2026-07-10";

  const [q, setQ] = useState_o("");
  const [statusFilter, setStatusFilter] = useState_o("ALL");
  const [platformFilter, setPlatformFilter] = useState_o("ALL");
  const [grouped, setGrouped] = useState_o(false);       // 캠페인(고객사) 그룹 보기
  const [detailId, setDetailId] = useState_o(null);      // 사이드패널 대상 주문 id

  // 엑셀 업로드 모달 — 단계 전환은 로컬 상태 (검증 전 등록 비활성 · 모델12 합의)
  const [modalOpen, setModalOpen] = useState_o(false);
  const [uploadStep, setUploadStep] = useState_o(1);     // 1 파일선택 · 2 검증결과 · 3 등록완료
  const [fileName, setFileName] = useState_o(null);
  const [impPlatform, setImpPlatform] = useState_o("SMARTSTORE");
  const [impDept, setImpDept] = useState_o("DEPT-1");

  // Esc → 패널/모달 닫기
  useEffect_o(() => {
    const onKey = (e) => { if (e.key === "Escape") { setDetailId(null); setModalOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 매출 이벤트 타입 메타 — amount 부호는 data.js에 이미 반영, 색만 매핑
  const SE_META = {
    ORDER:          { label: "결제",     tone: "emerald" },
    REPAYMENT:      { label: "재결제",   tone: "emerald" },
    PARTIAL_REFUND: { label: "부분환불", tone: "rose" },
    FULL_REFUND:    { label: "전체환불", tone: "rose" },
    FEE:            { label: "수수료",   tone: "amber" },
  };
  const TONE_TEXT = { emerald: "text-emerald-300", rose: "text-rose-300", amber: "text-amber-300" };
  const TONE_DOT  = { emerald: "bg-emerald-400", rose: "bg-rose-400", amber: "bg-amber-400" };

  const freelancerOf = (id) => window.FREELANCERS.find(f => f.id === id) || null;
  const salesOf = (orderId) =>
    window.SALES_EVENTS.filter(e => e.orderId === orderId).slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  // 이번 주(월요일 기준) 신규 주문
  const weekStart = useMemo_o(() => {
    const d = new Date(TODAY + "T00:00:00");
    const dow = (d.getDay() + 6) % 7;   // 월=0
    d.setDate(d.getDate() - dow);
    return d;
  }, []);
  const isThisWeek = (dateStr) => new Date(dateStr + "T00:00:00") >= weekStart;
  const isOverdue = (o) => o.dueDate < TODAY && o.status !== "DONE" && o.status !== "CANCELLED";

  const stats = useMemo_o(() => {
    const os = window.ORDERS;
    return {
      total: os.length,
      totalAmount: os.reduce((s, o) => s + o.amount, 0),
      inProgress: os.filter(o => o.status === "IN_PROGRESS").length,
      refundReq: os.filter(o => o.status === "REFUND_REQUESTED").length,
      newWeek: os.filter(o => isThisWeek(o.orderedAt)).length,
    };
  }, []);

  const filtered = window.ORDERS.filter(o => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (platformFilter !== "ALL" && o.platform !== platformFilter) return false;
    if (q && !o.clientName.includes(q) && !o.item.includes(q) && !o.id.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // 캠페인(고객사) 단위 그룹 — 신규 데이터 없이 clientName으로 파생
  const groups = useMemo_o(() => {
    const m = new Map();
    filtered.forEach(o => {
      if (!m.has(o.clientName)) m.set(o.clientName, []);
      m.get(o.clientName).push(o);
    });
    return Array.from(m.entries()).map(([client, orders]) => ({
      client, orders, amount: orders.reduce((s, o) => s + o.amount, 0),
    }));
  }, [filtered]);

  const detail = detailId ? window.ORDERS.find(o => o.id === detailId) : null;

  const openUpload = () => { setModalOpen(true); setUploadStep(1); setFileName(null); };

  // 행 렌더 — 목록/그룹 공용
  const OrderRow = ({ o }) => {
    const f = freelancerOf(o.assigneeId);
    return (
      <tr onClick={() => setDetailId(o.id)}
        className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition ${detailId === o.id ? 'bg-purple-500/10' : ''}`}>
        <td className="px-6 py-3 font-mono text-xs text-slate-400">{o.id}</td>
        <td className="px-3 py-3"><window.PlatformBadge platform={o.platform} /></td>
        <td className="px-3 py-3">
          <div className="font-medium text-xs">{o.item}</div>
          <div className="text-[11px] text-slate-500">{o.clientName}</div>
        </td>
        <td className="px-3 py-3 text-right tabular-nums">₩{window.fmt(o.amount)}</td>
        <td className="px-3 py-3"><window.EnumPill status={o.status} /></td>
        <td className="px-3 py-3 text-xs">
          {f ? <span className="text-slate-300">{f.name}</span> : <span className="text-slate-600">미배정</span>}
        </td>
        <td className="px-6 py-3 text-xs tabular-nums">
          <span className={isOverdue(o) ? "text-rose-300" : "text-slate-400"}>{o.dueDate}</span>
          {isOverdue(o) && <span className="ml-1.5 text-[10px] text-rose-400">지연</span>}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="cyan">ORDERS · 주문 관리</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">주문 관리</h1>
          <p className="text-sm text-slate-300 mt-1">스마트스토어 · 쿠팡 · 이메일 · 수기 주문 통합 수집 — 행 클릭 시 매출 타임라인과 환불 기안으로 연결됩니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center gap-2">
            <window.Icon name="download" className="w-3.5 h-3.5" />주문 내보내기
          </button>
          <button onClick={openUpload} className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/30">
            <window.Icon name="file" className="w-3.5 h-3.5" />엑셀 업로드
          </button>
        </div>
      </div>

      {/* 요약 스탯 4타일 */}
      <div className="grid grid-cols-12 gap-4">
        <window.Card className="col-span-6 lg:col-span-3 p-5">
          <div className="text-xs text-slate-400 mb-1">총 주문</div>
          <div className="text-2xl font-bold tabular-nums">{stats.total}<span className="text-base ml-0.5 text-slate-500">건</span></div>
          <div className="mt-1 text-[11px] text-slate-500">주문액 합계 ₩{window.fmt(stats.totalAmount)}</div>
        </window.Card>
        <window.Card className="col-span-6 lg:col-span-3 p-5">
          <div className="text-xs text-slate-400 mb-1">진행중</div>
          <div className="text-2xl font-bold tabular-nums text-amber-300">{stats.inProgress}<span className="text-base ml-0.5 text-slate-500">건</span></div>
          <div className="mt-1 text-[11px] text-slate-500">작업 배정·수행 단계</div>
        </window.Card>
        <window.Card className="col-span-6 lg:col-span-3 p-5 !bg-rose-950 !border-rose-700">
          <div className="text-xs font-medium text-rose-200 mb-1">환불 요청</div>
          <div className="text-2xl font-bold tabular-nums text-rose-50">{stats.refundReq}<span className="text-base ml-0.5 text-rose-200/70">건</span></div>
          <div className="mt-1 text-[11px] text-rose-200/70">환불 결재 콘솔에서 기안 처리</div>
        </window.Card>
        <window.Card className="col-span-6 lg:col-span-3 p-5">
          <div className="text-xs text-slate-400 mb-1">이번주 신규</div>
          <div className="text-2xl font-bold tabular-nums text-cyan-300">{stats.newWeek}<span className="text-base ml-0.5 text-slate-500">건</span></div>
          <div className="mt-1 text-[11px] text-slate-500">07-06 이후 접수 · 수집 자동화 반영</div>
        </window.Card>
      </div>

      {/* 목록 카드 */}
      <window.Card className="overflow-hidden">
        {/* 필터 바 */}
        <div className="px-6 py-3.5 border-b border-white/10 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <window.Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="고객사·주문명·주문번호 검색" className="w-full pl-9 pr-3 py-1.5 rounded-md bg-slate-950/60 border border-white/10 text-sm focus:border-purple-500 outline-none" />
          </div>
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="px-2.5 py-1.5 rounded-md bg-slate-950/60 border border-white/10 text-xs text-slate-300 outline-none focus:border-purple-500">
            <option value="ALL">플랫폼 전체</option>
            {Object.entries(window.PLATFORM_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-white/5 border border-white/10">
            <button onClick={() => setGrouped(false)} className={`px-2.5 py-1 rounded ${!grouped ? 'bg-purple-500/30 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>목록</button>
            <button onClick={() => setGrouped(true)} className={`px-2.5 py-1 rounded ${grouped ? 'bg-purple-500/30 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>캠페인 그룹</button>
          </div>
        </div>
        {/* 상태 칩 */}
        <div className="px-6 py-3 border-b border-white/10 flex flex-wrap items-center gap-1.5">
          {ORDER_STATUS_FILTERS.map(s => {
            const on = statusFilter === s;
            const label = s === "ALL" ? "전체" : (window.STATUS_META[s]?.label || s);
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${on ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40' : 'bg-white/[0.03] text-slate-400 border border-white/10 hover:text-slate-200'}`}>
                {label}
              </button>
            );
          })}
          <span className="text-xs text-slate-500 ml-auto">{filtered.length}건 표시</span>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-6 py-2.5 font-medium">주문번호</th>
                <th className="px-3 py-2.5 font-medium">플랫폼</th>
                <th className="px-3 py-2.5 font-medium">고객사 · 주문명</th>
                <th className="px-3 py-2.5 font-medium text-right">주문 금액</th>
                <th className="px-3 py-2.5 font-medium">상태</th>
                <th className="px-3 py-2.5 font-medium">담당 프리랜서</th>
                <th className="px-6 py-2.5 font-medium">납기</th>
              </tr>
            </thead>
            <tbody>
              {!grouped && filtered.map(o => <OrderRow key={o.id} o={o} />)}
              {grouped && groups.map(g => (
                <React.Fragment key={g.client}>
                  <tr className="bg-white/[0.04] border-b border-white/10">
                    <td colSpan={7} className="px-6 py-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px] font-medium">캠페인 · {g.client}</span>
                        <span className="text-[11px] text-slate-500">{g.orders.length}건 · ₩{window.fmt(g.amount)}</span>
                      </div>
                    </td>
                  </tr>
                  {g.orders.map(o => <OrderRow key={o.id} o={o} />)}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">조건에 맞는 주문이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
          <window.Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
          주문 금액은 불변 — 환불은 사이드패널의 매출 이벤트(−)로 기록되며 원 금액을 덮어쓰지 않습니다 (ADR-002)
        </div>
      </window.Card>

      {/* ── 엑셀 업로드 모달 (3단계) ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div onClick={() => setModalOpen(false)} className="absolute inset-0 bg-slate-950/75"></div>
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-purple-500/10 overflow-hidden">
            {/* 헤더 + 스텝 */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <window.Icon name="file" className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold">주문 엑셀 업로드</h3>
                  <div className="text-[11px] text-slate-500">검증 → 오류 확인 → 등록 (검증 성공 후에만 등록 가능)</div>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-md hover:bg-white/10"><window.Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
              {[[1, "파일 선택"], [2, "검증 결과"], [3, "등록 완료"]].map(([n, l], i, arr) => {
                const active = uploadStep === n, done = uploadStep > n;
                return (
                  <React.Fragment key={n}>
                    <div className={`flex items-center gap-2 ${active ? 'text-purple-200' : done ? 'text-emerald-300' : 'text-slate-500'}`}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${active ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' : done ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5'}`}>
                        {done ? <window.Icon name="check" className="w-3.5 h-3.5" /> : n}
                      </div>
                      <span className="text-xs font-medium">{l}</span>
                    </div>
                    {i < arr.length - 1 && <div className={`flex-1 h-px ${uploadStep > n ? 'bg-emerald-500/40' : 'bg-white/10'}`}></div>}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step 1 · 파일 선택 */}
            {uploadStep === 1 && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-slate-500">플랫폼 <span className="text-rose-400">*</span></label>
                    <select value={impPlatform} onChange={e => setImpPlatform(e.target.value)} className="w-full mt-1.5 px-3 py-2 rounded-md bg-slate-950/60 border border-white/10 text-sm outline-none focus:border-purple-500">
                      {Object.entries(window.PLATFORM_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-slate-500">귀속 부서 <span className="text-rose-400">*</span></label>
                    <select value={impDept} onChange={e => setImpDept(e.target.value)} className="w-full mt-1.5 px-3 py-2 rounded-md bg-slate-950/60 border border-white/10 text-sm outline-none focus:border-purple-500">
                      {window.DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider text-slate-500">파일 <span className="text-rose-400">*</span></label>
                    <button className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"><window.Icon name="download" className="w-3 h-3" />표준 양식 다운로드</button>
                  </div>
                  <button onClick={() => setFileName("orders_202607.xlsx")}
                    className={`w-full mt-1.5 rounded-lg border-2 border-dashed transition p-8 flex flex-col items-center justify-center gap-2 ${fileName ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-white/15 bg-slate-950/40 hover:border-purple-500/40 hover:bg-purple-500/[0.04]'}`}>
                    {fileName ? (
                      <>
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center"><window.Icon name="file" className="w-5 h-5 text-emerald-300" /></div>
                        <div className="text-sm font-medium text-emerald-200">{fileName}</div>
                        <div className="text-[11px] text-slate-500">45행 감지 · 다시 클릭하면 재선택</div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center"><window.Icon name="download" className="w-5 h-5 text-slate-400" /></div>
                        <div className="text-sm text-slate-300">여기로 엑셀 파일을 끌어놓거나 클릭해 선택</div>
                        <div className="text-[11px] text-slate-500">xlsx · 최대 10MB</div>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setModalOpen(false)} className="text-sm px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10">취소</button>
                  <button disabled={!fileName} onClick={() => setUploadStep(2)}
                    className="text-sm px-5 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed">
                    <window.Icon name="check" className="w-3.5 h-3.5" />검증
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 · 검증 결과 — 45행 중 43 통과 · 2 오류 (IMP-004 정합) */}
            {uploadStep === 2 && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-center">
                    <div className="text-[11px] text-slate-500">전체 행</div>
                    <div className="text-2xl font-bold tabular-nums mt-0.5">45</div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <div className="text-[11px] text-emerald-300">정상</div>
                    <div className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-200">43</div>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-center">
                    <div className="text-[11px] text-rose-300">오류</div>
                    <div className="text-2xl font-bold tabular-nums mt-0.5 text-rose-200">2</div>
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-white/[0.03] border-b border-white/10">
                        <th className="px-4 py-2 font-medium">행</th>
                        <th className="px-3 py-2 font-medium">플랫폼 주문번호</th>
                        <th className="px-3 py-2 font-medium">주문명</th>
                        <th className="px-3 py-2 font-medium text-right">금액</th>
                        <th className="px-4 py-2 font-medium">오류 사유</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {[
                        { row: 14, no: "SS-20260710-0142", name: "신제품 리뷰 체험단 12건", amount: "1,320,000", reason: "중복 주문 (BS0004)" },
                        { row: 27, no: "SS-20260710-0155", name: "브랜드 SNS 릴스 6편", amount: "1.2백만", reason: "금액 형식 오류 (숫자 아님)" },
                      ].map(e => (
                        <tr key={e.row} className="bg-rose-500/[0.06] border-b border-rose-500/20 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-rose-300">{e.row}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-400">{e.no}</td>
                          <td className="px-3 py-2.5 text-slate-300">{e.name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-rose-300">{e.amount}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-rose-300"><window.Icon name="alert" className="w-3.5 h-3.5" />{e.reason}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <window.Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
                  등록 중 예외 발생 시 전체 롤백 — 오류 2행을 제외한 43건만 원자적으로 등록됩니다 (BS0004)
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setUploadStep(1)} className="text-sm px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1.5"><window.Icon name="chevronLeft" className="w-3.5 h-3.5" />이전</button>
                    <button className="text-sm px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-1.5"><window.Icon name="download" className="w-3.5 h-3.5" />오류 행 다운로드</button>
                  </div>
                  <button onClick={() => setUploadStep(3)} className="text-sm px-5 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold flex items-center gap-1.5 shadow-lg shadow-purple-500/20">
                    43건 등록 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 · 등록 완료 */}
            {uploadStep === 3 && (
              <div className="p-6 space-y-4">
                <div className="p-5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/25 flex items-center justify-center flex-shrink-0">
                    <window.Icon name="check" className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <div className="font-bold text-emerald-200">등록 완료 — 43건 신규 주문</div>
                    <div className="text-xs text-slate-400 mt-1">{window.PLATFORM_META[impPlatform].label} · {window.DEPARTMENTS.find(d => d.id === impDept)?.name} 귀속 · 오류 2행 제외</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10"><div className="text-[11px] text-slate-500">등록</div><div className="text-lg font-bold tabular-nums text-emerald-300 mt-0.5">43건</div></div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10"><div className="text-[11px] text-slate-500">제외(오류)</div><div className="text-lg font-bold tabular-nums text-rose-300 mt-0.5">2건</div></div>
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10"><div className="text-[11px] text-slate-500">원본 보관</div><div className="text-lg font-bold text-slate-200 mt-0.5">{fileName}</div></div>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <window.Icon name="db" className="w-3 h-3 text-emerald-400" />
                  스마트스토어 API 실패 시에도 이 엑셀 경로로 수집이 이어집니다 — 수집 이력에서 대체 계보를 추적할 수 있습니다 (IMP-003 → IMP-004)
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => { setModalOpen(false); }} className="text-sm px-4 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10">닫기</button>
                  <button onClick={() => { setModalOpen(false); navigate('history'); }} className="text-sm px-5 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold flex items-center gap-1.5">
                    수집 이력 보기 <window.Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 사이드패널 · 주문 상세 + 매출 이벤트 타임라인 + 환불 기안 크로스링크 ── */}
      {detail && (() => {
        const f = freelancerOf(detail.assigneeId);
        const events = salesOf(detail.id);
        const netSales = events.reduce((s, e) => s + e.amount, 0);
        const netStatic = detail.amount - detail.fee - detail.refundedAmount;
        const canRefund = detail.status !== "CANCELLED";
        return (
          <div className="fixed inset-0 z-30 flex">
            <div onClick={() => setDetailId(null)} className="flex-1 bg-slate-950/70"></div>
            <div className="w-full max-w-lg bg-slate-950 border-l border-slate-700/60 shadow-2xl shadow-purple-500/10 overflow-y-auto">
              <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-950 z-10">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">{detail.id}</div>
                  <h3 className="font-bold text-lg mt-0.5">주문 상세</h3>
                </div>
                <button onClick={() => setDetailId(null)} className="p-1.5 rounded-md hover:bg-white/10"><window.Icon name="x" className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <window.PlatformBadge platform={detail.platform} />
                  <window.EnumPill status={detail.status} />
                  {isOverdue(detail) && <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">납기 지연</span>}
                </div>

                <div>
                  <div className="text-sm font-semibold">{detail.item}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{detail.clientName}</div>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">주문 금액 (불변)</span><span className="tabular-nums font-semibold">₩{window.fmt(detail.amount)}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">플랫폼 수수료</span><span className="tabular-nums text-slate-400">{detail.fee > 0 ? `−₩${window.fmt(detail.fee)}` : "—"}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">기환불 누계</span><span className="tabular-nums text-slate-400">{detail.refundedAmount > 0 ? <span className="text-rose-300">−₩{window.fmt(detail.refundedAmount)}</span> : "—"}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">현재 순매출</span><span className="tabular-nums font-bold text-slate-50">₩{window.fmt(netStatic)}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">담당 프리랜서</span><span className="text-xs">{f ? `${f.name} · ${f.specialty}` : "미배정"}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-white/5"><span className="text-slate-500">작업 진행</span><span className="text-xs tabular-nums">{detail.doneTaskCount}/{detail.taskCount} 완료</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-500">접수일 · 납기</span><span className="text-xs tabular-nums">{detail.orderedAt} · {detail.dueDate}</span></div>
                </div>

                {/* 매출 이벤트 타임라인 */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs uppercase tracking-wider text-slate-400">매출 이벤트 타임라인</h4>
                    {events.length > 0 && (
                      <span className="text-[11px] text-slate-500">순매출 합계 <span className="tabular-nums font-semibold text-slate-200">₩{window.fmt(netSales)}</span></span>
                    )}
                  </div>
                  {events.length > 0 ? (
                    <div className="space-y-1.5">
                      {events.map(e => {
                        const m = SE_META[e.type] || SE_META.ORDER;
                        return (
                          <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/10">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TONE_DOT[m.tone]}`}></span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{m.label} {e.approvalId && <span className="text-[10px] font-mono text-slate-500 ml-1">{e.approvalId}</span>}</div>
                              <div className="text-[10px] text-slate-500 tabular-nums">{e.occurredAt}</div>
                            </div>
                            <div className={`text-sm font-semibold tabular-nums ${TONE_TEXT[m.tone]}`}>
                              {e.amount > 0 ? "+" : "−"}₩{window.fmt(Math.abs(e.amount))}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-700/60 mt-1">
                        <span className="text-xs font-medium text-slate-300">순매출 (부호 합산 · BS0001)</span>
                        <span className="text-base font-bold tabular-nums text-slate-50">₩{window.fmt(netSales)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-500 text-center">
                      아직 적재된 매출 이벤트가 없습니다 — 결제·환불 발생 시 이 원장에 부호로 기록됩니다
                    </div>
                  )}
                </div>

                {/* 환불 기안 크로스링크 */}
                <div className="pt-2 border-t border-white/10">
                  {canRefund ? (
                    <button onClick={() => navigate('console', { orderId: detail.id })}
                      className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30">
                      <window.Icon name="send" className="w-4 h-4" />환불 기안 작성
                    </button>
                  ) : (
                    <div className="w-full py-3 rounded-lg bg-white/5 border border-white/10 text-center text-xs text-slate-500">취소된 주문 — 환불 기안 불가 (재결제는 별도 기안)</div>
                  )}
                  <div className="mt-2 text-[10px] text-slate-500 text-center">환불 결재 콘솔로 이동해 이 주문을 대상으로 기안을 시작합니다</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

window.Orders = Orders;
