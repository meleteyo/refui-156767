// payment-import.jsx — 결제내역 등록 (모델 24 · entry2) — IDEA-01 검증-커밋 리듬 재사용 + 주문 자동 매칭 + 미매칭 인라인 수동 매칭
const { useState, useMemo, useEffect } = React;

// ── 로컬 보강 데이터 (화면 전용 시뮬레이션) ──────────────────────────────────
const PI_PLATFORMS = [
  { v: 'BANK', l: '은행 입금내역' },
  { v: 'SMARTSTORE', l: '스마트스토어' },
  { v: 'COUPANG', l: '쿠팡' },
  { v: 'KMONG', l: '크몽' },
];
const PI_TYPE_FILTERS = [
  { v: 'ALL', l: '전체 (자동 판별)' },
  { v: 'PAYMENT', l: '결제' },
  { v: 'REFUND', l: '환불' },
  { v: 'REPAYMENT', l: '재결제' },
];
// (플랫폼주문번호 → 주문) 자동 대사 / 입금자명 부분 일치 후보 / 기존 결제 중복 (BS0004 준용)
const PI_ORDER_BY_NO = { '2026070412330077': 'ORD-2607-005', '2026070812340011': 'ORD-2607-011', '2026070212340009': 'ORD-2607-009' };
const PI_SUGGEST_BY_PAYER = { '코지홈': 'ORD-2607-008', '온새미로': 'ORD-2607-012' };
const PI_EXISTING_PAYMENT = { '2026070212330015': 'PAY-002' };

// IMP-005 계열의 시연용 시드 행 — data.js IMPORT_BATCHES 행에 매칭 컬럼(플랫폼주문번호·유형)을 로컬 보강
const PI_SAMPLE = [
  { row: 2, data: { platformOrderNo: '2026070412330077', type: 'PAYMENT', amount: '900000', paidAt: '2026-07-08', payer: '그린리프상사' } },
  { row: 3, data: { platformOrderNo: '', type: 'PAYMENT', amount: '720000', paidAt: '2026-07-08', payer: '코지홈' } },
  { row: 4, data: { platformOrderNo: '', type: 'PAYMENT', amount: '850000', paidAt: '2026-07-09', payer: '온새미로' } },
  { row: 5, data: { platformOrderNo: '2026070812340011', type: 'PAYMENT', amount: '1050000', paidAt: '2026-07-08', payer: '(주)해솔건강원' } },
  { row: 6, data: { platformOrderNo: '', type: 'PAYMENT', amount: '490000', paidAt: '2026-07-10', payer: '가상계좌 입금' } },
  { row: 7, data: { platformOrderNo: '2026070212330015', type: 'PAYMENT', amount: '1800000', paidAt: '2026-07-02', payer: '한빛식품' } },
  { row: 8, data: { platformOrderNo: '2026070212340009', type: 'PARTIAL_REFUND', amount: '-1500000', paidAt: '2026-07-09', payer: '퓨어펫푸드' } },
  { row: 9, data: { platformOrderNo: '', type: 'PAYMENT', amount: '삼십만', paidAt: '07/10', payer: '미래상사' } },
];

// 주문별 현재 매출 = SALES_EVENTS 부호 합산 (BS0001 — 필드로 저장하지 않음)
const piCurrentSales = (orderId) => SALES_EVENTS.filter((e) => e.orderId === orderId).reduce((s, e) => s + e.amount, 0);

