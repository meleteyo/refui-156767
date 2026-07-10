// settlement.jsx — 06 정산 관리
// 기간 × 대상 손익 정산. profit = orderAmount − refundAmount − platformFee − outsourcingCost (BS0001)
// CONFIRMED 이후 직접 수정 금지 — 조정 이벤트로만 반영 (MG1003). 환불은 매출 이벤트(−) 적재로 기록 (ADR-002)
const { useState: useState_st, useEffect: useEffect_st, useMemo: useMemo_st } = React;

// 세금계산서 상태 — 1차 범위: 발행 요청·상태 관리 (ASP 연동 Phase 2)
const TAX_META = {
  REQUESTED: { label: "요청됨",   bg: "bg-amber-500/15",   text: "text-amber-300",   dot: "bg-amber-400" },
  ISSUED:    { label: "발행완료", bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
};
function TaxPill({ status }) {
  const c = TAX_META[status] || TAX_META.REQUESTED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md ${c.bg} ${c.text} px-2 py-0.5 text-xs font-medium whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`}></span>{c.label}
    </span>
  );
}

function Settlement({ tweaks, navigate }) {
  const [period, setPeriod] = useState_st("2026-07");
  const [detail, setDetail] = useState_st(null);   // 선택 정산 row

  // Esc → 상세 패널 닫기
  useEffect_st(() => {
    const onKey = (e) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = window.SETTLEMENTS.filter(s => s.period === period);

  // 상단 요약 — 기간 정산 합산 (총매출/환불/외주비/손익)
  const sum = rows.reduce((a, s) => ({
    orderAmount: a.orderAmount + s.orderAmount,
    refundAmount: a.refundAmount + s.refundAmount,
    platformFee: a.platformFee + s.platformFee,
    outsourcingCost: a.outsourcingCost + s.outsourcingCost,
    profit: a.profit + s.profit,
  }), { orderAmount: 0, refundAmount: 0, platformFee: 0, outsourcingCost: 0, profit: 0 });

  const profitMax = Math.max(1, ...rows.map(s => s.profit));

  // 손익 계산 단계 (공식 라인 — 데이터 검산 포함)
  const formulaOf = (s) => {
    const afterRefund = s.orderAmount - s.refundAmount;
    const afterFee = afterRefund - s.platformFee;
    const computed = afterFee - s.outsourcingCost;
    return [
      { label: "주문금액",     value: s.orderAmount,       sign: "+", running: s.orderAmount },
      { label: "환불",         value: s.refundAmount,      sign: "−", running: afterRefund },
      { label: "플랫폼수수료", value: s.platformFee,       sign: "−", running: afterFee },
      { label: "외주비",       value: s.outsourcingCost,   sign: "−", running: computed },
    ].concat([{ label: "손익", value: computed, sign: "=", running: computed, isResult: true, matches: computed === s.profit }]);
  };

  // 근거 이벤트 — 이 정산의 환불 합계를 구성하는 매출 이벤트(−) (SALES_EVENTS 원장 추적)
  const refundEventsOf = (s) => {
    if (!s.refundAmount) return [];
    return window.SALES_EVENTS.filter(e =>
      (e.type === "PARTIAL_REFUND" || e.type === "FULL_REFUND") && Math.abs(e.amount) === s.refundAmount
    );
  };
  const orderOf = (id) => window.ORDERS.find(o => o.id === id);
  const approvalOf = (id) => window.APPROVALS.find(a => a.id === id);

  // 재계산 이력 — recalcCount 기반 목업 (최신순). 환불 승인 반영 건은 실제 APR 참조
  const recalcHistoryOf = (s) => {
    const out = [];
    const rev = refundEventsOf(s);
    if (s.recalcCount >= 1 && rev.length) {
      const e = rev[0]; const apr = approvalOf(e.approvalId);
      out.push({
        seq: s.recalcCount, at: e.occurredAt,
        reason: `${window.APPROVAL_TYPE_LABELS[apr?.type] || "환불"} 승인 반영`,
        ref: e.approvalId,
        note: `순매출 −₩${window.fmt(Math.abs(e.amount))} · 미수행 작업 외주비 제외 (BS0002)`,
      });
    }
    // 나머지 재계산 슬롯은 배정 단가 스냅샷 반영으로 채움 (APR 미참조 — 날조 금지)
    let filled = out.length;
    const bases = [
      { at: `${s.period}-05 18:00`, reason: "배정 단가 스냅샷 반영", note: "활성 배정 rate_snapshot 합산 갱신 (BS0007)" },
      { at: `${s.period}-01 09:00`, reason: "정산 최초 집계",       note: "기간 매출 이벤트 원장 초기 산출" },
    ];
    for (let i = 0; filled < s.recalcCount && i < bases.length; i++, filled++) {
      out.push({ seq: s.recalcCount - filled, at: bases[i].at, reason: bases[i].reason, ref: null, note: bases[i].note });
    }
    return out;
  };

  // 지급 명세서 미리보기 — 프리랜서별 (AI 파싱 검수 건은 마스킹 계좌 노출)
  const parseJobOf = (name) => window.AI_PARSE_JOBS.find(j => j.extracted.name === name);
  const payoutTotal = window.FREELANCERS.reduce((a, f) => a + f.monthSettlement, 0);

  // 전자세금계산서 — 프리랜서 지급 기준 발행 요청/상태 (1차: 요청·상태 관리)
  const taxRows = [
    { fid: "FR-103", status: "ISSUED" },
    { fid: "FR-105", status: "REQUESTED" },
    { fid: "FR-101", status: "REQUESTED" },
  ].map(t => {
    const f = window.FREELANCERS.find(x => x.id === t.fid);
    const job = parseJobOf(f.name);
    return { ...t, name: f.name, specialty: f.specialty, amount: f.monthSettlement, bank: job?.bank || null };
  });

  const SummaryTile = ({ label, value, tone, sub }) => (
    <window.Card className={`col-span-6 lg:col-span-3 p-5 ${tone === "rose" ? "!bg-rose-950 !border-rose-700" : tone === "emerald" ? "!bg-emerald-950 !border-emerald-700" : ""}`}>
      <div className={`text-xs mb-1 ${tone === "rose" ? "text-rose-200 font-medium" : tone === "emerald" ? "text-emerald-200 font-medium" : "text-slate-400"}`}>{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone === "rose" ? "text-rose-50" : tone === "emerald" ? "text-emerald-50" : ""}`}>₩{window.fmt(value)}</div>
      <div className={`mt-1 text-[11px] ${tone === "rose" ? "text-rose-200/70" : tone === "emerald" ? "text-emerald-200/70" : "text-slate-500"}`}>{sub}</div>
    </window.Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="emerald">SETTLEMENT · 정산 · 재무</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">정산 관리</h1>
          <p className="text-sm text-slate-300 mt-1">손익 = 주문금액 − 환불 − 플랫폼수수료 − 외주비 · 환불 승인 시 정산 재계산이 자동 반영됩니다</p>
        </div>
        <div className="flex items-center gap-1 text-xs p-0.5 rounded-md bg-white/5 border border-white/10">
          {["2026-06", "2026-07"].map(p => (
            <button key={p} onClick={() => { setPeriod(p); setDetail(null); }}
              className={`px-3 py-1.5 rounded font-medium tabular-nums ${period === p ? 'bg-emerald-500/25 text-emerald-200' : 'text-slate-400 hover:text-slate-200'}`}>{p}</button>
          ))}
        </div>
      </div>

      {/* 요약 4타일 — 총매출 / 환불(차감) / 외주비 / 손익(강조) */}
      <div className="grid grid-cols-12 gap-4">
        <SummaryTile label="총 주문 매출" value={sum.orderAmount} sub={`${period} · 정산 ${rows.length}건 합산`} />
        <SummaryTile label="환불 반영" value={sum.refundAmount} tone="rose" sub="매출 이벤트(−) 원장 적재 (ADR-002)" />
        <SummaryTile label="외주비 (지급)" value={sum.outsourcingCost} sub={`플랫폼 수수료 ₩${window.fmt(sum.platformFee)} 별도`} />
        <SummaryTile label="정산 손익" value={sum.profit} tone="emerald" sub="주문 − 환불 − 수수료 − 외주비" />
      </div>

      {/* 정산 목록 */}
      <window.Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold">기간 정산 <span className="text-emerald-300 font-bold ml-1">{rows.length}</span></h3>
            <div className="text-xs text-slate-500 mt-0.5">행 클릭 시 계산 근거 · 근거 이벤트 · 재계산 이력 상세</div>
          </div>
          <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm flex items-center gap-2">
            <window.Icon name="download" className="w-3.5 h-3.5" />정산표 내보내기
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center"><window.Icon name="db" className="w-6 h-6 text-slate-500" /></div>
            <div className="text-slate-300 font-medium">{period} 정산 데이터 없음</div>
            <div className="text-xs text-slate-500 max-w-xs">해당 기간에 확정·진행 중인 정산이 없습니다. 상단 기간 칩에서 <b className="text-emerald-300">2026-07</b>을 선택해 주세요.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/5">
                  <th className="px-6 py-2.5 font-medium">정산 번호</th>
                  <th className="px-3 py-2.5 font-medium">대상 · 기간</th>
                  <th className="px-3 py-2.5 font-medium text-right">주문금액</th>
                  <th className="px-3 py-2.5 font-medium text-right">환불</th>
                  <th className="px-3 py-2.5 font-medium text-right">수수료</th>
                  <th className="px-3 py-2.5 font-medium text-right">외주비</th>
                  <th className="px-3 py-2.5 font-medium text-right">손익</th>
                  <th className="px-3 py-2.5 font-medium">상태</th>
                  <th className="px-6 py-2.5 font-medium text-right">재계산</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id} onClick={() => setDetail(s)} className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition ${detail?.id === s.id ? 'bg-emerald-500/10' : ''}`}>
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">{s.id}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-xs">{s.target}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">{s.period}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">₩{window.fmt(s.orderAmount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">{s.refundAmount > 0 ? <span className="text-rose-300">−₩{window.fmt(s.refundAmount)}</span> : <span className="text-slate-600">—</span>}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-400">−₩{window.fmt(s.platformFee)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs text-slate-400">−₩{window.fmt(s.outsourcingCost)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-emerald-300">₩{window.fmt(s.profit)}</td>
                    <td className="px-3 py-3"><window.EnumPill status={s.status} /></td>
                    <td className="px-6 py-3 text-right">
                      <span className={`text-xs tabular-nums ${s.recalcCount > 0 ? 'text-amber-300' : 'text-slate-600'}`}>재계산 {s.recalcCount}회</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <window.Icon name="shieldCheck" className="w-3 h-3 text-emerald-400" />
            확정(CONFIRMED) 정산의 소급 변경은 결재 승인 경유 조정 이벤트로만 반영됩니다 (MG1003 · ADR-007)
          </div>
        )}
      </window.Card>

      {/* 지급 명세서 미리보기 — 프리랜서별 카드 */}
      <window.Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold">지급 명세서 미리보기</h3>
            <div className="text-xs text-slate-500 mt-0.5">프리랜서 {window.FREELANCERS.length}명 · 이달 지급 합계 <span className="text-emerald-300 font-semibold tabular-nums">₩{window.fmt(payoutTotal)}</span></div>
          </div>
          <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">민감정보(계좌) 마스킹 · MG1004</span>
        </div>
        <div className="p-5 grid grid-cols-12 gap-3">
          {window.FREELANCERS.map(f => {
            const job = parseJobOf(f.name);
            return (
              <div key={f.id} className="col-span-12 md:col-span-6 xl:col-span-4 p-4 rounded-xl bg-slate-950/50 border border-white/10 hover:border-emerald-500/30 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold">{f.name[0]}</div>
                    <div>
                      <div className="text-sm font-semibold">{f.name}</div>
                      <div className="text-[11px] text-slate-500">{f.specialty}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${f.rateType === 'FIXED' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-purple-500/15 text-purple-300'}`}>{f.rateType === 'FIXED' ? '건당 고정' : '변동 단가'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">진행 작업</span><span className="tabular-nums">{f.activeTasks}건</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">지급 예정액</span><span className="tabular-nums font-bold text-emerald-300">₩{window.fmt(f.monthSettlement)}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">계좌</span>
                    <span className="font-mono text-[11px] text-slate-300">{job ? job.bank : "●●●●-●●-●●●●"}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button className="flex-1 py-1.5 rounded-md bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-xs flex items-center justify-center gap-1.5">
                    <window.Icon name="file" className="w-3.5 h-3.5" />명세서 생성
                  </button>
                  {job && <span className="text-[10px] px-1.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 whitespace-nowrap">AI 파싱 검수 대기</span>}
                </div>
              </div>
            );
          })}
        </div>
      </window.Card>

      {/* 팀별 손익 미니 바 + 전자세금계산서 */}
      <div className="grid grid-cols-12 gap-4">
        <window.Card className="col-span-12 lg:col-span-7 p-6">
          <h3 className="font-semibold text-base mb-1">팀별 손익 기여</h3>
          <div className="text-xs text-slate-500 mb-4">{period} 정산 손익 귀속 (BS0003 — 부서·프로젝트 태깅 단위)</div>
          {rows.length === 0 ? (
            <div className="text-xs text-slate-500 py-6 text-center">해당 기간 손익 데이터 없음</div>
          ) : (
            <div className="space-y-3.5">
              {rows.map(s => (
                <div key={s.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{s.target}</span>
                    <span className="tabular-nums text-slate-400">₩{window.fmt(s.profit)} <span className="text-slate-600">· 손익률 {(s.profit / s.orderAmount * 100).toFixed(1)}%</span></span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${s.profit / profitMax * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </window.Card>

        <window.Card className="col-span-12 lg:col-span-5 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-base">전자세금계산서</h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">1차: 요청·상태 관리</span>
          </div>
          <div className="text-xs text-slate-500 mb-4">발행 요청·상태 추적 · ASP(팝빌/바로빌) 자동 발행은 Phase 2</div>
          <div className="space-y-2">
            {taxRows.map((t, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-950/50 border border-white/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0"><window.Icon name="file" className="w-4 h-4 text-slate-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{t.name} · <span className="text-slate-500">{t.specialty}</span></div>
                  <div className="text-[11px] text-slate-500 tabular-nums">₩{window.fmt(t.amount)}{t.bank ? ` · ${t.bank}` : ""}</div>
                </div>
                <TaxPill status={t.status} />
              </div>
            ))}
          </div>
          <button className="mt-3 w-full py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-xs flex items-center justify-center gap-1.5">
            <window.Icon name="plus" className="w-3.5 h-3.5" />세금계산서 발행 요청
          </button>
        </window.Card>
      </div>

      {/* ── 상세 사이드패널 ── */}
      {detail && (() => {
        const s = detail;
        const steps = formulaOf(s);
        const result = steps[steps.length - 1];
        const events = refundEventsOf(s);
        const recalcs = recalcHistoryOf(s);
        return (
          <div className="fixed inset-0 z-30 flex">
            <div onClick={() => setDetail(null)} className="flex-1 bg-slate-950/70"></div>
            <div className="w-full max-w-md bg-slate-950 border-l border-slate-700/60 shadow-2xl shadow-emerald-500/10 overflow-y-auto">
              <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-slate-950 z-10">
                <div>
                  <div className="text-[11px] font-mono text-slate-500">{s.id}</div>
                  <h3 className="font-bold text-lg mt-0.5">{s.target} 정산</h3>
                </div>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-md hover:bg-white/10"><window.Icon name="x" className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex items-center gap-2">
                  <window.EnumPill status={s.status} />
                  <span className="text-xs text-slate-400 tabular-nums">{s.period} · 재계산 {s.recalcCount}회</span>
                </div>

                {/* ④ 확정 해제 배지 (CONFIRMED) */}
                {s.status === "CONFIRMED" && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed flex items-start gap-2">
                    <window.Icon name="shieldCheck" className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>확정된 정산입니다. <b>확정 해제·소급 수정은 결재 승인이 필요</b>하며, 직접 수정은 차단됩니다 (MG1003 · settlement_adjustments 경유).</span>
                  </div>
                )}

                {/* ① 계산 근거 공식 라인 */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">계산 근거</h4>
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-white/10 space-y-2">
                    {steps.slice(0, 4).map((st, i) => (
                      <div key={i} className="flex items-center justify-between text-sm tabular-nums">
                        <span className="text-slate-400 flex items-center gap-1.5"><span className={`w-4 text-center font-mono ${st.sign === '−' ? 'text-rose-400' : 'text-slate-500'}`}>{st.sign}</span>{st.label}</span>
                        <span className={st.sign === '−' ? 'text-rose-300' : 'text-slate-200'}>{st.sign === '−' ? '−' : ''}₩{window.fmt(st.value)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-white/10 text-sm tabular-nums">
                      <span className="font-semibold flex items-center gap-1.5"><span className="w-4 text-center font-mono text-emerald-400">=</span>손익</span>
                      <span className="text-lg font-bold text-emerald-300">₩{window.fmt(result.value)}</span>
                    </div>
                  </div>
                  <div className={`mt-2 text-[11px] flex items-center gap-1.5 ${result.matches ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <window.Icon name={result.matches ? "check" : "alert"} className="w-3 h-3" />
                    {result.matches ? `데이터 손익 ₩${window.fmt(s.profit)}과 일치 — 이벤트 원장 합산 검산 통과 (BS0001)` : "데이터 불일치 — 재계산 필요"}
                  </div>
                </div>

                {/* ② 근거 이벤트 타임라인 (SALES_EVENTS) */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">근거 이벤트 · 매출 원장</h4>
                  {events.length === 0 ? (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-500">
                      이 기간 환불 반영 이벤트 없음 — 순매출 이벤트만으로 산출된 정산입니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {events.map(e => {
                        const o = orderOf(e.orderId); const apr = approvalOf(e.approvalId);
                        return (
                          <div key={e.id} className="p-3 rounded-lg bg-rose-500/[0.07] border border-rose-500/20">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <window.EnumPill status={e.type === "FULL_REFUND" ? "CANCELLED" : "PARTIALLY_REFUNDED"} />
                                <span className="text-[11px] font-mono text-slate-500">{e.id}</span>
                              </div>
                              <span className="text-sm font-semibold tabular-nums text-rose-300">−₩{window.fmt(Math.abs(e.amount))}</span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                              {o?.item} <span className="text-slate-500">· {o?.clientName} · <span className="font-mono">{e.orderId}</span></span>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 tabular-nums flex items-center gap-1.5">
                              <window.Icon name="clock" className="w-3 h-3" />{e.occurredAt}
                              {apr && <span className="ml-1">· <span className="font-mono text-emerald-400">{apr.id}</span> 승인 반영</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ③ 재계산 이력 */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-2">재계산 이력</h4>
                  {recalcs.length === 0 ? (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-slate-500">
                      재계산 이력 없음 — 최초 집계 상태를 유지 중입니다.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {recalcs.map((r, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0">#{r.seq}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium flex items-center gap-1.5">{r.reason}{r.ref && <span className="font-mono text-[10px] text-emerald-400">{r.ref}</span>}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{r.note}</div>
                            <div className="text-[10px] text-slate-600 font-mono mt-0.5 tabular-nums">{r.at}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-slate-500 flex items-start gap-1.5">
                    <window.Icon name="history" className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-500" />
                    모든 재계산은 포함/제외 작업·단가·트리거를 이력으로 저장합니다 (settlement_recalc_histories · BS0007)
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

window.Settlement = Settlement;
