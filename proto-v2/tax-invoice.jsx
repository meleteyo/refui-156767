// tax-invoice.jsx — 27 세금계산서 발행 요청 (route: taxInvoice)
// IDEA-15 ASP(팝빌·바로빌) 미러 폼 + 전체 복사 + 승인번호 붙여넣기 완료 갱신 / IDEA-16 정산 확정 릴레이 진입
// 발행 대상은 CONFIRMED 정산만 (MG1003) · 공급가액·세액 직접 수정 불가 (P1)
const { useState, useMemo, useEffect } = React;

// 정산 건 → 공급받는자 마스터 (거래처 사업자 정보 — data.js에 없어 로컬 보강)
const BIZ_OF = {
  'SET-2607-04': { bizNo: '214-86-30172', clientName: '주식회사 모두의반찬' },
  'SET-2606-01': { bizNo: '113-81-44821', clientName: '라온뷰티 주식회사' },
  'SET-2606-02': { bizNo: '220-87-59102', clientName: '그린리프상사' },
};
const DEPT_NAME = (id) => (DEPARTMENTS.find((d) => d.id === id) || {}).name || id;

function TaxInvoice({ route, navigate, tweaks }) {
  const { Card, PageHeader, EnumPill, Money, LockBadge, ConfirmDialog, Icon, fmt } = window;

  const confirmed = useMemo(() => SETTLEMENTS.filter((s) => s.status === 'CONFIRMED'), []);
  const [invoices, setInvoices] = useState(TAX_INVOICES.map((t) => ({ ...t, settlementId: null })));
  const [setId, setSetId] = useState(route?.payload?.settlementId || confirmed[0]?.id || '');
  const [issueDate, setIssueDate] = useState('');
  const [itemName, setItemName] = useState('');
  const [remark, setRemark] = useState('');
  const [selInv, setSelInv] = useState(route?.payload?.invoiceId || null);
  const [ntsNo, setNtsNo] = useState('');
  const [cancelDlg, setCancelDlg] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [seq, setSeq] = useState(4);
  const [polledAt, setPolledAt] = useState('11:30:00');

  // 딥링크: 정산 확정(25) 릴레이 진입 시 정산 건 프리필 (IDEA-16)
  useEffect(() => {
    if (route?.payload?.settlementId) setSetId(route.payload.settlementId);
    if (route?.payload?.invoiceId) setSelInv(route.payload.invoiceId);
  }, [route?.payload?.settlementId, route?.payload?.invoiceId]);

  const sel = confirmed.find((s) => s.id === setId);
  const biz = BIZ_OF[setId] || { bizNo: '000-00-00000', clientName: sel ? `${sel.target} 주요 거래처` : '—' };
  const supply = sel ? sel.snapshot.orderAmount - sel.snapshot.refundAmount + sel.snapshot.repaymentAmount : 0;
  const vat = Math.round(supply * 0.1);
  const total = supply + vat;

  // 정산 건 변경 시 작성일자·품목 초깃값 자동 채움
  useEffect(() => {
    if (!sel) return;
    const [y, m] = sel.period.split('-');
    const last = new Date(Number(y), Number(m), 0).getDate();
    setIssueDate(`${sel.period}-${last}`);
    setItemName(`${sel.period} ${sel.target} 마케팅 용역`);
  }, [setId]);

  // 30초 폴링 시뮬레이션 — 상태 집계 갱신 시각 표기 (§6.1-4)
  useEffect(() => {
    const t = setInterval(() => {
      setPolledAt((p) => {
        const [h, m, s2] = p.split(':').map(Number);
        const d = new Date(2026, 6, 10, h, m, s2 + 30);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      });
    }, 30000);
    return () => clearInterval(t);
  }, []);

  // 이중 발행 차단 — 같은 정산 건의 '요청' 상태 존재 여부
  const dupReq = invoices.find((t) => t.settlementId === setId && t.status === 'REQUESTED');

  const copyText = (text, label) => {
    if (navigator.clipboard) navigator.clipboard.writeText(String(text));
    window.toast(`${label} 복사됨 — ASP 입력 화면에 붙여넣으세요 (IDEA-15)`);
  };
  const copyAll = () => {
    copyText([biz.bizNo, biz.clientName, itemName, supply, vat, total, issueDate].join('\t'), '발행 정보 전체(탭 구분)');
  };

  const register = () => {
    if (!sel || dupReq) return;
    const id = `TAX-2607-${String(seq).padStart(2, '0')}`;
    setSeq((n) => n + 1);
    setInvoices((list) => [{
      id, clientName: biz.clientName, orderId: null, settlementId: setId,
      supplyAmount: supply, vat, totalAmount: total, status: 'REQUESTED',
      issueNo: null, requestedAt: `${TODAY} 11:40`, issuedAt: null, requesterId: CURRENT_USER_ID,
      memo: `${itemName}${remark ? ` · ${remark}` : ''}`,
    }, ...list]);
    setSelInv(id);
    window.toast(`발행 요청 ${id} 등록 완료 — ASP 발행 후 승인번호를 붙여넣어 완료 처리하세요`, {
      actionLabel: '발행 정보 전체 복사', onAction: copyAll,
    });
  };

  // 발행완료 처리 (taxInvoice1002) — 승인번호 필수, 정산 건 자동 연결
  const complete = () => {
    if (!selected || selected.status !== 'REQUESTED') return;
    if (!ntsNo.trim()) { window.toast('국세청 승인번호를 먼저 붙여넣어 주세요', { tone: 'warn' }); return; }
    setInvoices((list) => list.map((t) => t.id === selInv
      ? { ...t, status: 'ISSUED', issueNo: ntsNo.trim(), issuedAt: `${TODAY} 11:42` } : t));
    setNtsNo('');
    window.toast(`${selInv} 발행완료 — 정산 건 자동 연결 · 감사 로그 기록 (MG1004)`, {
      actionLabel: '변경 이력 보기 →', onAction: () => navigate('auditLog'),
    });
  };

  const doCancel = () => {
    if (!cancelReason.trim()) { window.toast('취소 사유를 입력해 주세요 — 사유 없이 취소할 수 없어요', { tone: 'warn' }); return; }
    setInvoices((list) => list.map((t) => (t.id === selInv ? { ...t, status: 'CANCELLED', memo: `취소 — ${cancelReason}` } : t)));
    setCancelDlg(false); setCancelReason('');
    window.toast('요청이 취소되었습니다 — 정산·매출 데이터는 변경되지 않습니다 (BS0006)');
  };

  // 발행 후 정산 변동 감지 — amber 배지 (합의 4, 수정세금계산서는 Phase 2)
  const settlementDrift = (t) => {
    if (t.status === 'REQUESTED' || t.status === 'CANCELLED' || !t.issuedAt) return false;
    const order = ORDERS.find((o) => o.id === t.orderId);
    const st = order ? SETTLEMENTS.find((s) => s.deptId === order.deptId && s.period === '2026-07') : null;
    return !!(st && st.recalcHistory.some((h) => h.at > t.issuedAt));
  };

  const selected = invoices.find((t) => t.id === selInv);
  const counts = {
    REQUESTED: invoices.filter((t) => t.status === 'REQUESTED').length,
    ISSUED: invoices.filter((t) => t.status === 'ISSUED' || t.status === 'DELIVERED').length,
    CANCELLED: invoices.filter((t) => t.status === 'CANCELLED').length,
  };
  const settlementLabel = (t) => {
    if (t.settlementId) { const s = SETTLEMENTS.find((x) => x.id === t.settlementId); return s ? `${s.period} ${s.target}` : t.settlementId; }
    const o = ORDERS.find((x) => x.id === t.orderId);
    return o ? `${o.orderedAt.slice(0, 7)} ${DEPT_NAME(o.deptId)}` : '—';
  };

  const CopyIcon = ({ value, label }) => (
    <button onClick={() => copyText(value, label)} title={`${label} 복사`} className="p-1 rounded text-slate-500 hover:text-cyan-300 hover:bg-slate-800">
      <Icon name="copy" className="w-3 h-3" />
    </button>
  );
  const ReadField = ({ label, children, copyValue, copyLabel }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2">
      <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
      <span className="flex items-center gap-1 min-w-0">{children}{copyValue != null && <CopyIcon value={copyValue} label={copyLabel || label} />}</span>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <PageHeader
        label="FINANCE · TAX INVOICE" labelColor="emerald"
        title="세금계산서 발행 요청"
        desc="필드 배치가 ASP(팝빌·바로빌) 입력 순서와 1:1 미러 — 전체 복사로 이중 입력을 제거합니다 (IDEA-15)"
        actions={
          <span className="relative group">
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-cyan-500/15 text-cyan-300 border-cyan-500/30 px-2.5 py-1.5 text-xs font-medium cursor-not-allowed opacity-80">
              <Icon name="zap" className="w-3 h-3" />API 자동 발행 — Phase 2 예정
            </span>
            <span className="absolute z-50 hidden group-hover:block top-full right-0 mt-1.5 w-64 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-3 text-left text-xs text-slate-300">
              ASP 벤더 계약 확정 후 이 자리의 복사 버튼이 자동 발행 버튼으로 승격됩니다
            </span>
          </span>
        }
      />

      {/* 신규 발행 요청 — ASP 미러 폼 */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">신규 발행 요청</h3>
          <span className="text-[11px] text-slate-500">필드 순서 = ASP 입력 화면 미러 (IDEA-15)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1.5">정산 건 <span className="text-rose-400">*</span> <span className="text-slate-600">— 확정 정산만 선택 가능 (MG1003)</span></label>
            <div className="flex items-center gap-2">
              <select value={setId} onChange={(e) => setSetId(e.target.value)}
                className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-emerald-500/60 outline-none">
                {confirmed.map((s) => (
                  <option key={s.id} value={s.id}>{s.period} {s.target} 정산 (확정 {s.confirmedAt?.slice(0, 10)})</option>
                ))}
              </select>
              {sel && <LockBadge date={sel.confirmedAt?.slice(0, 10)} reason="확정 정산 — 금액 원본 불변" />}
            </div>
          </div>
          <ReadField label="사업자번호" copyValue={biz.bizNo} copyLabel="사업자번호">
            <span className="font-mono text-sm text-slate-200">{biz.bizNo}</span>
          </ReadField>
          <ReadField label="상호 (자동 채움)" copyValue={biz.clientName} copyLabel="상호">
            <span className="text-sm text-slate-200 truncate">{biz.clientName}</span>
          </ReadField>
          <ReadField label="공급가액 (자동 — 확정 매출 합계)" copyValue={supply} copyLabel="공급가액">
            <Money value={supply} locked formula={sel ? [
              { label: '결제 합계', value: sel.snapshot.orderAmount },
              { label: '환불', value: -sel.snapshot.refundAmount },
              { label: '재결제', value: sel.snapshot.repaymentAmount },
            ] : null} />
          </ReadField>
          <ReadField label="세액 (공급가액 × 10%)" copyValue={vat} copyLabel="세액">
            <Money value={vat} />
          </ReadField>
          <ReadField label="합계" copyValue={total} copyLabel="합계">
            <span className="inline-flex items-center gap-1.5">
              <Money value={total} size="md" />
              <span title={`공급가액 + 세액 검산 통과 · 집계 기준 ${AGGREGATED_AT}`} className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300 cursor-help">
                <Icon name="check" className="w-3 h-3" />검산
              </span>
            </span>
          </ReadField>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">작성일자 <span className="text-rose-400">*</span></label>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono focus:border-emerald-500/60 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">품목 <span className="text-rose-400">*</span></label>
            <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-emerald-500/60 outline-none" />
          </div>
          <div className="col-span-2 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1.5">비고</label>
              <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="예: 인플루언서 캠페인 포함"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-emerald-500/60 outline-none" />
            </div>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Icon name="lock" className="w-3 h-3" />
          공급가액·세액은 직접 수정 불가 — 금액이 다르면 조정 결재 경유 후 재요청하세요 (MG1003)
          <button onClick={() => navigate('draft', { settlementId: setId, type: 'SETTLEMENT_ADJUST' })} className="text-purple-300 hover:underline">조정 기안 작성 →</button>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
          <button onClick={copyAll}
            className="px-3.5 py-2 rounded-lg text-sm text-slate-200 bg-slate-800 hover:bg-slate-700 inline-flex items-center gap-1.5">
            <Icon name="copy" className="w-3.5 h-3.5" />발행 정보 전체 복사
          </button>
          <span className="relative group">
            <button onClick={register} disabled={!sel || !!dupReq}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                !sel || dupReq ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'}`}>
              발행 요청 등록
            </button>
            {dupReq && (
              <span className="absolute z-50 hidden group-hover:block bottom-full right-0 mb-1.5 w-64 rounded-lg bg-slate-800 border border-slate-600 shadow-2xl p-3 text-left text-xs text-slate-300">
                이 정산 건에 이미 '요청' 상태 건이 있어요 — <button onClick={() => setSelInv(dupReq.id)} className="font-mono text-cyan-300 hover:underline">{dupReq.id}</button> (이중 발행 차단)
              </span>
            )}
          </span>
        </div>
      </Card>

      {/* 발행 요청 현황 */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h3 className="font-semibold text-sm">
            발행 요청 현황
            <span className="ml-3 text-xs font-normal text-slate-400">
              요청 <b className="text-amber-300 font-mono">{counts.REQUESTED}</b> ·
              발행완료 <b className="text-emerald-300 font-mono"> {counts.ISSUED}</b> ·
              취소 <b className="text-slate-300 font-mono"> {counts.CANCELLED}</b>
            </span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">30초 자동 갱신 · 마지막 {polledAt}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-5 py-2 font-medium w-8"></th>
                <th className="px-2 py-2 font-medium">요청번호</th>
                <th className="px-3 py-2 font-medium">정산 건</th>
                <th className="px-3 py-2 font-medium">공급받는자</th>
                <th className="px-3 py-2 font-medium text-right">합계 금액</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-5 py-2 font-medium">승인번호</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((t) => (
                <tr key={t.id} onClick={() => setSelInv(t.id)}
                  className={`border-b border-slate-800/60 cursor-pointer transition hover:bg-slate-800/30 ${selInv === t.id ? 'bg-emerald-500/[0.07]' : ''}`}>
                  <td className="px-5 py-3">
                    <span className={`w-3.5 h-3.5 rounded-full border inline-flex items-center justify-center ${selInv === t.id ? 'border-emerald-400' : 'border-slate-600'}`}>
                      {selInv === t.id && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-400">{t.id}</td>
                  <td className="px-3 py-3 text-xs text-slate-300">
                    {settlementLabel(t)}
                    {settlementDrift(t) && (
                      <span title="발행 후 정산 재계산 이력 발생 — 수정세금계산서는 Phase 2 (안내만)" className="ml-1.5 inline-flex items-center gap-1 rounded border bg-amber-500/15 text-amber-300 border-amber-500/30 px-1.5 py-0.5 text-[10px] cursor-help">
                        <Icon name="alert" className="w-2.5 h-2.5" />정산 변동
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-300">{t.clientName}</td>
                  <td className="px-3 py-3 text-right"><Money value={t.totalAmount} formula={[{ label: '공급가액', value: t.supplyAmount }, { label: '세액 (10%)', value: t.vat }]} /></td>
                  <td className="px-3 py-3"><EnumPill status={t.status} /></td>
                  <td className="px-5 py-3 font-mono text-[11px] text-slate-400">{t.issueNo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 선택 건 처리 */}
        <div className="px-5 py-3.5 bg-slate-950/40 border-t border-slate-800 flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-400 shrink-0">선택 건 처리 {selected ? <span className="font-mono text-slate-300">{selected.id}</span> : '— 행을 선택하세요'}</span>
          <input type="text" value={ntsNo} onChange={(e) => setNtsNo(e.target.value)}
            placeholder="국세청 승인번호 붙여넣기 (예: 20260710-41000012-…)"
            disabled={!selected || selected.status !== 'REQUESTED'}
            className="flex-1 min-w-[240px] rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs font-mono focus:border-emerald-500/60 outline-none disabled:opacity-40" />
          <button onClick={complete} disabled={!selected || selected.status !== 'REQUESTED'}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold text-white ${
              selected && selected.status === 'REQUESTED' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
            발행완료 처리
          </button>
          <button onClick={() => setCancelDlg(true)} disabled={!selected || selected.status !== 'REQUESTED'}
            title={selected && selected.status !== 'REQUESTED' ? '발행완료 건은 취소 불가 — 수정세금계산서는 Phase 2' : ''}
            className="px-3.5 py-2 rounded-lg text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
            요청 취소
          </button>
        </div>
      </Card>

      {/* 요청 취소 — 사유 필수 (중위험 §4.6 · BS0006) */}
      <ConfirmDialog
        open={cancelDlg} risk="mid" danger
        title={`${selInv || ''} 발행 요청 취소`}
        message="취소해도 정산·매출 데이터는 변경되지 않습니다 (BS0006). 사유는 감사 로그에 기록됩니다 (MG1004)."
        summary={selected ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{selected.clientName} · {settlementLabel(selected)}</span>
            <Money value={selected.totalAmount} />
          </div>
        ) : null}
        confirmLabel="요청 취소"
        onConfirm={doCancel}
        onClose={() => { setCancelDlg(false); setCancelReason(''); }}
      >
        <div className="mb-3">
          <label className="block text-xs text-slate-400 mb-1.5">취소 사유 <span className="text-rose-400">*</span></label>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2}
            placeholder="예: 공급가액 조정 결재 진행으로 재요청 예정"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:border-rose-400/60 outline-none" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

window.TaxInvoice = TaxInvoice;