// 행 검증 + 자동 매칭 — 환불 누계 초과는 오류로 분리 (BS0001)
function piValidateRow(data, manualOrderId) {
  const errors = [];
  const amtRaw = String(data.amount == null ? '' : data.amount).replace(/,/g, '').trim();
  const amt = Number(amtRaw);
  if (!amtRaw || isNaN(amt) || amt === 0) errors.push({ col: 'amount', cause: '금액은 숫자여야 합니다 (환불은 − 부호)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.paidAt || '').trim())) errors.push({ col: 'paidAt', cause: '발생일 형식이 올바르지 않습니다 (YYYY-MM-DD)' });
  if (!String(data.payer || '').trim()) errors.push({ col: 'payer', cause: '입금자명이 비어 있습니다' });
  if (errors.length > 0) return { status: 'ERROR', errors, cause: null, orderId: null, suggestedOrderId: null };

  const dupOf = PI_EXISTING_PAYMENT[String(data.platformOrderNo || '').trim()];
  if (dupOf) return { status: 'DUP', errors: [], cause: `이미 등록된 결제내역 — ${dupOf} (BS0004 준용)`, orderId: null, suggestedOrderId: null };

  const orderId = manualOrderId || PI_ORDER_BY_NO[String(data.platformOrderNo || '').trim()] || null;
  const suggestedOrderId = orderId ? null : (PI_SUGGEST_BY_PAYER[String(data.payer || '').trim()] || null);

  // 환불 행은 매칭 주문의 현재 매출(이벤트 합산)을 초과할 수 없다 (BS0001)
  if (amt < 0 && orderId) {
    const cur = piCurrentSales(orderId);
    if (Math.abs(amt) > cur) {
      return { status: 'ERROR', errors: [{ col: 'amount', cause: `환불 금액 초과 — 현재 매출 ₩${window.fmt(cur)} (BS0001)` }], cause: null, orderId, suggestedOrderId: null };
    }
  }
  return { status: 'OK', errors: [], cause: null, orderId, suggestedOrderId };
}

function PaymentImport({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, Money, Icon, ConfirmDialog, EmptyState, fmt } = window;

  const [tab, setTab] = useState('excel');            // excel | single
  const [platform, setPlatform] = useState('BANK');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [fileName, setFileName] = useState(null);
  const [rows, setRows] = useState(null);
  const [reveal, setReveal] = useState(0);
  const [errorOnly, setErrorOnly] = useState(false);
  const [matchRowIdx, setMatchRowIdx] = useState(null); // 수동 매칭 대상 행 index
  const [matchQ, setMatchQ] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  // 단건 등록 탭
  const [sg, setSg] = useState({ platform: 'SMARTSTORE', type: 'PAYMENT', orderNo: '', amount: '', occurredAt: TODAY, memo: '' });

  const runValidate = (seed) => {
    const validated = seed.map((r) => ({ row: r.row, data: { ...r.data }, manualOrderId: null, ...piValidateRow(r.data, null) }));
    setReceipt(null);
    setRows(validated);
    setErrorOnly(false);
    setMatchRowIdx(null);
    setReveal(0);
    [1, 2, 3, 4, 5].forEach((n, i) => setTimeout(() => setReveal(n), 160 + i * 420));
  };

  // 딥링크: 알림/이력에서 batchId 재진입 (IDEA-16)
  useEffect(() => {
    const batchId = route && route.payload && route.payload.batchId;
    if (batchId === 'IMP-005') {
      setFileName('woori_deposits_202607.xlsx');
      runValidate(PI_SAMPLE);
      window.toast('배치 IMP-005 재진입 — 미매칭 행을 이어서 매칭하세요', { tone: 'warn' });
    }
  }, []);

  // 엑셀 범위 Ctrl+V → 즉시 검증 (IDEA-01 — 모델 12와 동일 리듬)
  const onPaste = (e) => {
    if (tab !== 'excel' || receipt) return;
    const text = e.clipboardData ? e.clipboardData.getData('text') : '';
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0 || !lines[0].includes('\t')) return;
    e.preventDefault();
    const parsed = lines.map((l, i) => {
      const c = l.split('\t');
      const amt = (c[2] || '').trim();
      return { row: i + 2, data: { platformOrderNo: (c[0] || '').trim(), payer: (c[1] || '').trim(), amount: amt, paidAt: (c[3] || '').trim(), type: Number(String(amt).replace(/,/g, '')) < 0 ? 'PARTIAL_REFUND' : 'PAYMENT' } };
    });
    setFileName(null);
    runValidate(parsed);
    window.toast(`클립보드 ${parsed.length}행 붙여넣기 — 즉시 검증 · 주문 자동 매칭 완료`);
  };

  const stats = useMemo(() => {
    if (!rows) return null;
    const ok = rows.filter((r) => r.status === 'OK');
    const matched = ok.filter((r) => r.orderId);
    const unmatched = ok.filter((r) => !r.orderId);
    const dup = rows.filter((r) => r.status === 'DUP');
    const err = rows.filter((r) => r.status === 'ERROR');
    const salesTotal = matched.reduce((s, r) => s + Number(String(r.data.amount).replace(/,/g, '')), 0);
    return { total: rows.length, ok: ok.length, matched: matched.length, unmatched: unmatched.length, dup: dup.length, err: err.length, salesTotal };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    return errorOnly ? rows.filter((r) => r.status !== 'OK' || !r.orderId) : rows;
  }, [rows, errorOnly]);

  // ── 수동 매칭: <연결> → 해당 행 매칭 전환 + 즉시 재검증 (환불 초과 재확인 포함) ──
  const matchCandidates = useMemo(() => {
    if (!matchQ.trim()) return [];
    const q = matchQ.trim().toLowerCase();
    return ORDERS.filter((o) => o.id.toLowerCase().includes(q) || o.clientName.toLowerCase().includes(q) || o.item.toLowerCase().includes(q)).slice(0, 4);
  }, [matchQ]);

  const linkOrder = (orderId) => {
    const idx = matchRowIdx;
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, manualOrderId: orderId, ...piValidateRow(r.data, orderId) } : r)));
    const target = rows[idx];
    const revalidated = piValidateRow(target.data, orderId);
    setMatchRowIdx(null);
    setMatchQ('');
    if (revalidated.status === 'OK') window.toast(`${target.row}행 매칭 완료 — ${orderId} · 등록 대상에 편입됐어요`);
    else window.toast(`${target.row}행 연결됨 — 재검증 결과 오류: ${revalidated.errors[0].cause}`, { tone: 'error' });
  };

  // ── 등록(커밋) — 매칭 행만 등록, 미매칭 보류 · 매출 재계산 702 (BS0007 이력) ──
  const doRegister = () => {
    setConfirmOpen(false);
    const batchId = `IMP-${String(IMPORT_BATCHES.length + 1).padStart(3, '0')}`;
    setReceipt({ batchId, matched: stats.matched, unmatched: stats.unmatched, dup: stats.dup, err: stats.err, salesTotal: stats.salesTotal });
    window.toast(`${stats.matched}건 등록 (${batchId}) — 매칭 주문 ${stats.matched}건 매출 재계산 완료`, {
      actionLabel: '손익 대시보드 확인 →',
      onAction: () => navigate('profit'),
      duration: 6500,
    });
  };

  // ── 단건 등록 파생값 ──
  const sgOrderId = PI_ORDER_BY_NO[sg.orderNo.trim()] || (ORDERS.some((o) => o.id === sg.orderNo.trim()) ? sg.orderNo.trim() : null);
  const sgOrder = sgOrderId ? ORDERS.find((o) => o.id === sgOrderId) : null;
  const sgAmt = Number(String(sg.amount).replace(/,/g, ''));
  const sgIsRefund = sg.type === 'PARTIAL_REFUND' || sg.type === 'FULL_REFUND';
  const sgCur = sgOrderId ? piCurrentSales(sgOrderId) : 0;
  const sgRefundExceeds = sgIsRefund && sgOrderId && !isNaN(sgAmt) && Math.abs(sgAmt) > sgCur;
  const sgLockedPeriod = /^2026-06/.test(sg.occurredAt); // 6월 정산 CONFIRMED — 직접 등록 차단 (MG1003)
  const sgReady = sgOrderId && sg.amount && !isNaN(sgAmt) && sgAmt !== 0 && !sgRefundExceeds && !sgLockedPeriod && sg.occurredAt;

  const submitSingle = () => {
    window.toast(`단건 등록 완료 — ${sgOrderId} ${window.ENUM_META[sg.type].label} ${sgIsRefund ? '−' : '+'}₩${fmt(Math.abs(sgAmt))} · 매출 재계산(702) 실행`, {
      actionLabel: '주문에서 확인 →',
      onAction: () => navigate('orders', { orderId: sgOrderId }),
      duration: 6000,
    });
    setSg({ platform: 'SMARTSTORE', type: 'PAYMENT', orderNo: '', amount: '', occurredAt: TODAY, memo: '' });
  };

  const countChip = (label, value, color, idx, suffix) => {
    const tones = {
      slate: 'border-slate-700 text-slate-200',
      emerald: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
      rose: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
      amber: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    };
    return (
      <div className={`rounded-lg border px-4 py-2.5 transition-all duration-300 ${tones[color]} ${reveal >= idx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-xl font-bold font-mono tabular-nums">{value}<span className="text-xs font-normal ml-0.5">{suffix || ''}</span></div>
      </div>
    );
  };

  const inputCls = 'w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60';

  return (
    <div onPaste={onPaste} className="space-y-5">
      <PageHeader
        label="FINANCE · PAYMENT IMPORT"
        title="결제내역 등록"
        desc="플랫폼에서 이미 발생한 사실의 사후 대사 — 결재 경유 없이 매출 이벤트(BS0001)만 적재하고, 재계산은 이력으로 저장됩니다(BS0007)"
        actions={
          <button onClick={() => window.toast('결제내역 표준 양식 payments_template.xlsx 다운로드 (시뮬레이션)')} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm flex items-center gap-2">
            <Icon name="download" className="w-3.5 h-3.5" />표준 양식 다운로드
          </button>
        }
      />

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {[['excel', '엑셀 업로드', 'upload'], ['single', '단건 등록', 'edit']].map(([k, l, ic]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-2 ${tab === k ? 'border-purple-500 text-purple-200' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Icon name={ic} className="w-3.5 h-3.5" />{l}
          </button>
        ))}
      </div>

      {/* ═══ 엑셀 업로드 탭 ═══ */}
      {tab === 'excel' && !receipt && (
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">플랫폼 <span className="text-rose-400">*</span></label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
                {PI_PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">내역 구분 <span className="text-rose-400">*</span></label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputCls}>
                {PI_TYPE_FILTERS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={() => { setFileName('woori_deposits_202607.xlsx'); window.toast('파일 선택됨 — <검증>을 눌러 시작하세요'); }} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm flex items-center gap-2">
              <Icon name="upload" className="w-3.5 h-3.5" />파일 선택
            </button>
            <span className="text-sm font-mono text-slate-400">{fileName || 'xlsx · 최대 10MB'}</span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5 flex-1 min-w-[240px]">
              <Icon name="sparkles" className="w-3.5 h-3.5 text-purple-400" />
              엑셀 범위를 복사해 이 화면에 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl+V</kbd> 하면 즉시 검증됩니다 (IDEA-01)
            </span>
            <button onClick={() => { setFileName(fileName || 'woori_deposits_202607.xlsx'); runValidate(PI_SAMPLE); }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-2">
              <Icon name="shieldCheck" className="w-4 h-4" />검증
            </button>
          </div>
        </Card>
      )}

      {tab === 'excel' && !rows && !receipt && (
        <EmptyState
          icon="creditCard"
          title="아직 검증한 결제내역이 없어요"
          description="주문 엑셀 업로드와 같은 리듬이에요 — 검증하면 (플랫폼, 플랫폼주문번호)로 주문과 자동 대사됩니다."
          steps={[
            { title: '템플릿 다운로드', desc: '결제내역 양식(xlsx)을 받아요' },
            { title: '채워서 드롭 · Ctrl+V', desc: '은행/플랫폼 내역 붙여넣기' },
            { title: '매칭 확인 후 등록', desc: '미매칭은 화면에서 바로 연결' },
          ]}
          actionLabel="샘플 데이터로 검증 체험"
          onAction={() => { setFileName('woori_deposits_202607.xlsx'); runValidate(PI_SAMPLE); }}
        />
      )}

      {/* ── 검증 결과 + 자동 매칭 카운트 ── */}
      {tab === 'excel' && rows && !receipt && stats && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <window.SectionLabel color="emerald">검증 결과</window.SectionLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {countChip('전체', stats.total, 'slate', 1)}
                {countChip('정상', stats.ok, 'emerald', 2)}
                {countChip('오류', stats.err, 'rose', 3)}
                {countChip('중복', stats.dup, 'amber', 4)}
              </div>
              <label className="ml-auto flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={errorOnly} onChange={(e) => setErrorOnly(e.target.checked)} className="accent-purple-500 w-4 h-4" />
                오류·미매칭만 보기
              </label>
            </div>
            <div className={`flex items-center gap-3 transition-all duration-300 ${reveal >= 5 ? 'opacity-100' : 'opacity-0'}`}>
              <span className="text-xs text-slate-500">주문 자동 매칭</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-emerald-500/10 border-emerald-500/40 text-emerald-300 px-2.5 py-1 text-xs font-medium">
                <Icon name="link" className="w-3 h-3" />매칭 <b className="font-mono">{stats.matched}</b>건
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-amber-500/10 border-amber-500/40 text-amber-300 px-2.5 py-1 text-xs font-medium">
                <Icon name="alert" className="w-3 h-3" />미매칭 <b className="font-mono">{stats.unmatched}</b>건 — 화면에서 바로 연결하세요
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2.5 font-medium">행</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  <th className="px-3 py-2.5 font-medium">플랫폼주문번호</th>
                  <th className="px-3 py-2.5 font-medium">입금자</th>
                  <th className="px-3 py-2.5 font-medium">유형</th>
                  <th className="px-3 py-2.5 font-medium text-right">금액</th>
                  <th className="px-3 py-2.5 font-medium">매칭 주문</th>
                  <th className="px-5 py-2.5 font-medium">사유 / 조치</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-500">표시할 행이 없어요 — 오류·미매칭이 모두 해소됐습니다 ✓</td></tr>
                )}
                {visibleRows.map((r) => {
                  const idx = rows.indexOf(r);
                  const amtNum = Number(String(r.data.amount).replace(/,/g, ''));
                  const amountBad = r.errors.some((e) => e.col === 'amount');
                  return (
                    <React.Fragment key={r.row}>
                      <tr className={`border-b border-slate-800/60 ${r.status === 'ERROR' ? 'bg-rose-500/[0.04]' : r.status === 'DUP' ? 'bg-amber-500/[0.04]' : ''}`}>
                        <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{r.row}</td>
                        <td className="px-3 py-2.5"><EnumPill status={r.status} /></td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{r.data.platformOrderNo || <span className="text-slate-600">—</span>}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.data.payer || <span className="text-rose-300 text-xs">(비어 있음)</span>}</td>
                        <td className="px-3 py-2.5"><EnumPill status={r.data.type} /></td>
                        <td className="px-3 py-2.5 text-right">
                          {amountBad || isNaN(amtNum)
                            ? <span className="font-mono text-xs text-rose-300 bg-rose-500/15 border border-rose-500/40 rounded px-1.5 py-0.5">{String(r.data.amount) || '(비어 있음)'}</span>
                            : <Money value={amtNum} />}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.orderId ? (
                            <button onClick={() => navigate('orders', { orderId: r.orderId })} className="font-mono text-xs text-cyan-300 hover:underline flex items-center gap-1">
                              {r.orderId}{r.manualOrderId && <span className="text-[10px] text-purple-300">(수동)</span>}
                            </button>
                          ) : r.status === 'OK' ? <EnumPill status="UNMATCHED" /> : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-2.5 text-xs max-w-[260px]">
                          {r.status === 'ERROR' && r.errors.map((e, i) => <div key={i} className="text-rose-300">{r.row}행 — {e.cause}</div>)}
                          {r.status === 'DUP' && <span className="text-amber-300">{r.cause} · 등록에서 제외</span>}
                          {r.status === 'OK' && !r.orderId && (
                            <button onClick={() => { setMatchRowIdx(idx); setMatchQ(r.suggestedOrderId ? ORDERS.find((o) => o.id === r.suggestedOrderId).clientName : ''); }}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/15 text-amber-300 px-2 py-1 text-xs hover:bg-amber-500/25">
                              <Icon name="link" className="w-3 h-3" />매칭{r.suggestedOrderId && <span className="text-[10px] text-slate-400">후보: {r.suggestedOrderId}</span>}
                            </button>
                          )}
                          {r.status === 'OK' && r.orderId && <span className="text-slate-600">—</span>}
                        </td>
                      </tr>
                      {/* 인라인 수동 매칭 영역 */}
                      {matchRowIdx === idx && (
                        <tr className="bg-purple-500/[0.05] border-b border-purple-500/30">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <window.SectionLabel color="purple">수동 매칭 — {r.row}행</window.SectionLabel>
                              <div className="relative min-w-[240px]">
                                <Icon name="search" className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input value={matchQ} onChange={(e) => setMatchQ(e.target.value)} autoFocus
                                  placeholder="주문번호 · 주문명 · 고객사 검색"
                                  className="w-full pl-8 pr-3 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-xs outline-none focus:border-purple-500/60" />
                              </div>
                              <button onClick={() => { setMatchRowIdx(null); setMatchQ(''); }} className="text-xs text-slate-500 hover:text-slate-300 ml-auto">닫기 (Esc)</button>
                            </div>
                            <div className="mt-2 space-y-1">
                              {matchQ.trim() && matchCandidates.length === 0 && <div className="text-xs text-slate-500 px-1">일치하는 주문이 없어요</div>}
                              {matchCandidates.map((o) => (
                                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                                  <span className="font-mono text-xs text-cyan-300">{o.id}</span>
                                  <span className="text-xs text-slate-200 truncate flex-1">{o.clientName} · {o.item}</span>
                                  <Money value={o.amount} locked className="text-xs" />
                                  <button onClick={() => linkOrder(o.id)} className="px-3 py-1 rounded-md text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">연결</button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── 등록 요약 — 커밋 전 총계 대조 (IDEA-01) ── */}
          <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <window.SectionLabel color="purple">등록 요약</window.SectionLabel>
              <div className="text-sm text-slate-300">
                신규 <b className="font-mono text-emerald-300">{stats.matched}</b>건
                <span className="text-slate-600 mx-1.5">·</span>중복 제외 <b className="font-mono text-amber-300">{stats.dup}</b>건
                <span className="text-slate-600 mx-1.5">·</span>오류 제외 <b className="font-mono text-rose-300">{stats.err}</b>건
                <span className="text-slate-600 mx-1.5">·</span>미매칭 보류 <b className="font-mono text-amber-300">{stats.unmatched}</b>건
              </div>
              <div className="text-sm text-slate-400">등록될 매출 합계 <Money value={stats.salesTotal} size="md" className="ml-1" /></div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => window.toast(`오류 행 ${stats.err}건 xlsx 다운로드 (시뮬레이션)`)} disabled={stats.err === 0}
                  className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${stats.err === 0 ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'}`}>
                  <Icon name="download" className="w-3.5 h-3.5" />오류 행 다운로드
                </button>
                <button onClick={() => setConfirmOpen(true)} disabled={stats.matched === 0}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition ${
                    stats.matched === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : `bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 ${stats.err === 0 && stats.unmatched === 0 ? 'animate-pulse shadow-lg shadow-purple-500/30' : ''}`
                  }`}>
                  <Icon name="check" className="w-4 h-4" />등록 ({stats.matched}건)
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">등록 시 매칭 주문 {stats.matched}건의 매출이 재계산됩니다 (매출 재계산 702 · trigger IMPORT · 이력 저장 BS0007) — 미매칭 행은 보류되어 등록에 포함되지 않아요</p>
          </div>
        </Card>
      )}

      {/* ── 등록 완료 영수증 ── */}
      {tab === 'excel' && receipt && (
        <Card className="p-6 !border-emerald-500/40">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Icon name="receipt" className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <window.SectionLabel color="emerald">등록 완료 — 배치 영수증</window.SectionLabel>
              <div className="text-2xl font-bold font-mono mt-1">{receipt.batchId}</div>
              <p className="text-sm text-slate-400 mt-1">매출 이벤트가 적재되고 재계산 이력이 저장됐어요(BS0007) — 정산 재계산(703)은 정산 확정 시점에 실행됩니다 (MG1003)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">등록 · 재계산</div><div className="text-lg font-bold font-mono text-emerald-300">{receipt.matched}건</div></div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">미매칭 보류</div><div className="text-lg font-bold font-mono text-amber-300">{receipt.unmatched}건</div></div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">중복·오류 제외</div><div className="text-lg font-bold font-mono text-rose-300">{receipt.dup + receipt.err}건</div></div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">적재된 매출 합계</div><Money value={receipt.salesTotal} size="md" /></div>
              </div>
              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => navigate('profit')} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-2">
                  손익 대시보드에서 반영 확인<Icon name="arrowRight" className="w-3.5 h-3.5" />
                </button>
                {receipt.unmatched > 0 && (
                  <button onClick={() => { setReceipt(null); setErrorOnly(true); }} className="px-4 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 text-amber-300">미매칭 {receipt.unmatched}건 이어서 매칭</button>
                )}
                <button onClick={() => { setReceipt(null); setRows(null); setFileName(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200">새 업로드</button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ═══ 단건 등록 탭 ═══ */}
      {tab === 'single' && (
        <Card className="p-5 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">플랫폼 <span className="text-rose-400">*</span></label>
              <select value={sg.platform} onChange={(e) => setSg({ ...sg, platform: e.target.value })} className={inputCls}>
                {PI_PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">이벤트 유형 <span className="text-rose-400">*</span></label>
              <select value={sg.type} onChange={(e) => setSg({ ...sg, type: e.target.value })} className={inputCls}>
                {['PAYMENT', 'PARTIAL_REFUND', 'FULL_REFUND', 'REPAYMENT'].map((t) => <option key={t} value={t}>{window.ENUM_META[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">플랫폼주문번호 / 주문번호 <span className="text-rose-400">*</span></label>
              <input value={sg.orderNo} onChange={(e) => setSg({ ...sg, orderNo: e.target.value })} placeholder="예: ORD-2607-009 또는 2026070212340009" className={`${inputCls} font-mono`} />
              <div className="mt-1.5 text-xs">
                {sg.orderNo.trim() === '' ? <span className="text-slate-600">입력 즉시 주문 자동 매칭을 조회해요</span>
                  : sgOrder ? (
                    <span className="text-emerald-300 flex items-center gap-1.5"><Icon name="check" className="w-3 h-3" />{sgOrder.id} · {sgOrder.clientName} — {sgOrder.item} <span className="text-slate-500">(현재 매출 ₩{fmt(sgCur)})</span></span>
                  ) : <span className="text-amber-300 flex items-center gap-1.5"><Icon name="alert" className="w-3 h-3" />일치 주문 없음 — 번호를 확인하세요</span>}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">금액 <span className="text-rose-400">*</span></label>
              <input value={sg.amount} onChange={(e) => setSg({ ...sg, amount: e.target.value })} placeholder="숫자만 (원)" className={`${inputCls} font-mono text-right ${sgRefundExceeds ? '!border-rose-500/60' : ''}`} />
              {sgRefundExceeds && <p className="text-xs text-rose-300 mt-1.5">환불 누계가 결제 누계를 초과합니다 — 현재 매출 ₩{fmt(sgCur)} (BS0001)</p>}
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">발생일 <span className="text-rose-400">*</span></label>
              <input type="date" value={sg.occurredAt} onChange={(e) => setSg({ ...sg, occurredAt: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">메모</label>
              <input value={sg.memo} onChange={(e) => setSg({ ...sg, memo: e.target.value })} placeholder="예: 크몽 정산서 7월 2차분 대사" className={inputCls} />
            </div>
          </div>

          {sgLockedPeriod && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5">
              <Icon name="lock" className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-200 leading-relaxed flex-1">
                발생일이 <b>확정된 정산 기간(2026-06)</b>에 속해 직접 등록이 차단됩니다 — 확정 후 변경은 조정 결재로만 가능해요 (MG1003)
              </div>
              <button onClick={() => navigate('draft', { type: 'SETTLEMENT_ADJUST' })} className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">조정 기안 작성 →</button>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[11px] text-slate-500">사내 발의 환불·재결제는 기안 → 결재 승인 경로가 표준이에요 (MG1001) — 이 화면은 플랫폼 발생 사실의 사후 기록입니다</p>
            <button onClick={submitSingle} disabled={!sgReady}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 ${!sgReady ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'}`}>
              <Icon name="check" className="w-4 h-4" />단건 등록
            </button>
          </div>
        </Card>
      )}

      {/* ── 등록 확인 — mid 마찰: 총계 대조 재표시 (§4.6) ── */}
      <ConfirmDialog
        open={confirmOpen}
        risk="mid"
        title="결제내역 배치 등록"
        message={`매칭된 ${stats ? stats.matched : 0}건을 등록하고 매출 이벤트를 적재합니다 — 실패 시 전체 롤백`}
        summary={stats && (
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">신규 등록 (매칭)</span><span className="font-mono text-emerald-300">{stats.matched}건</span></div>
            <div className="flex justify-between"><span className="text-slate-400">미매칭 보류</span><span className="font-mono text-amber-300">{stats.unmatched}건</span></div>
            <div className="flex justify-between"><span className="text-slate-400">중복·오류 제외</span><span className="font-mono text-rose-300">{stats.dup + stats.err}건</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-1 mt-1"><span className="text-slate-300 font-medium">등록될 매출 합계</span><Money value={stats.salesTotal} /></div>
            <div className="text-[11px] text-slate-500 pt-1">매칭 주문 {stats.matched}건 매출 재계산 실행 (702 · BS0007 이력 저장)</div>
          </div>
        )}
        confirmLabel="등록 확정"
        onConfirm={doRegister}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

window.PaymentImport = PaymentImport;
