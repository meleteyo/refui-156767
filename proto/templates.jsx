// templates.jsx — 04 결재 양식 관리: 좌 목록 / 중 편집 / 우 라이브 A4 기안문 프리뷰
// 편집 즉시 프리뷰 반영(디바운스 없음 — proto-interaction-patterns §3)
// policyMode Tweak(PRIORITY=순차 / BROADCAST=병렬 합의)이 프리뷰 결재란 렌더를 실제로 바꾼다
const { useState: useState_t } = React;

// 해제 불가 후속처리 — 결재 상태 변경·감사 로그는 도메인 필수 (MG1004)
const REQUIRED_EFFECTS = ["APPROVAL_STATUS", "AUDIT_LOG"];

// 양식 유형 칩 색상 (한 화면 액센트 ≤ 3종 규칙 내에서 목록 전용 저채도 칩)
const TYPE_CHIP = {
  ORDER_EDIT:     "bg-cyan-500/10 text-cyan-300",
  PARTIAL_REFUND: "bg-purple-500/10 text-purple-300",
  FULL_REFUND:    "bg-rose-500/10 text-rose-300",
  REPAYMENT:      "bg-emerald-500/10 text-emerald-300",
  RATE_CHANGE:    "bg-amber-500/10 text-amber-300",
};

// 프리뷰 예시 대상 — data.js의 기존 레코드에서 발췌 (양식 유형별 대표 사례, 신규 날조 없음)
const PREVIEW_SAMPLES = {
  ORDER_EDIT:     { targetLabel: "대상 주문",     target: "ORD-2607-006 · 다온리빙",   detail: "SNS 광고 소재 10종 → 11종 변경에 따른 주문 금액 수정", amount: 1650000, requester: "김도윤" },
  PARTIAL_REFUND: { targetLabel: "대상 주문",     target: "ORD-2607-002 · 한빛식품",   detail: "체험단 20건 중 6건 미진행 — 고객 요청 부분환불",       amount: 600000,  requester: "이수민" },
  FULL_REFUND:    { targetLabel: "대상 주문",     target: "ORD-2607-007 · 모두의반찬", detail: "시딩 대상 30명 중 8명만 진행 — 고객사 전체 취소 요청",  amount: 2700000, requester: "정하은" },
  REPAYMENT:      { targetLabel: "대상 주문",     target: "ORD-2607-010 · 윤슬주얼리", detail: "취소 주문 재결제 — 사양 변경 후 재계약",               amount: 1800000, requester: "이수민" },
  RATE_CHANGE:    { targetLabel: "대상 프리랜서", target: "FR-104 · 최민준",           detail: "카피라이팅·광고 소재 건당 단가 조정",                  amount: 80000,   requester: "김도윤" },
};

