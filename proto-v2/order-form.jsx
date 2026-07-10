// order-form.jsx — 11 주문 등록/수정 (route: orderForm) · entry1
// 등록: 플랫폼주문번호 실시간 중복 검증(BS0004) — 중복 시 경고 배너 + 기존 주문 딥링크 + 등록 비활성
// 수정: 금액 3분해 잠금 카드 + "금액 변경은 기안으로" 안내 + 조정 기안 직행(MG1001, IDEA-10)
// 데이터: ORDERS, DEPARTMENTS, PROJECTS, SALES_EVENTS, APPROVALS, EMPLOYEES
const { useState, useMemo, useEffect } = React;

function OrderForm({ route, navigate, tweaks }) {
  const { Card, Icon, PageHeader, EnumPill, ENUM_META, Money, ConfirmDialog, fmt, toast } = window;

  // 로컬 보강 — 플랫폼 라벨 + (플랫폼, 플랫폼주문번호) 중복 검증용 기존 번호 레지스트리
  // (v2 data.js ORDERS에 platformOrderNo 필드가 없어 시연용으로 로컬 정의 — BS0004 데모)
  const PLATFORM_LABELS = { SMARTSTORE: '스마트스토어', COUPANG: '쿠팡', EMAIL: '이메일', MANUAL: '수기' };
  const EXISTING_PLATFORM_NOS = {
    'SMARTSTORE:SS-20260703-0155': 'ORD-2607-004',
    'SMARTSTORE:SS-20260701-0009': 'ORD-2607-001',
    'COUPANG:CP-20260702-1180': 'ORD-2607-002',
  };

  // ── 모드 판별: payload.orderId → 수정(UC11-1/11-2), 없으면 등록(UC11) ───────
  const editOrder = useMemo(() => {
    const oid = route && route.payload && route.payload.orderId;
    return oid ? ORDERS.find((o) => o.id === oid) || null : null;
  }, [route]);
  const isEdit = !!editOrder;

  const myDept = (EMPLOYEES.find((e) => e.id === CURRENT_USER_ID) || {}).deptId || 'DEPT-1';
  const initial = useMemo(() => ({
    platform: isEdit ? editOrder.platform : 'SMARTSTORE',
    orderedAt: isEdit ? editOrder.orderedAt : TODAY,
    platformOrderNo: isEdit ? `${editOrder.platform.slice(0, 2)}-${editOrder.orderedAt.replace(/-/g, '')}-${editOrder.id.slice(-4)}` : '',
    title: isEdit ? editOrder.item : '',
    clientName: isEdit ? editOrder.clientName : '',
    amountRaw: isEdit ? String(editOrder.amount) : '',
    deptId: isEdit ? editOrder.deptId : myDept,
    projectId: isEdit ? editOrder.projectId || '' : '',
    memo: '',
  }), [isEdit, editOrder]);

  const [form, setForm] = useState(initial);
  useEffect(() => { setForm(initial); }, [initial]);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [checking, setChecking] = useState(false);
  const [dupOrderId, setDupOrderId] = useState(null);

  // ── 플랫폼주문번호 실시간 중복 검증 (BS0004 — order1004 시뮬레이션) ─────────
  useEffect(() => {
    if (isEdit) return;
    const no = form.platformOrderNo.trim();
    if (!no) { setDupOrderId(null); setChecking(false); return; }
    setChecking(true);
    const t = setTimeout(() => {
      setDupOrderId(EXISTING_PLATFORM_NOS[`${form.platform}:${no}`] || null);
      setChecking(false);
    }, 350); // 입력 완료 감지 후 검증 API 왕복 시뮬레이션
    return () => clearTimeout(t);
  }, [form.platform, form.platformOrderNo, isEdit]);

  // 수정 모드 파생값 — 현재 매출은 이벤트 합산으로만 유도 (BS0001)
  const events = isEdit ? SALES_EVENTS.filter((e) => e.orderId === editOrder.id) : [];
  const curSales = events.reduce((s, e) => s + e.amount, 0);
  const formula = events
    .slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) => ({ label: `${(ENUM_META[e.type] || {}).label || e.type} ${e.occurredAt.slice(5, 10)}`, value: e.amount, ref: e.approvalId || undefined }));
  const holdApproval = isEdit && editOrder.activeApprovalId ? APPROVALS.find((a) => a.id === editOrder.activeApprovalId) : null;

  const amount = Number(form.amountRaw || 0);
  const missing = [];
  if (!form.platform) missing.push('플랫폼');
  if (!form.orderedAt) missing.push('주문일자');
  if (!isEdit && !form.platformOrderNo.trim()) missing.push('플랫폼 주문번호');
  if (!form.title.trim()) missing.push('주문명');
  if (!isEdit && amount <= 0) missing.push('주문 금액');
  if (!form.deptId) missing.push('귀속 부서');
  const canSubmit = missing.length === 0 && !dupOrderId && !checking && (!isEdit || dirty);

  // ── 등록 (UC11) — 성공 시 감사 로그(MG1004) + 릴레이 토스트(IDEA-16) ────────
  const submitCreate = () => {
    const newId = `ORD-2607-${String(ORDERS.length + 1).padStart(3, '0')}`;
    toast(`${newId} 등록 완료 — 변경 이력이 함께 기록됐어요 (MG1004)`, {
      actionLabel: '작업 그룹 만들기 →', onAction: () => navigate('workGroups', { orderId: newId }),
    });
    navigate('orders', { orderId: newId });
  };

  // ── 저장 (UC11-1) — 금액 제외 항목만 전송 ──────────────────────────────────
  const submitSave = () => {
    toast(`${editOrder.id} 저장 완료 — 변경 전/후 값이 감사 로그에 기록됐어요 (MG1004)`, {
      actionLabel: '변경 이력 보기 →', onAction: () => navigate('auditLog', { entityId: editOrder.id }),
    });
    navigate('orders', { orderId: editOrder.id });
  };

  // ── 삭제 (UC11-2) — 매출 이벤트 적재 주문은 차단 → 전체환불 결재 유도 ───────
  const deletable = isEdit && events.length === 0 && !holdApproval;
  const confirmDelete = () => {
    if (!deleteReason.trim()) { toast('삭제 사유를 입력해 주세요 — 감사 로그에 기록됩니다 (MG1004)', { tone: 'warn' }); return; }
    setDeleteOpen(false);
    toast(`${editOrder.id} 삭제 완료 — 사유·변경자가 감사 로그에 기록됐어요 (MG1004)`, {
      actionLabel: '변경 이력 보기 →', onAction: () => navigate('auditLog'),
    });
    navigate('orders');
  };

  const goList = () => { if (dirty) setLeaveOpen(true); else navigate('orders', isEdit ? { orderId: editOrder.id } : undefined); };

  const inputCls = 'w-full rounded-lg bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60';
  const labelCls = 'block text-xs text-slate-400 mb-1.5';
  const Req = () => <span className="text-rose-400 ml-0.5">*</span>;

  return (
    <div className="max-w-3xl">
      <PageHeader
        label={isEdit ? 'ORDERS · 11 EDIT' : 'ORDERS · 11'}
        title={isEdit ? '주문 수정' : '주문 등록'}
        desc={isEdit
          ? '금액은 잠금 상태예요 — 금액 변경은 결재를 거쳐야만 반영됩니다 (MG1001)'
          : '수기 등록도 엑셀 업로드와 동일한 (플랫폼, 플랫폼주문번호) 중복 기준을 적용해요 (BS0004)'}
        actions={
          <button onClick={goList} className="px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5">
            <Icon name="chevronLeft" className="w-3.5 h-3.5" />목록으로
          </button>
        }
      />

      {/* 수정 모드 식별부: 주문번호 + 상태 + 결재 진행 중 홀드 스트립 (IDEA-11) */}
      {isEdit && (
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-400">주문 번호 <span className="text-slate-200 font-semibold">{editOrder.id}</span></span>
            <EnumPill status={editOrder.status} />
          </div>
          {holdApproval && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs text-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                금액 변경 결재 진행 중 <span className="font-mono">{holdApproval.id}</span> — 승인/반려 전까지 이 주문의 수정·삭제·신규 기안이 잠깁니다 (IDEA-11)
              </div>
              <button onClick={() => navigate('approvalDetail', { approvalId: holdApproval.id })}
                className="shrink-0 text-xs font-semibold text-amber-200 hover:text-amber-100 flex items-center gap-1">
                결재 보기 <Icon name="arrowRight" className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 수정 모드 금액부 — 3분해 잠금 카드 (BS0001 · MG1001 · IDEA-10) */}
      {isEdit && (
        <Card className="p-5 mb-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
            <Icon name="lock" className="w-3 h-3" />금액 — 잠금
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">원 주문 금액</div>
              <div className="text-[10px] text-slate-600 mt-0.5">잠금 · 불변 — BS0001</div>
            </div>
            <Money value={editOrder.amount} locked size="lg" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 border border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Icon name="info" className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              금액 변경은 기안으로 진행돼요 — 승인 시 매출 이벤트·정산·손익까지 자동 반영됩니다 (MG1001)
            </div>
            <button onClick={() => navigate('draft', { orderId: editOrder.id, type: 'ORDER_EDIT' })}
              disabled={!!holdApproval}
              title={holdApproval ? `결재 진행 중 ${holdApproval.id} — 이중 기안 차단` : '주문ID·원 금액·기환불 누계 프리필로 기안 작성 (IDEA-10)'}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
              조정 기안 작성 <Icon name="arrowRight" className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">기환불 누계</span>
              {editOrder.refundedAmount > 0 ? <Money value={-editOrder.refundedAmount} size="md" /> : <span className="font-mono text-slate-600">0</span>}
            </div>
            <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">현재 매출</span>
              <Money value={curSales} formula={formula} size="md" />
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 mb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* 등록 모드 식별부 */}
          {!isEdit && (
            <>
              <div>
                <label className={labelCls}>플랫폼<Req /></label>
                <select value={form.platform} onChange={(e) => set('platform', e.target.value)} className={inputCls}>
                  {Object.entries(PLATFORM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>주문일자<Req /></label>
                <input type="date" value={form.orderedAt} onChange={(e) => set('orderedAt', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>플랫폼 주문번호<Req /></label>
                <div className="relative">
                  <input value={form.platformOrderNo} onChange={(e) => set('platformOrderNo', e.target.value)}
                    placeholder="예: SS-20260710-0031" maxLength={50}
                    className={`${inputCls} font-mono pr-9 ${dupOrderId ? '!border-rose-500/60' : ''}`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checking && <Icon name="refresh" className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                    {!checking && form.platformOrderNo.trim() && !dupOrderId && <Icon name="check" className="w-3.5 h-3.5 text-emerald-400" />}
                    {!checking && dupOrderId && <Icon name="alert" className="w-3.5 h-3.5 text-rose-400" />}
                  </span>
                </div>
                {dupOrderId ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                    <span className="text-xs text-rose-200 flex items-center gap-1.5">
                      <Icon name="alert" className="w-3.5 h-3.5 shrink-0" />
                      이미 등록된 주문입니다 — 주문 <span className="font-mono">{dupOrderId}</span> (BS0004)
                    </span>
                    <button onClick={() => navigate('orders', { orderId: dupOrderId })}
                      className="shrink-0 text-xs font-semibold text-rose-200 hover:text-rose-100 flex items-center gap-1">
                      해당 주문 <Icon name="arrowRight" className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    입력 즉시 (플랫폼, 플랫폼주문번호) 중복을 검증해요 — 데모: 스마트스토어 + <span className="font-mono">SS-20260703-0155</span>
                  </p>
                )}
              </div>
            </>
          )}

          <div className="col-span-2">
            <label className={labelCls}>주문명<Req /></label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={100}
              placeholder="예: 브랜드 블로그 콘텐츠 10건" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>고객명</label>
            <input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} maxLength={50}
              placeholder="예: 소소한마켓" className={inputCls} />
          </div>
          {!isEdit && (
            <div>
              <label className={labelCls}>주문 금액<Req /></label>
              <div className="relative">
                <input value={form.amountRaw ? fmt(Number(form.amountRaw)) : ''} inputMode="numeric"
                  onChange={(e) => set('amountRaw', e.target.value.replace(/[^0-9]/g, '').slice(0, 15))}
                  placeholder="숫자만 입력 — 콤마 자동" className={`${inputCls} font-mono text-right pr-9`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">원</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">등록 후 금액 수정은 결재로만 가능해요 (MG1001)</p>
            </div>
          )}
        </div>
      </Card>

      {/* 귀속 정보 */}
      <Card className="p-5 mb-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-1.5">
          <Icon name="building" className="w-3 h-3" />귀속 정보 — 손익 귀속 태깅 (BS0003)
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>귀속 부서<Req /></label>
            <select value={form.deptId} onChange={(e) => { set('deptId', e.target.value); set('projectId', ''); }} className={inputCls}>
              {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>귀속 프로젝트</label>
            <select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} className={inputCls}>
              <option value="">선택 안 함</option>
              {PROJECTS.filter((p) => p.deptId === form.deptId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>메모 <span className="text-slate-600">(저위험 필드 — 인라인 편집 허용, IDEA-02)</span></label>
            <textarea value={form.memo} onChange={(e) => set('memo', e.target.value.slice(0, 200))} rows={2}
              placeholder="예: 초안 9/20까지 요청" className={`${inputCls} resize-none`} />
            <div className="text-[10px] text-slate-600 text-right mt-1 font-mono">{form.memo.length}/200</div>
          </div>
        </div>
      </Card>

      {/* 하단 액션 바 */}
      <div className="flex items-center justify-between">
        {isEdit ? (
          <div>
            <button onClick={() => { setDeleteReason(''); setDeleteOpen(true); }} disabled={!deletable}
              title={events.length > 0 ? '매출 이벤트가 적재된 주문은 삭제할 수 없어요 — 전체환불 결재로 진행하세요' : holdApproval ? `결재 진행 중 ${holdApproval.id}` : '주문 삭제 (UC11-2)'}
              className="px-3.5 py-2 rounded-lg text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
              <Icon name="trash" className="w-3.5 h-3.5" />삭제
            </button>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {events.length > 0
                ? '매출 이벤트 적재됨 — 삭제 대신 전체환불 결재로 진행해요 (BS0001)'
                : '삭제 시 변경 전/후 값·변경자·사유가 감사 로그로 기록됩니다 (MG1004)'}
            </p>
          </div>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button onClick={goList} className="px-4 py-2 rounded-lg text-sm text-slate-300 bg-slate-800 hover:bg-slate-700">취소</button>
          <button onClick={isEdit ? submitSave : submitCreate} disabled={!canSubmit}
            title={dupOrderId ? '중복 주문 — 등록할 수 없어요 (BS0004)' : missing.length ? `필수 입력: ${missing.join(', ')}` : ''}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            <Icon name="check" className="w-3.5 h-3.5" />{isEdit ? '저장' : '등록'}
          </button>
        </div>
      </div>
      {!canSubmit && !isEdit && (missing.length > 0 || dupOrderId) && (
        <p className="text-[11px] text-slate-500 text-right mt-2">
          {dupOrderId ? '중복 경고 상태에서는 등록할 수 없어요 (BS0004)' : `필수 항목 ${missing.length}개 남음 — ${missing.join(' · ')}`}
        </p>
      )}

      {/* 이탈 확인 — 미저장 변경 (저위험 §4.6) */}
      <ConfirmDialog
        open={leaveOpen} risk="low" title="저장하지 않고 나갈까요?"
        message="입력 중인 변경 사항이 사라져요. 데이터는 변경되지 않습니다."
        confirmLabel="나가기" cancelLabel="계속 작성"
        onConfirm={() => { setLeaveOpen(false); navigate('orders', isEdit ? { orderId: editOrder.id } : undefined); }}
        onClose={() => setLeaveOpen(false)}
      />

      {/* 삭제 확인 — 중위험 §4.6: 요약 + 사유 필수 (MG1004) */}
      <ConfirmDialog
        open={deleteOpen} risk="mid" danger
        title="주문 삭제" confirmLabel="삭제 확정" cancelLabel="취소"
        message="삭제 시 변경 전/후 값·변경자·사유가 감사 로그로 기록됩니다 (MG1004)"
        summary={isEdit && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs">{editOrder.id} · {editOrder.item}</span>
            <Money value={editOrder.amount} locked />
          </div>
        )}
        onConfirm={confirmDelete} onClose={() => setDeleteOpen(false)}
      >
        <div className="mb-2">
          <label className="block text-xs text-slate-400 mb-1.5">삭제 사유 <span className="text-rose-400">*</span></label>
          <textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={2} placeholder="예: 테스트 오등록"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-purple-500/60 resize-none" />
        </div>
      </ConfirmDialog>
    </div>
  );
}

window.OrderForm = OrderForm;
