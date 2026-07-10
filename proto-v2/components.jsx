// components.jsx — 프로토타입 v2 공통 컴포넌트 (설계기준 §4)
// 전부 window.* 로 노출한다. 다른 jsx에서 참조할 때도 반드시 window.* 사용.
// data.js 전역(ORDERS 등)은 일반 <script> 전역이므로 맨이름으로 읽을 수 있다.
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('ko-KR').format(n);
const pad = (n) => String(n).padStart(2, '0');
const maskPhone = (p) => (p ? String(p).replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, '$1-****-$3') : '');
const maskAccount = (a) => (a ? String(a).replace(/\d(?=\d{4})/g, '*') : '');
const BASE_DATE = typeof TODAY !== 'undefined' ? TODAY : '2026-07-10';
const ddayOf = (date, base = BASE_DATE) =>
  Math.round((new Date(date) - new Date(base)) / 86400000);

// ── 아이콘 (인라인 SVG — 외부 의존 없음) ─────────────────────────────────────
const Icon = ({ name, className = 'w-4 h-4' }) => {
  const paths = {
    home: <path d="M3 12L12 4l9 8M5 10v10h14V10" />,
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    template: <><path d="M4 4h16v6H4z" /><path d="M4 14h7v6H4z" /><path d="M14 14h6v6h-6z" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    x: <path d="M18 6L6 18M6 6l12 12" />,
    chevronRight: <path d="M9 18l6-6-6-6" />,
    chevronLeft: <path d="M15 18l-6-6 6-6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></>,
    refresh: <><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 8" /><path d="M21 3v5h-5" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
    alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></>,
    user2: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    play: <path d="M5 3v18l15-9z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    arrowRight: <><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></>,
    filter: <path d="M22 3H2l8 9.5V19l4 2v-8.5z" />,
    db: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></>,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 6 10-6" /></>,
    sparkles: <><path d="M12 3l1.9 5.8L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-2.2z" /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" /></>,
    shieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
    unlock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.9-.9" /></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></>,
    trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    layers: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
    creditCard: <><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></>,
    receipt: <><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
    zap: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    info: <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
    wallet: <><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></>,
    columns: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>,
    clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01M12 6h.01M12 10h.01M12 14h.01" /></>,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

// ── Card / SectionLabel / PageHeader ────────────────────────────────────────
const Card = ({ children, className = '', ...rest }) => (
  <div className={`rounded-xl bg-slate-900 border border-slate-700/60 ${className}`} {...rest}>
    {children}
  </div>
);

const SectionLabel = ({ children, color = 'purple' }) => {
  const map = {
    purple: 'text-purple-400', emerald: 'text-emerald-400', cyan: 'text-cyan-400',
    pink: 'text-pink-400', amber: 'text-amber-400', rose: 'text-rose-400', slate: 'text-slate-500',
  };
  return <div className={`text-[11px] font-mono uppercase tracking-wider ${map[color] || map.purple}`}>{children}</div>;
};

// 페이지 헤더 3단: SectionLabel(mono) → h1 → 설명 한 줄 + 우측 액션 (§3.1)
const PageHeader = ({ label, labelColor = 'purple', title, desc, actions }) => (
  <div className="flex items-start justify-between gap-4 mb-6">
    <div>
      <SectionLabel color={labelColor}>{label}</SectionLabel>
      <h1 className="text-2xl font-bold mt-1">{title}</h1>
      {desc && <p className="text-sm text-slate-400 mt-1">{desc}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0 pt-1">{actions}</div>}
  </div>
);

// ── EnumPill — 상태 칩 META (설계기준 §4.1, 색상 의미 고정) ──────────────────
// 배지 공식: bg-{c}-500/15 + text-{c}-300 + border-{c}-500/30 + 도트
const PILL_COLORS = {
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  rose:    { bg: 'bg-rose-500/15',    text: 'text-rose-300',    border: 'border-rose-500/30',    dot: 'bg-rose-400' },
  amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  cyan:    { bg: 'bg-cyan-500/15',    text: 'text-cyan-300',    border: 'border-cyan-500/30',    dot: 'bg-cyan-400' },
  purple:  { bg: 'bg-purple-500/15',  text: 'text-purple-300',  border: 'border-purple-500/30',  dot: 'bg-purple-400' },
  slate:   { bg: 'bg-slate-500/15',   text: 'text-slate-300',   border: 'border-slate-500/30',   dot: 'bg-slate-400' },
};

const ENUM_META = {
  // 주문 (BS0010)
  RECEIVED:           { label: '접수',      color: 'slate' },
  CONFIRMED:          { label: '확정',      color: 'emerald' }, // 정산 잠금 CONFIRMED는 LockBadge 병기 (§4.5)
  IN_PROGRESS:        { label: '진행중',    color: 'amber' },   // 결재 문서도 동일 라벨 계열 ('진행 중' 통일)
  DONE:               { label: '완료',      color: 'emerald' },
  PARTIALLY_REFUNDED: { label: '부분환불',  color: 'purple' },
  REFUNDED:           { label: '전체환불',  color: 'rose' },
  CANCELLED:          { label: '취소',      color: 'rose' },
  // 작업 칸반 (BS0005)
  WAITING:            { label: '대기',      color: 'slate' },
  REVIEW:             { label: '검수',      color: 'amber' },
  ON_HOLD:            { label: '보류',      color: 'amber' },
  // 결재 문서 · 승인선
  APPROVED:           { label: '승인완료',  color: 'emerald' },
  REJECTED:           { label: '반려',      color: 'rose' },
  PENDING:            { label: '대기',      color: 'slate' },
  // 결재 문서 유형
  ORDER_EDIT:         { label: '주문수정',  color: 'cyan' },
  PARTIAL_REFUND:     { label: '부분환불',  color: 'rose' },
  FULL_REFUND:        { label: '전체환불',  color: 'rose' },
  REPAYMENT:          { label: '재결제',    color: 'emerald' },
  RATE_CHANGE:        { label: '단가변경',  color: 'purple' },
  SETTLEMENT_ADJUST:  { label: '정산조정',  color: 'cyan' },
  // 매출 이벤트 (BS0001)
  PAYMENT:            { label: '결제',      color: 'emerald' },
  // 정산 · 명세서
  DRAFT:              { label: '초안',      color: 'slate' },
  PAID:               { label: '지급완료',  color: 'emerald' },
  // 결제내역 매칭
  MATCHED:            { label: '매칭완료',  color: 'emerald' },
  UNMATCHED:          { label: '미매칭',    color: 'amber' },
  // 수집 배치 · 행
  SUCCESS:            { label: '성공',      color: 'emerald' },
  FAILED:             { label: '실패',      color: 'rose' },
  REVIEW_PENDING:     { label: '검수대기',  color: 'amber' },
  OK:                 { label: '정상',      color: 'emerald' },
  ERROR:              { label: '오류',      color: 'rose' },
  DUP:                { label: '중복',      color: 'amber' },
  // 세금계산서
  REQUESTED:          { label: '발행요청',  color: 'amber' },
  ISSUED:             { label: '발행완료',  color: 'emerald' },
  DELIVERED:          { label: '전송완료',  color: 'cyan' },
  // 알림 이메일 (BS0011)
  QUEUED:             { label: '발송대기',  color: 'amber' },
  SENT:               { label: '발송완료',  color: 'emerald' },
  // 프리랜서 · 역할
  ACTIVE:             { label: '활동중',    color: 'emerald' },
  INACTIVE:           { label: '비활성',    color: 'slate' },
  ADMIN:              { label: '관리자',    color: 'purple' },
  EXEC:               { label: '경영진',    color: 'purple' },
  TEAM_LEAD:          { label: '팀장',      color: 'cyan' },
  FINANCE:            { label: '재무',      color: 'emerald' },
  STAFF:              { label: '실무자',    color: 'slate' },
  // 우선순위 · 기타
  HIGH:               { label: '높음',      color: 'rose' },
  NORMAL:             { label: '보통',      color: 'slate' },
  DEMO:               { label: '데모',      color: 'amber' },
};

const EnumPill = ({ status, size = 'sm', className = '' }) => {
  const meta = ENUM_META[status] || { label: status, color: 'slate' };
  const c = PILL_COLORS[meta.color] || PILL_COLORS.slate;
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border ${c.bg} ${c.text} ${c.border} ${px} font-medium whitespace-nowrap ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>
      {meta.label}
    </span>
  );
};

// ── Money — 금액 표기 (설계기준 §4.2 + IDEA-07 금액 계보) ────────────────────
// value: 숫자(음수면 자동으로 − + rose) / negative: 강제 음수 표기
// locked: 원 금액 불변 자물쇠 마이크로 아이콘 (BS0001)
// formula: 점선 밑줄 + 클릭 시 수식 팝오버.
//   - string: 한 줄 설명
//   - array: [{ label, value, ref }] 영수증 스타일 행 (ref: 결재번호 등 근거 칩)
// 인라인 요소 — 테이블에서는 <td className="text-right">로 우측 정렬해 사용.
const Money = ({ value, negative = false, locked = false, formula = null, size = 'sm', className = '' }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const neg = negative || value < 0;
  const abs = Math.abs(value);
  const sizeCls = size === 'lg' ? 'text-xl font-bold' : size === 'md' ? 'text-base font-semibold' : 'text-sm';

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const numEl = (
    <span className={`font-mono tabular-nums ${neg ? 'text-rose-300' : ''} ${sizeCls}`}>
      {neg ? '−' : ''}₩{fmt(abs)}
    </span>
  );

  const inner = (
    <span className="inline-flex items-center gap-1">
      {locked && <Icon name="lock" className="w-3 h-3 text-slate-500" title="원 금액 불변 (BS0001)" />}
      {numEl}
    </span>
  );

  if (!formula) return <span className={`inline-flex items-center ${className}`}>{inner}</span>;

  return (
    <span ref={wrapRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 border-b border-dotted border-slate-500 hover:border-purple-400 cursor-pointer"
        title="수식 보기 (IDEA-07)"
      >
        {inner}
      </button>
      {open && (
        <span className="absolute z-50 top-full right-0 mt-1.5 w-72 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-3 block text-left">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-purple-400 mb-2">금액 계보 · Money Lineage</span>
          {typeof formula === 'string' ? (
            <span className="block text-xs text-slate-300">{formula}</span>
          ) : (
            <span className="block space-y-1">
              {formula.map((line, i) => (
                <span key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400 truncate">
                    {line.label}
                    {line.ref && <span className="ml-1 font-mono text-[10px] text-cyan-300">{line.ref}</span>}
                  </span>
                  <span className={`font-mono tabular-nums shrink-0 ${line.value < 0 ? 'text-rose-300' : 'text-slate-200'}`}>
                    {line.value < 0 ? '−' : '+'}₩{fmt(Math.abs(line.value))}
                  </span>
                </span>
              ))}
              <span className="flex items-center justify-between gap-2 text-xs border-t border-slate-700 pt-1 mt-1">
                <span className="text-slate-300 font-medium">= 합계</span>
                <span className={`font-mono tabular-nums font-bold ${neg ? 'text-rose-300' : 'text-white'}`}>
                  {neg ? '−' : ''}₩{fmt(abs)}
                </span>
              </span>
            </span>
          )}
          <span className="block text-[10px] text-slate-500 mt-2">이벤트 합산으로 유도된 값입니다 (BS0001)</span>
        </span>
      )}
    </span>
  );
};

// ── DdayBadge (설계기준 §4.4) — 카드·행: 상대 표기 ───────────────────────────
// 지연 D+n = rose 솔리드 / D-2 이내 rose 틴트 / D-5 이내 amber / 여유 slate
const DdayBadge = ({ date, base }) => {
  const d = ddayOf(date, base);
  if (d < 0) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono font-bold bg-rose-500 text-white" title={`마감 ${date} — ${-d}일 지연`}>
        D+{-d}
      </span>
    );
  }
  const tone = d <= 2
    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
    : d <= 5
      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
      : 'bg-slate-500/15 text-slate-300 border border-slate-500/30';
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono font-medium ${tone}`} title={`마감 ${date}`}>
      {d === 0 ? 'D-DAY' : `D-${d}`}
    </span>
  );
};

// ── LockBadge (설계기준 §4.5) — 정산 잠금 CONFIRMED ─────────────────────────
// 자물쇠 + 확정일. hover 툴팁: 사유 + 조정 결재 안내 (버튼 액션은 화면에서 배치)
const LockBadge = ({ date, reason }) => (
  <span className="relative inline-flex group">
    <span className="inline-flex items-center gap-1 rounded-md border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-2 py-0.5 text-xs font-medium">
      <Icon name="lock" className="w-3 h-3" />
      확정{date ? ` · ${date.slice(5, 10)}` : ''}
    </span>
    <span className="absolute z-50 hidden group-hover:block top-full left-0 mt-1.5 w-64 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-3 text-left">
      <span className="block text-xs text-slate-300">{date ? `${date} 확정됨` : '확정됨'} · 수정은 조정 결재로만 가능</span>
      {reason && <span className="block text-[11px] text-slate-500 mt-1">{reason}</span>}
      <span className="block text-[10px] font-mono text-slate-500 mt-1.5">MG1003 · 조정 기안 작성 →</span>
    </span>
  </span>
);

// ── SidePanel (IDEA-06) — 우측 w-480 슬라이드, Esc 닫기, sticky 헤더 ─────────
const SidePanel = ({ open, onClose, title, subtitle, width = 480, children, footer }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} aria-hidden="true"></div>
      <div
        className="absolute right-0 top-0 h-full bg-slate-900 border-l border-slate-700/60 shadow-2xl flex flex-col"
        style={{ width, animation: 'panelIn .25s ease-out' }}
        role="dialog" aria-modal="true"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div className="min-w-0">
            <div className="font-bold text-base truncate">{title}</div>
            {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="닫기 (Esc)">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-800 p-4">{footer}</div>}
      </div>
    </div>
  );
};

// ── SavedViewChips (IDEA-05) — 저장된 뷰 칩 + 건수 배지 ──────────────────────
// views: [{ id, name, count }] / activeId / onSelect(id|null)
const SavedViewChips = ({ views = [], activeId = null, onSelect, allLabel = '전체' }) => (
  <div className="flex items-center gap-1.5 flex-wrap">
    <button
      onClick={() => onSelect && onSelect(null)}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        activeId == null
          ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
          : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
      }`}
    >
      {allLabel}
    </button>
    {views.map((v, i) => (
      <button
        key={v.id}
        onClick={() => onSelect && onSelect(v.id)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition inline-flex items-center gap-1.5 ${
          activeId === v.id
            ? 'bg-purple-500/20 text-purple-200 border-purple-500/40'
            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
        }`}
        title={`숫자키 ${i + 1}`}
      >
        {v.name}
        {v.count != null && <span className="font-mono text-[10px] px-1 rounded bg-slate-700/80 text-slate-300">{v.count}</span>}
      </button>
    ))}
  </div>
);

// ── ConfirmDialog — 위험도 3단 마찰 (설계기준 §4.6) ──────────────────────────
// risk: 'low'(Enter 확정) | 'mid'(요약 카드 + 명시 클릭) | 'high'(Type-to-Confirm 금액 재입력)
// confirmValue: high에서 입력 일치 검증 대상(숫자 또는 문자열 — ₩/콤마/공백 무시 비교)
// summary: 반영 요약 노드(mid/high 권장 — 금액 총계 대조 카드)
const ConfirmDialog = ({
  open, risk = 'low', title, message, summary = null,
  confirmValue = null, confirmLabel = '확정', cancelLabel = '취소',
  danger = false, onConfirm, onClose, children,
}) => {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open]);

  const norm = (s) => String(s == null ? '' : s).replace(/[₩,\s원]/g, '');
  const matched = risk !== 'high' || (typed.length > 0 && norm(typed) === norm(confirmValue));
  const showError = risk === 'high' && typed.length > 0 && !matched;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
      if (e.key === 'Enter' && risk === 'low') onConfirm && onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, risk, onConfirm, onClose]);

  if (!open) return null;
  const riskMeta = {
    low:  { label: '저위험',  cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
    mid:  { label: '중위험',  cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    high: { label: '고위험',  cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  }[risk];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} aria-hidden="true"></div>
      <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6" role="alertdialog" aria-modal="true">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${riskMeta.cls}`}>{riskMeta.label}</span>
        </div>
        {message && <p className="text-sm text-slate-400 mb-3">{message}</p>}
        {(risk === 'mid' || risk === 'high') && summary && (
          <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 mb-3 text-sm">{summary}</div>
        )}
        {children}
        {risk === 'high' && (
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1.5">
              확인을 위해 금액을 다시 입력하세요 <span className="font-mono text-slate-500">(예: {fmt(Number(norm(confirmValue)) || 0)})</span>
            </label>
            <input
              type="text" value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder="금액 입력"
              className={`w-full rounded-lg bg-slate-950 border px-3 py-2 text-sm font-mono tabular-nums outline-none ${
                showError ? 'border-rose-500/60 focus:border-rose-400' : 'border-slate-700 focus:border-purple-500/60'
              }`}
              autoFocus
            />
            {showError && <p className="text-xs text-rose-300 mt-1.5">기안 금액과 일치하지 않습니다</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">
            {cancelLabel}
          </button>
          <button
            onClick={() => matched && onConfirm && onConfirm()}
            disabled={!matched}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
              !matched
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : danger
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'
            }`}
          >
            {confirmLabel}{risk === 'low' ? ' (Enter)' : ''}
          </button>
        </div>
        {risk === 'low' && <p className="text-[11px] text-slate-600 mt-2 text-right">Enter 키로 바로 확정할 수 있어요</p>}
      </div>
    </div>
  );
};

// ── Toast — 하단 중앙, 다음 행동 릴레이 버튼 지원 (IDEA-16) ──────────────────
// 사용: window.toast('메시지') 또는
//       window.toast('37건 등록 완료', { actionLabel: '지금 배정하기 →', onAction: () => navigate('assign', {...}) })
// ToastHost는 index.html 셸이 1회 렌더링 — 화면에서는 window.toast만 호출.
let __toastListener = null;
let __toastSeq = 0;
const toast = (message, opts = {}) => {
  if (__toastListener) __toastListener({ id: ++__toastSeq, message, ...opts });
  else console.log('[toast]', message);
};
const useToast = () => toast;

function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    __toastListener = (t) => {
      setItems((s) => [...s, t]);
      const dur = t.duration || (t.actionLabel ? 5200 : 2600);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), dur);
    };
    return () => { __toastListener = null; };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2">
      {items.map((t) => (
        <div key={t.id} className="flex items-center gap-3 rounded-xl bg-slate-800 border border-slate-600 shadow-2xl px-4 py-2.5" style={{ animation: 'fadeUp .25s ease-out' }}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.tone === 'error' ? 'bg-rose-400' : t.tone === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
          <span className="text-sm text-slate-200">{t.message}</span>
          {t.actionLabel && (
            <button
              onClick={() => { t.onAction && t.onAction(); setItems((s) => s.filter((x) => x.id !== t.id)); }}
              className="shrink-0 text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 hover:from-purple-300 hover:to-pink-300"
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Sparkline ────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color = '#a855f7', height = 32 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  const fillPoints = `0,100 ${points} 100,100`;
  const gid = `sparkfill-${color.replace('#', '')}`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gid})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// ── EmptyState (설계기준 §4.7 + IDEA-18 3단계 온보딩) ────────────────────────
// steps 없으면 단순 빈 상태(이전 단계 안내), steps=[{title, desc}] 3개면 온보딩 카드
const EmptyState = ({ icon = 'sparkles', title, description, steps = null, actionLabel, onAction, secondaryLabel, onSecondary }) => (
  <div className="rounded-xl border-2 border-dashed border-slate-700/80 p-10 text-center">
    <div className="mx-auto w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-purple-400 mb-3">
      <Icon name={icon} className="w-5 h-5" />
    </div>
    <h3 className="text-base font-bold mb-1">{title}</h3>
    {description && <p className="text-sm text-slate-400 max-w-md mx-auto">{description}</p>}
    {steps && (
      <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mt-6 text-left">
        {steps.map((s, i) => (
          <div key={i} className="rounded-lg bg-slate-900 border border-slate-700/60 p-4">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center justify-center mb-2">{i + 1}</div>
            <div className="text-sm font-semibold">{s.title}</div>
            {s.desc && <div className="text-xs text-slate-500 mt-1">{s.desc}</div>}
          </div>
        ))}
      </div>
    )}
    {(actionLabel || secondaryLabel) && (
      <div className="flex items-center justify-center gap-2 mt-6">
        {actionLabel && (
          <button onClick={onAction} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
            {actionLabel}
          </button>
        )}
        {secondaryLabel && (
          <button onClick={onSecondary} className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">
            {secondaryLabel}
          </button>
        )}
      </div>
    )}
  </div>
);

// ── 노출 ─────────────────────────────────────────────────────────────────────
Object.assign(window, {
  // 유틸
  fmt, pad, maskPhone, maskAccount, ddayOf,
  // 컴포넌트
  Icon, Card, SectionLabel, PageHeader,
  EnumPill, ENUM_META, PILL_COLORS,
  Money, DdayBadge, LockBadge,
  SidePanel, SavedViewChips, ConfirmDialog,
  toast, useToast, ToastHost,
  Sparkline, EmptyState,
});
