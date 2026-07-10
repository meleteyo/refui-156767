// excel-import.jsx — 주문 엑셀 업로드 (모델 12 · entry2) — ★IDEA-01 검증-커밋 리듬 / IDEA-16 배정 릴레이 / IDEA-18 빈 상태 온보딩
const { useState, useMemo, useEffect, useRef } = React;

// ── 로컬 보강 데이터 (화면 전용 시뮬레이션) ──────────────────────────────────
const XI_PLATFORMS = [
  { v: 'SMARTSTORE', l: '스마트스토어' },
  { v: 'COUPANG', l: '쿠팡' },
  { v: 'KMONG', l: '크몽' },
  { v: 'MANUAL', l: '수기/기타' },
];
// 기존 플랫폼 주문번호 → 주문 ID (중복 검사 BS0004 시뮬레이션)
const XI_EXISTING = {
  '2026070112330001': 'ORD-2607-001',
  '2026070312330042': 'ORD-2607-004',
};
const XI_COLS = [
  { key: 'platformOrderNo', label: '플랫폼주문번호', mono: true },
  { key: 'clientName', label: '고객사' },
  { key: 'item', label: '주문명' },
  { key: 'amount', label: '금액', right: true },
  { key: 'orderedAt', label: '주문일', mono: true },
];

// 행 단위 검증 — 셀 단위 오류 원인(한국어 업무 용어) + 중복(BS0004) 분리
function xiValidateRow(data) {
  const errors = [];
  const amtRaw = String(data.amount == null ? '' : data.amount).replace(/,/g, '').trim();
  if (!amtRaw || isNaN(Number(amtRaw)) || Number(amtRaw) <= 0) {
    errors.push({ col: 'amount', cause: '금액은 숫자여야 합니다 (예: 1050000)' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.orderedAt == null ? '' : data.orderedAt).trim())) {
    errors.push({ col: 'orderedAt', cause: '주문일이 비어 있거나 형식이 올바르지 않습니다 (YYYY-MM-DD)' });
  }
  if (!String(data.clientName || '').trim()) errors.push({ col: 'clientName', cause: '고객사명이 비어 있습니다' });
  if (!String(data.item || '').trim()) errors.push({ col: 'item', cause: '주문명이 비어 있습니다' });
  if (errors.length > 0) return { status: 'ERROR', errors, cause: null };
  const dupOf = XI_EXISTING[String(data.platformOrderNo || '').trim()];
  if (dupOf) return { status: 'DUP', errors: [], cause: `이미 등록된 플랫폼 주문번호 — ${dupOf} (BS0004)` };
  return { status: 'OK', errors: [], cause: null };
}