function Templates({ tweaks, navigate }) {
  const policyMode = tweaks.policyMode || "PRIORITY";
  const [selectedId, setSelectedId] = useState_t("TPL-002");

  // 양식별 편집 초안 — 다른 양식으로 전환해도 편집 내용 유지 (상태 초기화 금지)
  const [drafts, setDrafts] = useState_t(() => {
    const d = {};
    window.APPROVAL_TEMPLATES.forEach(t => {
      d[t.id] = { name: t.name, line: [...t.defaultLine], effects: [...t.followUpEffects] };
    });
    return d;
  });

  const tpl = window.APPROVAL_TEMPLATES.find(t => t.id === selectedId);
  const draft = drafts[selectedId];
  const sample = PREVIEW_SAMPLES[tpl.type];

  const patch = (p) => setDrafts(d => ({ ...d, [selectedId]: { ...d[selectedId], ...p } }));

  // ── 승인선 편집 ────────────────────────────────────────────────────
  const removeStep = (i) => { if (draft.line.length <= 1) return; patch({ line: draft.line.filter((_, x) => x !== i) }); };
  const moveStep = (i, dir) => {
    const line = [...draft.line];
    const j = i + dir;
    if (j < 0 || j >= line.length) return;
    [line[i], line[j]] = [line[j], line[i]];
    patch({ line });
  };
  const addRole = (role) => patch({ line: [...draft.line, role] });
  const availableRoles = ["TEAM_LEAD", "FINANCE", "CEO"].filter(r => !draft.line.includes(r));

  // ── 후속처리 배지 토글 ─────────────────────────────────────────────
  const toggleEffect = (key) => {
    if (REQUIRED_EFFECTS.includes(key)) return;
    patch({ effects: draft.effects.includes(key) ? draft.effects.filter(e => e !== key) : [...draft.effects, key] });
  };
  // 표시 순서는 EFFECT_META(7연쇄) 정의 순서 고정
  const orderedEffects = Object.keys(window.EFFECT_META).filter(k => draft.effects.includes(k));

  // 금액 규칙 — 환불 양식은 기안 금액 ≥ 100만원이면 대표 승인 자동 추가 (콘솔 Step 3과 동일 규칙)
  const autoCEO = (tpl.type === "PARTIAL_REFUND" || tpl.type === "FULL_REFUND")
    && sample.amount >= 1000000 && !draft.line.includes("CEO");
  const previewLine = autoCEO ? [...draft.line, "CEO"] : draft.line;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <window.SectionLabel color="pink">TEMPLATES · 결재 양식 관리</window.SectionLabel>
          <h1 className="text-3xl font-bold mt-1.5 tracking-tight text-slate-50">결재 양식</h1>
          <p className="text-sm text-slate-300 mt-1">양식 5종 — 승인선·후속처리를 편집하면 우측 기안문 프리뷰에 즉시 반영됩니다</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1.5 rounded-md text-xs font-semibold ${policyMode === 'PRIORITY' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'}`}>
            {policyMode === 'PRIORITY' ? '순차 결재 (PRIORITY)' : '병렬 합의 (BROADCAST)'}
          </span>
          <button className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-purple-500/30">
            <window.Icon name="plus" className="w-3.5 h-3.5" />새 양식
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── 좌 · 양식 목록 (5종) ── */}
        <window.Card className="col-span-12 lg:col-span-3 p-3">
          <div className="space-y-1">
            {window.APPROVAL_TEMPLATES.map(t => {
              const d = drafts[t.id];
              const sel = selectedId === t.id;
              return (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-3 rounded-md transition border ${sel ? 'bg-purple-500/15 border-purple-500/30' : 'border-transparent hover:bg-white/5'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-tight">{d.name}</div>
                    <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">{t.id}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${TYPE_CHIP[t.type]}`}>{window.APPROVAL_TYPE_LABELS[t.type]}</span>
                    <span className="text-[10px] text-slate-500">후속 {d.effects.length}건</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {d.line.map(r => window.ROLE_LABELS[r]).join(policyMode === 'PRIORITY' ? ' → ' : ' + ')}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 px-1 text-[10px] text-slate-500 leading-relaxed">
            양식은 기안 시 승인선·후속처리 기본값으로 로드됩니다 — 환불 결재 콘솔 Step 3에서 자동 적용
          </div>
        </window.Card>

        {/* ── 중 · 편집 ── */}
        <window.Card className="col-span-12 lg:col-span-5 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">편집</h3>
            <span className="text-[10px] font-mono text-slate-500">{tpl.id} · {tpl.type}</span>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500">양식명</label>
            <input value={draft.name} onChange={e => patch({ name: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-md bg-slate-950/60 border border-white/10 text-sm focus:border-purple-500 outline-none" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase tracking-wider text-slate-500">승인선 — {draft.line.length}단계</label>
              <span className="text-[10px] text-slate-500">{policyMode === 'PRIORITY' ? '순서대로 승인' : '순서 무관 · 동시 통보'}</span>
            </div>
            <div className="mt-2 space-y-2">
              {draft.line.map((role, i) => (
                <div key={`${role}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
                  <div className="w-7 h-7 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {policyMode === 'PRIORITY' ? i + 1 : '='}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{window.APPROVERS[role][0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{window.APPROVERS[role]} <span className="text-slate-500 text-xs">· {window.ROLE_LABELS[role]}</span></div>
                    <div className="text-[10px] font-mono text-slate-500">{role}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                      className="w-6 h-6 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed text-xs" aria-label="위로">↑</button>
                    <button onClick={() => moveStep(i, 1)} disabled={i === draft.line.length - 1}
                      className="w-6 h-6 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed text-xs" aria-label="아래로">↓</button>
                    <button onClick={() => removeStep(i)} disabled={draft.line.length <= 1}
                      className="w-6 h-6 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-rose-300 disabled:opacity-25 disabled:cursor-not-allowed" aria-label="단계 삭제">
                      <window.Icon name="x" className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {availableRoles.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[11px] text-slate-500">단계 추가:</span>
                {availableRoles.map(r => (
                  <button key={r} onClick={() => addRole(r)}
                    className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-purple-500/15 hover:border-purple-500/30 text-xs flex items-center gap-1">
                    <window.Icon name="plus" className="w-3 h-3" />{window.ROLE_LABELS[r]} · {window.APPROVERS[r]}
                  </button>
                ))}
              </div>
            )}
            {(tpl.type === "PARTIAL_REFUND" || tpl.type === "FULL_REFUND") && (
              <div className="mt-2 text-[10px] text-amber-300/80 flex items-start gap-1.5">
                <window.Icon name="alert" className="w-3 h-3 mt-0.5 flex-shrink-0" />
                환불 양식은 기안 금액이 100만원 이상이면 대표 승인 단계가 자동 추가됩니다 (금액 규칙)
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-slate-500">승인 시 후속 처리 — {draft.effects.length}건 선택</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.entries(window.EFFECT_META).map(([key, m]) => {
                const on = draft.effects.includes(key);
                const required = REQUIRED_EFFECTS.includes(key);
                return (
                  <button key={key} onClick={() => toggleEffect(key)} disabled={required}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition ${on ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/10 hover:border-white/20'} ${required ? 'cursor-default' : ''}`}>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${on ? 'bg-emerald-500/25 text-emerald-200' : 'bg-white/5 text-slate-500'}`}>
                      <window.Icon name={m.icon} className="w-3.5 h-3.5" />
                    </div>
                    <div className={`flex-1 min-w-0 text-xs font-medium ${on ? 'text-emerald-100' : 'text-slate-400'}`}>{m.label}</div>
                    {required
                      ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 flex-shrink-0">필수</span>
                      : (on && <window.Icon name="check" className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />)}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-slate-500">
              선택한 후속 처리는 최종 승인 시 단일 트랜잭션으로 실행됩니다 — 환불 양식은 7연쇄 전체가 기본값
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <div className="text-[10px] text-slate-500">저장 시 다음 기안부터 적용 · 진행 중인 결재에는 영향 없음</div>
            <button className="px-4 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-sm font-semibold shadow-lg shadow-purple-500/30">저장</button>
          </div>

          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <window.Icon name="settings" className="w-3 h-3" />
            결재 정책은 우측 하단 Tweaks 패널에서 전환할 수 있습니다 — 전환 즉시 프리뷰 결재란이 바뀝니다
          </div>
        </window.Card>

        {/* ── 우 · 라이브 A4 기안문 프리뷰 (편집 즉시 반영) ── */}
        <window.Card className="col-span-12 lg:col-span-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <window.Icon name="eye" className="w-4 h-4 text-slate-400" />
              <h3 className="font-semibold text-sm">라이브 프리뷰 · 기안문</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">A4</span>
          </div>

          <div className="rounded-lg bg-slate-100 aspect-[210/297] shadow-2xl p-6 overflow-hidden flex flex-col text-slate-900" style={{ fontSize: '11px', lineHeight: 1.45 }}>
            {/* 문서 제목 */}
            <div className="text-center pb-2 border-b-2 border-slate-800">
              <div className="text-[8px] tracking-[0.35em] text-slate-500">전자결재 · 통합 ERP</div>
              <div className="text-base font-bold tracking-[0.2em] mt-0.5">{draft.name || "무제 양식"} 기안서</div>
            </div>

            {/* 문서 메타 + 결재란 — policyMode에 따라 렌더가 실제로 달라짐 */}
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="space-y-1 text-[9px] pt-0.5">
                <div className="flex gap-2"><span className="w-11 text-slate-500 flex-shrink-0">문서번호</span><span className="font-mono">APR-20260710-··</span></div>
                <div className="flex gap-2"><span className="w-11 text-slate-500 flex-shrink-0">기안자</span><span>{sample.requester}</span></div>
                <div className="flex gap-2"><span className="w-11 text-slate-500 flex-shrink-0">기안일</span><span>2026-07-10</span></div>
                <div className="flex gap-2"><span className="w-11 text-slate-500 flex-shrink-0">결재방식</span><span className="font-semibold">{policyMode === 'PRIORITY' ? '순차 결재' : '병렬 합의'}</span></div>
              </div>
              <div>
                <div className="flex items-stretch">
                  {previewLine.map((role, i) => {
                    const isAuto = autoCEO && role === 'CEO';
                    return (
                      <React.Fragment key={`${role}-${i}`}>
                        <div className={`w-[52px] border text-center ${isAuto ? 'border-dashed border-amber-500 bg-amber-50' : 'border-slate-400 bg-white'}`}>
                          <div className={`text-[7px] py-0.5 border-b ${isAuto ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-slate-300 bg-slate-200 text-slate-600'}`}>
                            {policyMode === 'PRIORITY' ? `${i + 1}차 · ` : ''}{window.ROLE_LABELS[role]}
                          </div>
                          <div className="py-2 text-[9px] font-semibold">{window.APPROVERS[role]}</div>
                          <div className={`text-[6.5px] pb-1 ${isAuto ? 'text-amber-600' : policyMode === 'PRIORITY' ? 'text-slate-400' : 'text-cyan-700'}`}>
                            {isAuto ? '금액규칙 자동' : policyMode === 'PRIORITY' ? (i === 0 ? '상신 시 알림' : '앞 단계 승인 후') : '동시 통보'}
                          </div>
                        </div>
                        {policyMode === 'PRIORITY' && i < previewLine.length - 1 && (
                          <div className="flex items-center px-0.5 text-slate-400 text-[9px]">→</div>
                        )}
                        {policyMode === 'BROADCAST' && i < previewLine.length - 1 && <div className="w-1"></div>}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="text-[6.5px] text-slate-500 mt-1 text-right">
                  {policyMode === 'PRIORITY'
                    ? '앞 단계 승인 후 다음 단계 활성 · 중간 반려 시 즉시 종결'
                    : `상신 즉시 ${previewLine.length}명 전원 동시 통보 · 전원 승인 시 확정`}
                </div>
              </div>
            </div>

            {/* 본문 표 — 예시 대상은 data.js 실제 레코드 */}
            <div className="mt-3 border border-slate-300 rounded-sm overflow-hidden">
              {[
                ["유형", window.APPROVAL_TYPE_LABELS[tpl.type]],
                [sample.targetLabel, sample.target],
                ["금액", `₩${window.fmt(sample.amount)}`],
                ["사유", sample.detail],
              ].map(([k, v], i, arr) => (
                <div key={k} className={`flex text-[9px] ${i < arr.length - 1 ? 'border-b border-slate-200' : ''}`}>
                  <div className="w-16 flex-shrink-0 px-2 py-1.5 bg-slate-50 text-slate-500 border-r border-slate-200">{k}</div>
                  <div className="flex-1 px-2 py-1.5 font-medium">{v}</div>
                </div>
              ))}
            </div>

            {autoCEO && (
              <div className="mt-2 text-[7.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                금액 규칙 적용 — 환불 ₩{window.fmt(sample.amount)} ≥ ₩1,000,000 → 대표 승인 단계가 자동 추가되었습니다
              </div>
            )}

            {/* 후속처리 체크리스트 — 7연쇄 부분집합 */}
            <div className="mt-auto pt-2 border-t border-slate-300">
              <div className="text-[7.5px] tracking-wider text-slate-500 mb-1">최종 승인 시 자동 실행 — {orderedEffects.length}건 · 단일 트랜잭션 (하나라도 실패 시 전체 롤백)</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {orderedEffects.map((k, i) => (
                  <div key={k} className="text-[8px] flex items-center gap-1">
                    <span className="text-emerald-600 font-bold">✓</span>{i + 1}. {window.EFFECT_META[k].label}
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-200 text-[6.5px] text-slate-400">
                반려 시 위 후속 처리는 실행되지 않습니다 — 데이터 무변경 원칙(BS0006) · 데모 데이터 (실데이터 미연결)
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => navigate('console')}
              className="py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/20">
              <window.Icon name="send" className="w-3 h-3" />이 양식으로 기안
            </button>
            <button className="py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center justify-center gap-1.5">
              <window.Icon name="download" className="w-3 h-3" />PDF 내보내기
            </button>
          </div>
        </window.Card>
      </div>
    </div>
  );
}

window.Templates = Templates;
