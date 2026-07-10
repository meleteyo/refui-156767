// dashboard.jsx — 01 대시보드 + 공용 도메인 UI (이 파일이 4화면 중 가장 먼저 로드됨)
const { useState: useState_d, useMemo: useMemo_d } = React;

// ── 도메인 ENUM → 한글 라벨 변환 (저장은 영문 ENUM, 표시만 한글) ────
// components.jsx StatusPill(4종)의 도메인 확장 — 동일 시각 언어(dot + pill)
const STATUS_META = {
  // 주문
  RECEIVED:           { label: "접수",       bg: "bg-slate-500/15",   text: "text-slate-300",   dot: "bg-slate-400" },
  ASSIGNED:           { label: "배정됨",     bg: "bg-cyan-500/15",    text: "text-cyan-300",    dot: "bg-cyan-400" },
  IN_PROGRESS:        { label: "진행중",     bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  DONE:               { label: "완료",       bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  REFUND_REQUESTED:   { label: "환불 요청",  bg: "bg-rose-500/15",    text: "text-rose-300",    dot: "bg-rose-400" },
  PARTIALLY_REFUNDED: { label: "부분환불",   bg: "bg-purple-500/15",  text: "text-purple-300",  dot: "bg-purple-400" },
  CANCELLED:          { label: "취소",       bg: "bg-slate-600/20",   text: "text-slate-400",   dot: "bg-slate-500" },
  // 결재 (표준 승인 ENUM)
  DRAFT:              { label: "임시저장",   bg: "bg-slate-500/15",   text: "text-slate-300",   dot: "bg-slate-400" },
  SUBMITTED:          { label: "상신",       bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  APPROVED:           { label: "승인",       bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  REJECTED:           { label: "반려",       bg: "bg-rose-500/15",    text: "text-rose-300",    dot: "bg-rose-400" },
  PENDING:            { label: "대기",       bg: "bg-slate-500/15",   text: "text-slate-300",   dot: "bg-slate-400" },
  // 수집 배치
  SUCCESS:            { label: "성공",       bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
  FAILED:             { label: "실패",       bg: "bg-rose-500/15",    text: "text-rose-300",    dot: "bg-rose-400" },
  REVIEW_PENDING:     { label: "검수 대기",  bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  // 정산
  OPEN:               { label: "정산 진행",  bg: "bg-cyan-500/15",    text: "text-cyan-300",    dot: "bg-cyan-400" },
  CONFIRMED:          { label: "확정",       bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
};

function EnumPill({ status }) {
  const c = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${c.bg} ${c.text} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}

const PLATFORM_META = {
  SMARTSTORE: { label: "스마트스토어", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", color: "#10b981" },
  COUPANG:    { label: "쿠팡",         bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/30",   color: "#f59e0b" },
  EMAIL:      { label: "이메일 접수",  bg: "bg-cyan-500/15",    text: "text-cyan-300",    border: "border-cyan-500/30",    color: "#06b6d4" },
  MANUAL:     { label: "수기 등록",    bg: "bg-slate-500/15",   text: "text-slate-300",   border: "border-slate-500/30",   color: "#94a3b8" },
};

function PlatformBadge({ platform }) {
  const c = PLATFORM_META[platform] || PLATFORM_META.MANUAL;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border ${c.bg} ${c.text} ${c.border} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }}></span>
      {c.label}
    </span>
  );
}

const APPROVAL_TYPE_LABELS = {
  ORDER_EDIT: "주문 수정", PARTIAL_REFUND: "부분환불", FULL_REFUND: "전체환불",
  REPAYMENT: "재결제", RATE_CHANGE: "단가 변경",
};

const ROLE_LABELS = { TEAM_LEAD: "팀장", FINANCE: "재무", CEO: "대표" };

// 승인선 역할 → 승인권자 해석 (조직도 기준 — 시연용 고정)
const APPROVERS = { TEAM_LEAD: "박준혁", FINANCE: "정다은", CEO: "김민석" };

const SOURCE_LABELS = {
  SMARTSTORE_API: "스마트스토어 API", EXCEL_UPLOAD: "엑셀 업로드", PLAYWRIGHT_CRAWL: "크롤링 수집",
};

// 후속 처리(7연쇄) 배지 메타 — 결재 양식·콘솔 Step4 공용
const EFFECT_META = {
  APPROVAL_STATUS:   { label: "결재 상태 변경", icon: "shieldCheck" },
  ORDER_STATUS:      { label: "주문 상태 전이", icon: "refresh" },
  ORDER_UPDATE:      { label: "주문 정보 수정", icon: "file" },
  SALES_RECALC:      { label: "매출 재계산",    icon: "chart" },
  SETTLEMENT_RECALC: { label: "정산 재계산",    icon: "db" },
  PROFIT_REFLECT:    { label: "손익 반영",      icon: "activity" },
  AUDIT_LOG:         { label: "감사 로그 기록", icon: "history" },
  NOTIFY:            { label: "알림 발송",      icon: "bell" },
};

Object.assign(window, { EnumPill, PlatformBadge, STATUS_META, PLATFORM_META, APPROVAL_TYPE_LABELS, ROLE_LABELS, APPROVERS, SOURCE_LABELS, EFFECT_META });

// ── 01 대시보드 ──────────────────────────────────────────────────────
function Dashboard({ tweaks, navigate }) {
  const k = window.KPIS;

  // 플랫폼 도넛 — 주문 금액 비중 (ORDERS 파생)
  const donutData = useMemo_d(() => {
    const byPlatform = {};
    window.ORDERS.forEach(o => { byPlatform[o.platform] = (byPlatform[o.platform] || 0) + o.amount; });
    return Object.entries(byPlatform).map(([p, v]) => ({ key: p, label: PLATFORM_META[p].label, value: v, color: PLATFORM_META[p].color }));
  }, []);
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const arcs = donutData.map(d => {
    const start = acc / donutTotal; acc += d.value;
    return { ...d, start, end: acc / donutTotal, pct: (d.value / donutTotal * 100).toFixed(0) };
  });
  const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arcPath = (cx, cy, rO, rI, s, e) => {
    const a0 = s * Math.PI * 2 - Math.PI / 2, a1 = e * Math.PI * 2 - Math.PI / 2;
    const large = e - s > 0.5 ? 1 : 0;
    const [x0, y0] = polar(cx, cy, rO, a0), [x1, y1] = polar(cx, cy, rO, a1);
    const [x2, y2] = polar(cx, cy, rI, a1), [x3, y3] = polar(cx, cy, rI, a0);
    return `M ${x0} ${y0} A ${rO} ${rO} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${rI} ${rI} 0 ${large} 0 ${x3} ${y3} Z`;
  };

  const trendMax = Math.max(...k.monthSales.trend);
  const pendingApprovals = window.APPROVALS.filter(a => a.status === "SUBMITTED" || a.status === "DRAFT");
  const refundCount = window.APPROVALS.filter(a => (a.type === "PARTIAL_REFUND" || a.type === "FULL_REFUND") && a.status === "APPROVED").length;
  const orderOf = (id) => window.ORDERS.find(o => o.id === id);
  const currentStepOf = (a) => {
    const cur = a.approvalLine.find(s => s.status === "PENDING");
    return cur ? `${cur.step}/${a.approvalLine.length} ${ROLE_LABELS[cur.role]} 대기` : "—";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="purple">DASHBOARD · 2026-07-10 (금)</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">경영 현황</h1>
          <p className="text-sm text-slate-300 mt-1">주문 · 작업 · 결재 · 정산 한눈에 — 환불 승인 시 7연쇄가 자동 반영됩니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center gap-2">
            <window.Icon name="refresh" className="w-3.5 h-3.5" />새로고침
          </button>
          <button onClick={() => navigate('console')} className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/30">
            <window.Icon name="send" className="w-3.5 h-3.5" />환불 결재 기안
          </button>
        </div>
      </div>

      {/* KPI 4타일 — 매출 / 손익(강조) / 납기 준수율 / 처리량 */}
      <div className="grid grid-cols-12 gap-4">
        <window.Card className="col-span-6 lg:col-span-3 p-5">
          <div className="text-xs text-slate-400 mb-1">7월 순매출 (환불 반영)</div>
          <div className="text-2xl font-bold tabular-nums">₩{window.fmt(k.monthSales.value)}</div>
          <div className="mt-1 text-[11px]">
            <span className="text-emerald-400">▲ {k.monthSales.deltaPct}%</span>
            <span className="text-slate-500 ml-1">전월 동기 대비</span>
          </div>
          <div className="mt-3"><window.Sparkline data={k.monthSales.trend} color="#a855f7" height={30} /></div>
        </window.Card>

        {/* 강조 KPI — 환불 반영으로 손익 하락 (솔리드 rose) */}
        <window.Card className="col-span-6 lg:col-span-3 p-5 !bg-rose-950 !border-rose-700">
          <div className="text-xs font-medium text-rose-200 mb-1">7월 손익</div>
          <div className="text-2xl font-bold tabular-nums text-rose-50">₩{window.fmt(k.profit.value)}</div>
          <div className="mt-1 text-[11px]">
            <span className="text-rose-200">▼ {Math.abs(k.profit.deltaPct)}%</span>
            <span className="text-rose-200/70 ml-1">환불 {refundCount}건 반영 · 정산 재계산 완료</span>
          </div>
          <div className="mt-3"><window.Sparkline data={k.profit.trend} color="#fda4af" height={30} /></div>
        </window.Card>

        <window.Card className="col-span-6 lg:col-span-3 p-5">
          <div className="text-xs text-slate-400 mb-1">납기 준수율</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-300">{k.onTimeRate.value}<span className="text-base ml-0.5 text-slate-500">%</span></div>
          <div className="mt-1 text-[11px]">
            <span className="text-emerald-400">▲ {k.onTimeRate.deltaPct}%p</span>
            <span className="text-slate-500 ml-1">프리랜서 5명 평균</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${k.onTimeRate.value}%` }}></div>
          </div>
        </window.Card>

        <window.Card className="col-span-6 lg:col-span-3 p-5">
          <div className="text-xs text-slate-400 mb-1">7월 처리 주문</div>
          <div className="text-2xl font-bold tabular-nums">{window.fmt(k.throughput.value)}<span className="text-base ml-0.5 text-slate-500">건</span></div>
          <div className="mt-1 text-[11px]">
            <span className="text-cyan-400">▲ {k.throughput.deltaPct}%</span>
            <span className="text-slate-500 ml-1">수집 자동화 반영</span>
          </div>
          <div className="mt-3"><window.Sparkline data={k.throughput.trend} color="#22d3ee" height={30} /></div>
        </window.Card>
      </div>

      {/* 7일 추이 + 플랫폼 도넛 */}
      <div className="grid grid-cols-12 gap-4">
        <window.Card className="col-span-12 lg:col-span-8 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-base">7일 매출 추이</h3>
              <div className="text-xs text-slate-500 mt-0.5">07-04 → 07-10 · 매출 이벤트 원장 합산 (환불 차감 반영)</div>
            </div>
            <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-white/5 border border-white/10">
              {["7D", "30D", "90D"].map((t, i) =>
                <button key={t} className={`px-2.5 py-1 rounded ${i === 0 ? 'bg-purple-500/30 text-purple-200' : 'text-slate-400 hover:text-slate-200'}`}>{t}</button>
              )}
            </div>
          </div>
          <div className="h-52 flex items-end gap-3">
            {k.monthSales.trend.map((v, i) => {
              const h = v / trendMax * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="text-[10px] text-slate-500 group-hover:text-purple-300 tabular-nums">₩{window.fmt(v)}</div>
                  <div className="w-full relative" style={{ height: '160px' }}>
                    <div className="absolute bottom-0 inset-x-0 rounded-t-md bg-gradient-to-t from-purple-500/60 via-purple-400/40 to-pink-400/30 group-hover:from-purple-500/80 group-hover:via-purple-400/60 transition-all" style={{ height: `${h}%` }}></div>
                  </div>
                  <div className="text-[11px] text-slate-400">{window.TREND_DAYS[i]}</div>
                </div>
              );
            })}
          </div>
        </window.Card>

        <window.Card className="col-span-12 lg:col-span-4 p-6">
          <h3 className="font-semibold text-base mb-1">플랫폼 매출 비중</h3>
          <div className="text-xs text-slate-500 mb-3">최근 주문 {window.ORDERS.length}건 · 총 ₩{window.fmt(donutTotal)}</div>
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0">
              {arcs.map((a, i) =>
                <path key={i} d={arcPath(50, 50, 45, 30, a.start, a.end)} fill={a.color} opacity="0.85" />
              )}
              <text x="50" y="48" textAnchor="middle" className="fill-slate-200 text-[9px] font-semibold">{window.ORDERS.length}건</text>
              <text x="50" y="58" textAnchor="middle" className="fill-slate-500 text-[6px]">주문</text>
            </svg>
            <div className="flex-1 space-y-2.5">
              {arcs.map((a, i) =>
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: a.color }}></span>
                  <span className="text-slate-300 flex-1">{a.label}</span>
                  <span className="text-slate-500 tabular-nums">₩{window.fmt(a.value)}</span>
                  <span className="text-slate-500 tabular-nums w-8 text-right">{a.pct}%</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <window.Icon name="db" className="w-3 h-3 text-emerald-400" />
            금일 수집: API 1건 실패 → 엑셀 업로드 대체 완료
          </div>
        </window.Card>
      </div>

      {/* 대기 결재 리스트 — 클릭 시 환불 결재 콘솔로 이동 */}
      <window.Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold">대기 결재 <span className="text-amber-300 font-bold ml-1">{pendingApprovals.length}</span></h3>
            <div className="text-xs text-slate-500 mt-0.5">상신·임시저장 문서 · 행 클릭 시 환불 결재 콘솔로 이동</div>
          </div>
          <button onClick={() => navigate('history')} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
            전체 이력 <window.Icon name="arrowRight" className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                <th className="px-6 py-2.5 font-medium">기안 시각</th>
                <th className="px-3 py-2.5 font-medium">결재 번호</th>
                <th className="px-3 py-2.5 font-medium">유형</th>
                <th className="px-3 py-2.5 font-medium">대상 주문</th>
                <th className="px-3 py-2.5 font-medium text-right">금액</th>
                <th className="px-3 py-2.5 font-medium">현재 단계</th>
                <th className="px-3 py-2.5 font-medium">상태</th>
                <th className="px-6 py-2.5 font-medium text-right">액션</th>
              </tr>
            </thead>
            <tbody>
              {pendingApprovals.map(a => {
                const o = orderOf(a.orderId);
                return (
                  <tr key={a.id} onClick={() => navigate('console', { orderId: a.orderId })} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition group">
                    <td className="px-6 py-3 text-slate-400 tabular-nums text-xs">{a.createdAt}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-400">{a.id}</td>
                    <td className="px-3 py-3 text-slate-200 text-xs font-medium">{APPROVAL_TYPE_LABELS[a.type]}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-xs">{o?.item}</div>
                      <div className="text-[11px] text-slate-500">{o?.clientName} · <span className="font-mono">{a.orderId}</span></div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">₩{window.fmt(a.amount)}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{a.status === "DRAFT" ? "기안 미완료" : currentStepOf(a)}</td>
                    <td className="px-3 py-3"><EnumPill status={a.status} /></td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-xs text-slate-400 group-hover:text-purple-300 transition inline-flex items-center gap-1">콘솔에서 처리 <window.Icon name="arrowRight" className="w-3 h-3" /></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
          <window.Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
          환불 결재가 최종 승인되면 결재 → 주문 → 매출 → 정산 → 손익 → 이력 → 알림 7단계가 단일 트랜잭션으로 처리됩니다
        </div>
      </window.Card>
    </div>
  );
}

window.Dashboard = Dashboard;