function ExcelImport({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, Money, Icon, ConfirmDialog, EmptyState, fmt } = window;

  // ── 상태 ──
  const [platform, setPlatform] = useState('SMARTSTORE');
  const me = EMPLOYEES.find((e) => e.id === CURRENT_USER_ID);
  const [deptId, setDeptId] = useState(me ? me.deptId : DEPARTMENTS[0].id);
  const [projectId, setProjectId] = useState('');
  const [fileName, setFileName] = useState(null);
  const [rows, setRows] = useState(null);          // null = 검증 전 / [{row, data, status, errors, cause}]
  const [reveal, setReveal] = useState(0);         // 카운트 순차 등장 0..4 (★IDEA-01)
  const [errorOnly, setErrorOnly] = useState(false);
  const [edit, setEdit] = useState(null);          // { idx, col }
  const [editVal, setEditVal] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);    // { batchId, okRows, dupRows, errorRows, salesTotal }
  const fileRef = useRef(null);
  const editRef = useRef(null);

  // IMP-006 행을 시드로 사용 (data.js 전역 — 배치 상세 영구 조회와 동일 소스)
  const seedBatch = IMPORT_BATCHES.find((b) => b.id === 'IMP-006');
  const loadSeed = (batch, opts = {}) => {
    const src = (batch && batch.rows.length > 0 ? batch : seedBatch).rows;
    const loaded = src.map((r) => {
      const data = { ...r.data };
      return { row: r.row, data, ...xiValidateRow(data) };
    });
    setReceipt(null);
    setRows(loaded);
    setErrorOnly(!!opts.errorOnly);
    setReveal(0);
    [1, 2, 3, 4].forEach((n, i) => setTimeout(() => setReveal(n), 160 + i * 420));
  };

  // 딥링크: 홈 '이어서 수정' 재진입 — batchId 프리필 + 오류만 보기 켬 (IDEA-16)
  useEffect(() => {
    const batchId = route && route.payload && route.payload.batchId;
    if (batchId) {
      const b = IMPORT_BATCHES.find((x) => x.id === batchId && x.kind === 'ORDER');
      if (b) {
        setFileName(`${b.id.toLowerCase()}_orders.xlsx`);
        setPlatform(b.platform === 'BANK' ? 'MANUAL' : b.platform);
        loadSeed(b, { errorOnly: true });
        window.toast(`배치 ${b.id} 재진입 — 오류만 보기 상태로 시작합니다`, { tone: 'warn' });
      }
    }
  }, []);

  useEffect(() => { if (edit && editRef.current) editRef.current.focus(); }, [edit]);

  // ── 집계 (검증 결과가 바뀔 때마다 즉시 재계산 — ★IDEA-01) ──
  const stats = useMemo(() => {
    if (!rows) return null;
    const ok = rows.filter((r) => r.status === 'OK');
    const dup = rows.filter((r) => r.status === 'DUP');
    const err = rows.filter((r) => r.status === 'ERROR');
    const salesTotal = ok.reduce((s, r) => s + Number(String(r.data.amount).replace(/,/g, '')), 0);
    return { total: rows.length, ok: ok.length, dup: dup.length, err: err.length, salesTotal };
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!rows) return [];
    return errorOnly ? rows.filter((r) => r.status !== 'OK') : rows;
  }, [rows, errorOnly]);

  // ── 엑셀 범위 Ctrl+V 붙여넣기 → 즉시 검증 (★IDEA-01 1순위 진입) ──
  const onPaste = (e) => {
    if (receipt) return;
    const text = e.clipboardData ? e.clipboardData.getData('text') : '';
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0 || !lines[0].includes('\t')) return;
    e.preventDefault();
    const parsed = lines.map((l, i) => {
      const c = l.split('\t');
      const data = { platformOrderNo: (c[0] || '').trim(), clientName: (c[1] || '').trim(), item: (c[2] || '').trim(), amount: (c[3] || '').trim(), orderedAt: (c[4] || '').trim() };
      return { row: i + 2, data, ...xiValidateRow(data) };
    });
    setFileName(null);
    setReceipt(null);
    setRows(parsed);
    setErrorOnly(false);
    setReveal(0);
    [1, 2, 3, 4].forEach((n, i) => setTimeout(() => setReveal(n), 160 + i * 420));
    window.toast(`클립보드 ${parsed.length}행 붙여넣기 — 즉시 검증했어요 (★IDEA-01)`);
  };

  // ── 오류 셀 인라인 수정 → 즉시 재검증 ──
  const errorCols = (r) => r.errors.map((e) => e.col);
  const startEdit = (idx, col, cur) => { setEdit({ idx, col }); setEditVal(String(cur == null ? '' : cur)); };
  const commitEdit = () => {
    if (!edit) return;
    const target = rows[edit.idx];
    const data = { ...target.data, [edit.col]: editVal.trim() };
    const next = { row: target.row, data, ...xiValidateRow(data) };
    setRows((rs) => rs.map((r, i) => (i === edit.idx ? next : r)));
    setEdit(null);
    if (next.status === 'OK') window.toast(`${next.row}행 재검증 — 정상 전환 · 카운트 갱신됨`);
    else if (next.status === 'ERROR') window.toast(`${next.row}행 재검증 — 오류 ${next.errors.length}건 남음`, { tone: 'warn' });
    else window.toast(`${next.row}행 재검증 — 중복(BS0004)으로 분류 · 등록에서 제외돼요`, { tone: 'warn' });
  };

  // ── 등록(커밋) — 전량 성공/전체 롤백, 배치 영수증 (★IDEA-01) ──
  const doRegister = () => {
    setConfirmOpen(false);
    const batchId = `IMP-${String(IMPORT_BATCHES.length + 1).padStart(3, '0')}`;
    setReceipt({ batchId, okRows: stats.ok, dupRows: stats.dup, errorRows: stats.err, salesTotal: stats.salesTotal });
    window.toast(`${stats.ok}건 등록 완료 (${batchId}) — 미배정 ${stats.ok}건`, {
      actionLabel: '지금 배정하기 →',
      onAction: () => navigate('assign', { batchId }),
      duration: 6500,
    });
  };

  const countChip = (label, value, color, idx) => {
    const tones = {
      slate: 'border-slate-700 text-slate-200',
      emerald: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
      rose: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
      amber: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    };
    return (
      <div
        className={`rounded-lg border px-4 py-2.5 transition-all duration-300 ${tones[color]} ${reveal >= idx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
      >
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-xl font-bold font-mono tabular-nums">{value}</div>
      </div>
    );
  };

  const registerReady = stats && stats.ok > 0;
  const allClean = stats && stats.err === 0;

  return (
    <div onPaste={onPaste} className="space-y-5">
      <PageHeader
        label="ORDERS · EXCEL IMPORT"
        title="주문 엑셀 업로드"
        desc="검증 → 오류 수정 → 등록의 2단계 리듬 — 등록은 전량 성공/전체 롤백입니다 (부분 등록 금지)"
        actions={
          <button onClick={() => window.toast('표준 양식 orders_template.xlsx 다운로드 (시뮬레이션)')} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm flex items-center gap-2">
            <Icon name="download" className="w-3.5 h-3.5" />표준 양식 다운로드
          </button>
        }
      />

      {/* ── 업로드 폼 ── */}
      {!receipt && (
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">플랫폼 <span className="text-rose-400">*</span></label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60">
                {XI_PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">귀속 부서 <span className="text-rose-400">*</span> <span className="text-slate-600">(초깃값: 내 부서)</span></label>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60">
                {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">귀속 프로젝트</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60">
                <option value="">선택 안 함</option>
                {PROJECTS.filter((p) => p.status !== 'CANCELLED').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) { setFileName(f.name); window.toast(`${f.name} 선택됨 — <검증>을 눌러 시작하세요`); }
            }} />
            <button onClick={() => fileRef.current && fileRef.current.click()} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm flex items-center gap-2">
              <Icon name="upload" className="w-3.5 h-3.5" />파일 선택
            </button>
            <span className="text-sm font-mono text-slate-400">{fileName || 'xlsx · 최대 10MB'}</span>
            <span className="text-xs text-slate-500 flex items-center gap-1.5 flex-1 min-w-[240px]">
              <Icon name="sparkles" className="w-3.5 h-3.5 text-purple-400" />
              엑셀 범위를 복사해 이 화면에 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">Ctrl+V</kbd> 하면 즉시 검증됩니다 (★IDEA-01)
            </span>
            <button onClick={() => { setFileName(fileName || 'orders_202607.xlsx'); loadSeed(null); }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-2">
              <Icon name="shieldCheck" className="w-4 h-4" />검증
            </button>
          </div>
        </Card>
      )}

      {/* ── 빈 상태 = 3단계 온보딩 (IDEA-18 · §4.7) ── */}
      {!rows && !receipt && (
        <EmptyState
          icon="upload"
          title="아직 검증한 내역이 없어요"
          description="검증 없이 등록할 수 없어요 — 아래 3단계면 첫 배치가 등록됩니다."
          steps={[
            { title: '템플릿 다운로드', desc: '표준 양식(xlsx)을 받아요' },
            { title: '채워서 드롭 · Ctrl+V', desc: '파일 선택 또는 범위 붙여넣기' },
            { title: '검증 후 등록', desc: '오류를 고치고 배치로 커밋' },
          ]}
          actionLabel="샘플 데이터로 검증 체험"
          onAction={() => { setFileName('orders_202607.xlsx'); loadSeed(null); }}
          secondaryLabel="표준 양식 다운로드"
          onSecondary={() => window.toast('표준 양식 orders_template.xlsx 다운로드 (시뮬레이션)')}
        />
      )}

      {/* ── 검증 결과 — 3분리 카운트 순차 등장 + 오류만 보기 (★IDEA-01) ── */}
      {rows && !receipt && stats && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center gap-3">
            <window.SectionLabel color="emerald">검증 결과</window.SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              {countChip('전체', stats.total, 'slate', 1)}
              {countChip('정상', stats.ok, 'emerald', 2)}
              {countChip('오류', stats.err, 'rose', 3)}
              {countChip('중복', stats.dup, 'amber', 4)}
            </div>
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={errorOnly} onChange={(e) => setErrorOnly(e.target.checked)} className="accent-purple-500 w-4 h-4" />
              오류만 보기
              <span className="font-mono text-xs text-slate-500">({stats.err + stats.dup})</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th className="px-5 py-2.5 font-medium">행</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  {XI_COLS.map((c) => <th key={c.key} className={`px-3 py-2.5 font-medium ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}
                  <th className="px-5 py-2.5 font-medium">사유 / 조치</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr><td colSpan={XI_COLS.length + 3} className="px-5 py-8 text-center text-sm text-slate-500">표시할 행이 없어요 — 오류·중복이 모두 해소됐습니다 ✓</td></tr>
                )}
                {visibleRows.map((r) => {
                  const idx = rows.indexOf(r);
                  const errs = errorCols(r);
                  return (
                    <tr key={r.row} className={`border-b border-slate-800/60 ${r.status === 'ERROR' ? 'bg-rose-500/[0.04]' : r.status === 'DUP' ? 'bg-amber-500/[0.04]' : ''}`}>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{r.row}</td>
                      <td className="px-3 py-2.5"><EnumPill status={r.status} /></td>
                      {XI_COLS.map((c) => {
                        const isErr = errs.includes(c.key);
                        const cur = r.data[c.key];
                        if (edit && edit.idx === idx && edit.col === c.key) {
                          return (
                            <td key={c.key} className="px-3 py-1.5">
                              <input
                                ref={editRef} value={editVal} onChange={(e) => setEditVal(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEdit(null); }}
                                className="w-32 rounded-md bg-slate-950 border border-purple-500/70 px-2 py-1 text-xs font-mono outline-none"
                              />
                            </td>
                          );
                        }
                        if (isErr) {
                          return (
                            <td key={c.key} className={`px-3 py-2.5 ${c.right ? 'text-right' : ''}`}>
                              <button onClick={() => startEdit(idx, c.key, cur)}
                                title="셀 클릭 → 인라인 수정 → 즉시 재검증"
                                className="inline-flex items-center gap-1 rounded-md border border-rose-500/50 bg-rose-500/15 text-rose-300 px-2 py-1 text-xs font-mono hover:bg-rose-500/25">
                                <Icon name="edit" className="w-3 h-3" />{String(cur || '').trim() || '(비어 있음)'}
                              </button>
                            </td>
                          );
                        }
                        return (
                          <td key={c.key} className={`px-3 py-2.5 ${c.right ? 'text-right' : ''} ${c.mono ? 'font-mono text-xs text-slate-400' : 'text-slate-200'}`}>
                            {c.key === 'amount'
                              ? <Money value={Number(String(cur).replace(/,/g, ''))} />
                              : (String(cur || '').trim() || <span className="text-slate-600">—</span>)}
                          </td>
                        );
                      })}
                      <td className="px-5 py-2.5 text-xs max-w-[280px]">
                        {r.status === 'OK' && <span className="text-slate-600">—</span>}
                        {r.status === 'DUP' && <span className="text-amber-300">{r.cause} · 등록에서 제외</span>}
                        {r.status === 'ERROR' && (
                          <div className="space-y-0.5">
                            {r.errors.map((e, i) => (
                              <div key={i} className="text-rose-300">{r.row}행 {XI_COLS.find((c) => c.key === e.col).label} — {e.cause}</div>
                            ))}
                            <div className="text-slate-500">오류 셀을 클릭해 바로 고칠 수 있어요</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── 커밋 전 총계 대조 카드 (★IDEA-01) ── */}
          <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/40">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <window.SectionLabel color="purple">등록 요약 — 커밋 전 총계 대조</window.SectionLabel>
              <div className="text-sm text-slate-300">
                신규 <b className="font-mono text-emerald-300">{stats.ok}</b>건
                <span className="text-slate-600 mx-1.5">·</span>중복 제외 <b className="font-mono text-amber-300">{stats.dup}</b>건
                <span className="text-slate-600 mx-1.5">·</span>오류 제외 <b className="font-mono text-rose-300">{stats.err}</b>건
              </div>
              <div className="text-sm text-slate-400">등록될 매출 합계 <Money value={stats.salesTotal} size="md" className="ml-1" /></div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => window.toast(`오류 행 ${stats.err}건 xlsx 다운로드 (시뮬레이션)`)} disabled={stats.err === 0}
                  className={`px-3 py-2 rounded-lg text-sm border flex items-center gap-2 ${stats.err === 0 ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'}`}>
                  <Icon name="download" className="w-3.5 h-3.5" />오류 행 다운로드
                </button>
                <button onClick={() => setConfirmOpen(true)} disabled={!registerReady}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition ${
                    !registerReady ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : `bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 ${allClean ? 'animate-pulse shadow-lg shadow-purple-500/30' : ''}`
                  }`}>
                  <Icon name="check" className="w-4 h-4" />등록 ({stats.ok}건)
                </button>
              </div>
            </div>
            {!allClean && <p className="text-[11px] text-slate-500 mt-2">오류 {stats.err}건을 수정하면 [등록] 버튼이 펄스로 활성 강조됩니다 — 오류·중복 행은 등록에 포함되지 않아요</p>}
          </div>
        </Card>
      )}

      {/* ── 등록 완료 — 배치 IMP-nnn 영수증 (★IDEA-01) ── */}
      {receipt && (
        <Card className="p-6 !border-emerald-500/40">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Icon name="receipt" className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <window.SectionLabel color="emerald">등록 완료 — 배치 영수증</window.SectionLabel>
              <div className="text-2xl font-bold font-mono mt-1">{receipt.batchId}</div>
              <p className="text-sm text-slate-400 mt-1">전량 성공으로 커밋되었습니다 — 원본 파일과 함께 배치 상세에서 영구 조회할 수 있어요</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">등록</div><div className="text-lg font-bold font-mono text-emerald-300">{receipt.okRows}건</div></div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">중복 제외 (BS0004)</div><div className="text-lg font-bold font-mono text-amber-300">{receipt.dupRows}건</div></div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">오류 제외</div><div className="text-lg font-bold font-mono text-rose-300">{receipt.errorRows}건</div></div>
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"><div className="text-[11px] text-slate-500">등록된 매출 합계</div><Money value={receipt.salesTotal} size="md" /></div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs font-mono text-slate-500">
                <div className="flex items-center gap-2"><Icon name="check" className="w-3 h-3 text-emerald-400" />BATCH_COMMITTED · {receipt.batchId} · {TODAY}</div>
                <div className="flex items-center gap-2"><Icon name="check" className="w-3 h-3 text-emerald-400" />ORDER_CREATED × {receipt.okRows} · 매출 이벤트 PAYMENT 적재 (BS0001)</div>
                <div className="flex items-center gap-2"><Icon name="check" className="w-3 h-3 text-emerald-400" />AUDIT_LOG 기록 · 알림 발송 (비동기)</div>
              </div>
              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => navigate('assign', { batchId: receipt.batchId })} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center gap-2">
                  미배정 {receipt.okRows}건 지금 배정하기<Icon name="arrowRight" className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => navigate('orders')} className="px-4 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200">주문 목록 보기</button>
                <button onClick={() => { setReceipt(null); setRows(null); setFileName(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200">새 업로드</button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── 최근 수집 배치 — 배치 상세 영구 조회 (★IDEA-01) ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <window.SectionLabel color="slate">최근 주문 수집 배치</window.SectionLabel>
          <span className="text-[11px] text-slate-500">배치를 클릭하면 행 상세를 다시 불러옵니다</span>
        </div>
        <div className="space-y-1.5">
          {IMPORT_BATCHES.filter((b) => b.kind === 'ORDER').map((b) => (
            <button key={b.id} onClick={() => {
              if (b.rows.length > 0) { setFileName(`${b.id.toLowerCase()}.xlsx`); loadSeed(b, { errorOnly: b.errorRows > 0 }); window.toast(`배치 ${b.id} 행 상세를 불러왔어요`); }
              else window.toast('행 상세가 보관된 배치만 다시 불러올 수 있어요', { tone: 'warn' });
            }}
              className="w-full flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left hover:border-purple-500/40 transition">
              <span className="font-mono text-xs text-slate-400 w-16 shrink-0">{b.id}</span>
              <EnumPill status={b.status} />
              {b.fallbackOf && <span className="text-[10px] text-amber-300 font-mono">↩ {b.fallbackOf} 대체</span>}
              <span className="text-xs text-slate-500 truncate flex-1">{b.note || `${b.source} 자동 수집`}</span>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                <span className="text-emerald-400">{b.okRows}</span>/<span className="text-amber-400">{b.dupRows}</span>/<span className="text-rose-400">{b.errorRows}</span>
              </span>
              <span className="text-[11px] text-slate-600 font-mono shrink-0">{b.collectedAt}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* ── 배치 등록 확인 — mid 마찰: 총계 대조 재표시 (§4.6) ── */}
      <ConfirmDialog
        open={confirmOpen}
        risk="mid"
        title="배치 등록"
        message={`정상 ${stats ? stats.ok : 0}건을 주문으로 등록합니다 — 전량 성공/전체 롤백 (부분 등록 금지)`}
        summary={stats && (
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">신규 등록</span><span className="font-mono text-emerald-300">{stats.ok}건</span></div>
            <div className="flex justify-between"><span className="text-slate-400">중복 제외 (BS0004)</span><span className="font-mono text-amber-300">{stats.dup}건</span></div>
            <div className="flex justify-between"><span className="text-slate-400">오류 제외</span><span className="font-mono text-rose-300">{stats.err}건</span></div>
            <div className="flex justify-between border-t border-slate-800 pt-1 mt-1"><span className="text-slate-300 font-medium">등록될 매출 합계</span><Money value={stats.salesTotal} /></div>
          </div>
        )}
        confirmLabel="등록 확정"
        onConfirm={doRegister}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

window.ExcelImport = ExcelImport;
