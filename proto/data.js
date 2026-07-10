// data.js — #156767 콘텐츠/마케팅 대행사 맞춤형 통합 ERP · mock 데이터
// 규칙: 키 = 영문 camelCase / 상태값 = 대문자 영문 ENUM (한글 라벨 변환은 UI 레이어 — dashboard.jsx EnumPill)
// 모든 상호·인명·금액은 시연용 가상 데이터 (실데이터 미연결)
// 도메인 출처: domain/instances.ts (Order / ApprovalDoc / Settlement / ImportBatch / ExternalWorkerRecord)

// ── 주문 (Order) ──────────────────────────────────────────────────────
// status: RECEIVED | ASSIGNED | IN_PROGRESS | DONE | REFUND_REQUESTED | PARTIALLY_REFUNDED | CANCELLED
// taskCount/doneTaskCount/outsourcingCost = WorkTask·Assignment(rateSnapshot) 집계 파생값 — 정산 재계산 입력
const ORDERS = [
  { id: "ORD-2607-001", platform: "SMARTSTORE", clientName: "블루밍코스메틱", item: "인스타그램 릴스 15편 제작",    amount: 2400000, fee: 84000,  refundedAmount: 0,       status: "IN_PROGRESS",        assigneeId: "FR-101", dueDate: "2026-07-18", orderedAt: "2026-07-01", taskCount: 15, doneTaskCount: 9,  outsourcingCost: 1800000 },
  { id: "ORD-2607-002", platform: "COUPANG",    clientName: "한빛식품",       item: "블로그 체험단 20건 운영",      amount: 1800000, fee: 108000, refundedAmount: 0,       status: "REFUND_REQUESTED",   assigneeId: "FR-102", dueDate: "2026-07-21", orderedAt: "2026-07-02", taskCount: 20, doneTaskCount: 14, outsourcingCost: 900000 },
  { id: "ORD-2607-003", platform: "EMAIL",      clientName: "서진가구",       item: "상세페이지 리뉴얼 3종",        amount: 1650000, fee: 0,      refundedAmount: 0,       status: "DONE",               assigneeId: "FR-103", dueDate: "2026-07-08", orderedAt: "2026-07-01", taskCount: 3,  doneTaskCount: 3,  outsourcingCost: 1050000 },
  { id: "ORD-2607-004", platform: "SMARTSTORE", clientName: "라온뷰티",       item: "유튜브 쇼츠 캠페인 8편",       amount: 3200000, fee: 112000, refundedAmount: 800000,  status: "PARTIALLY_REFUNDED", assigneeId: "FR-101", dueDate: "2026-07-25", orderedAt: "2026-07-03", taskCount: 8,  doneTaskCount: 6,  outsourcingCost: 960000 },
  { id: "ORD-2607-005", platform: "MANUAL",     clientName: "그린리프상사",   item: "브랜드 블로그 월 운영 (7월)",  amount: 900000,  fee: 0,      refundedAmount: 0,       status: "ASSIGNED",           assigneeId: "FR-102", dueDate: "2026-07-31", orderedAt: "2026-07-04", taskCount: 12, doneTaskCount: 0,  outsourcingCost: 540000 },
  { id: "ORD-2607-006", platform: "COUPANG",    clientName: "다온리빙",       item: "SNS 광고 소재 10종 디자인",    amount: 1500000, fee: 90000,  refundedAmount: 0,       status: "IN_PROGRESS",        assigneeId: "FR-104", dueDate: "2026-07-17", orderedAt: "2026-07-05", taskCount: 10, doneTaskCount: 4,  outsourcingCost: 800000 },
  { id: "ORD-2607-007", platform: "SMARTSTORE", clientName: "모두의반찬",     item: "인플루언서 시딩 30명",         amount: 2700000, fee: 94500,  refundedAmount: 0,       status: "REFUND_REQUESTED",   assigneeId: "FR-105", dueDate: "2026-07-22", orderedAt: "2026-07-06", taskCount: 30, doneTaskCount: 8,  outsourcingCost: 1800000 },
  { id: "ORD-2607-008", platform: "EMAIL",      clientName: "코지홈데코",     item: "카드뉴스 12종 제작",           amount: 720000,  fee: 0,      refundedAmount: 0,       status: "RECEIVED",           assigneeId: null,     dueDate: "2026-07-24", orderedAt: "2026-07-08", taskCount: 12, doneTaskCount: 0,  outsourcingCost: 0 },
  { id: "ORD-2607-009", platform: "SMARTSTORE", clientName: "퓨어펫푸드",     item: "제품 상세 촬영·보정 25컷",     amount: 1350000, fee: 47250,  refundedAmount: 0,       status: "DONE",               assigneeId: "FR-103", dueDate: "2026-07-09", orderedAt: "2026-07-02", taskCount: 5,  doneTaskCount: 5,  outsourcingCost: 700000 },
  { id: "ORD-2607-010", platform: "MANUAL",     clientName: "윤슬주얼리",     item: "런칭 프로모션 랜딩페이지",     amount: 2000000, fee: 0,      refundedAmount: 2000000, status: "CANCELLED",          assigneeId: "FR-103", dueDate: "2026-07-15", orderedAt: "2026-07-03", taskCount: 4,  doneTaskCount: 1,  outsourcingCost: 350000 },
  { id: "ORD-2607-011", platform: "COUPANG",    clientName: "해솔건강원",     item: "체험단 리뷰 15건",             amount: 1050000, fee: 63000,  refundedAmount: 0,       status: "ASSIGNED",           assigneeId: "FR-102", dueDate: "2026-07-26", orderedAt: "2026-07-08", taskCount: 15, doneTaskCount: 0,  outsourcingCost: 675000 },
  { id: "ORD-2607-012", platform: "SMARTSTORE", clientName: "온새미로티",     item: "신제품 티저 릴스 5편",         amount: 850000,  fee: 29750,  refundedAmount: 0,       status: "RECEIVED",           assigneeId: null,     dueDate: "2026-07-28", orderedAt: "2026-07-09", taskCount: 5,  doneTaskCount: 0,  outsourcingCost: 0 },
];

// ── 전자결재 (ApprovalDoc) — 최신순 정렬 ─────────────────────────────
// status: DRAFT | SUBMITTED | APPROVED | REJECTED (표준 승인 ENUM)
// approvalLine[].status: PENDING | APPROVED | REJECTED
// REJECTED 문서는 데이터 무변경 원칙(BS0006) — resultNote에 명기
const APPROVALS = [
  {
    id: "APR-20260710-06", type: "REPAYMENT", orderId: "ORD-2607-010", requester: "이수민", amount: 1800000,
    status: "DRAFT", opinion: "취소 주문 재결제 — 사양 변경 후 재계약 (임시저장)",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approver: "박준혁", status: "PENDING" },
      { step: 2, role: "FINANCE",   approver: "정다은", status: "PENDING" },
    ],
    createdAt: "2026-07-10 11:40", decidedAt: null, resultNote: null,
  },
  {
    id: "APR-20260710-05", type: "ORDER_EDIT", orderId: "ORD-2607-006", requester: "김도윤", amount: 1650000,
    status: "REJECTED", opinion: "광고 소재 10종 → 11종 변경에 따른 주문 금액 수정",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approver: "박준혁", status: "REJECTED", comment: "변경 계약서 증빙 누락 — 첨부 후 재기안 요청", decidedAt: "2026-07-10 11:25" },
    ],
    createdAt: "2026-07-10 11:02", decidedAt: "2026-07-10 11:25",
    resultNote: "반려 확정 — 주문·매출·정산 데이터 변경 없음 (무변경 원칙 BS0006)",
  },
  {
    id: "APR-20260710-04", type: "FULL_REFUND", orderId: "ORD-2607-007", requester: "정하은", amount: 2700000,
    status: "SUBMITTED", opinion: "시딩 대상 30명 중 8명만 진행 — 고객사 전체 취소 요청",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approver: "박준혁", status: "PENDING" },
      { step: 2, role: "FINANCE",   approver: "정다은", status: "PENDING" },
      { step: 3, role: "CEO",       approver: "김민석", status: "PENDING" },
    ],
    createdAt: "2026-07-10 10:15", decidedAt: null, resultNote: null,
  },
  {
    id: "APR-20260710-03", type: "PARTIAL_REFUND", orderId: "ORD-2607-002", requester: "이수민", amount: 600000,
    status: "SUBMITTED", opinion: "체험단 20건 중 6건 미진행 — 고객 요청 부분환불",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approver: "박준혁", status: "APPROVED", comment: "미진행 6건 확인", decidedAt: "2026-07-10 10:02" },
      { step: 2, role: "FINANCE",   approver: "정다은", status: "PENDING" },
    ],
    createdAt: "2026-07-10 09:42", decidedAt: null, resultNote: null,
  },
  {
    id: "APR-20260710-02", type: "FULL_REFUND", orderId: "ORD-2607-010", requester: "김도윤", amount: 2000000,
    status: "APPROVED", opinion: "고객사 런칭 일정 취소 — 전체환불 (수행 완료 1건 외주비는 지급 유지)",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approver: "박준혁", status: "APPROVED", comment: "취소 사유 확인",           decidedAt: "2026-07-10 09:21" },
      { step: 2, role: "FINANCE",   approver: "정다은", status: "APPROVED", comment: "정산 재계산 결과 확인",    decidedAt: "2026-07-10 09:40" },
      { step: 3, role: "CEO",       approver: "김민석", status: "APPROVED", comment: "승인",                     decidedAt: "2026-07-10 09:58" },
    ],
    createdAt: "2026-07-10 09:05", decidedAt: "2026-07-10 09:58",
    resultNote: "7연쇄 반영 완료 — 주문 CANCELLED · 매출 −2,000,000 · 정산 재계산 1회 · 감사 로그 기록",
  },
  {
    id: "APR-20260710-01", type: "PARTIAL_REFUND", orderId: "ORD-2607-004", requester: "이수민", amount: 800000,
    status: "APPROVED", opinion: "쇼츠 8편 중 2편 제작 취소 — 부분환불",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approver: "박준혁", status: "APPROVED", comment: "취소 2편 확인",            decidedAt: "2026-07-10 09:08" },
      { step: 2, role: "FINANCE",   approver: "정다은", status: "APPROVED", comment: "미수행 작업 제외 확인",    decidedAt: "2026-07-10 09:20" },
    ],
    createdAt: "2026-07-10 08:55", decidedAt: "2026-07-10 09:20",
    resultNote: "7연쇄 반영 완료 — 주문 PARTIALLY_REFUNDED · 매출 −800,000 · 정산 재계산 1회 · 감사 로그 기록",
  },
];

// ── 정산 (Settlement) — profit = orderAmount − refundAmount − platformFee − outsourcingCost ──
// status: OPEN | CONFIRMED (CONFIRMED 이후 직접 수정 금지 — 조정 이벤트로만 반영, MG1003)
const SETTLEMENTS = [
  { id: "SET-2607-01", target: "콘텐츠1팀",   period: "2026-07", orderAmount: 9650000, refundAmount: 800000,  platformFee: 337750, outsourcingCost: 4820000, profit: 3692250, status: "OPEN",      recalcCount: 2 },
  { id: "SET-2607-02", target: "콘텐츠2팀",   period: "2026-07", orderAmount: 7570000, refundAmount: 2000000, platformFee: 246500, outsourcingCost: 3610000, profit: 1713500, status: "OPEN",      recalcCount: 1 },
  { id: "SET-2607-03", target: "퍼포먼스팀",  period: "2026-07", orderAmount: 5240000, refundAmount: 0,       platformFee: 183400, outsourcingCost: 2760000, profit: 2296600, status: "OPEN",      recalcCount: 0 },
  { id: "SET-2607-04", target: "인플루언서팀", period: "2026-07", orderAmount: 4180000, refundAmount: 0,       platformFee: 146300, outsourcingCost: 2340000, profit: 1693700, status: "CONFIRMED", recalcCount: 1 },
];

// ── 프리랜서 (ExternalWorkerRecord) ──────────────────────────────────
// rateType: FIXED(건당 고정) | VARIABLE(변동 단가) — 배정 시 rateSnapshot으로 고정
const FREELANCERS = [
  { id: "FR-101", name: "김서연", specialty: "영상 편집 (릴스·쇼츠)",   rateType: "FIXED",    rate: 120000, onTimeRate: 96.4, activeTasks: 4, monthSettlement: 1840000 },
  { id: "FR-102", name: "이도현", specialty: "블로그 체험단 운영",      rateType: "VARIABLE", rate: 45000,  onTimeRate: 91.2, activeTasks: 6, monthSettlement: 1260000 },
  { id: "FR-103", name: "박지우", specialty: "상세페이지 디자인",       rateType: "FIXED",    rate: 350000, onTimeRate: 98.1, activeTasks: 2, monthSettlement: 2100000 },
  { id: "FR-104", name: "최민준", specialty: "카피라이팅·광고 소재",    rateType: "FIXED",    rate: 80000,  onTimeRate: 88.7, activeTasks: 5, monthSettlement: 960000 },
  { id: "FR-105", name: "정하윤", specialty: "인플루언서 시딩 관리",    rateType: "VARIABLE", rate: 60000,  onTimeRate: 94.9, activeTasks: 3, monthSettlement: 1320000 },
];

// ── 수집 배치 (ImportBatch) — 최신순 정렬 ────────────────────────────
// source: SMARTSTORE_API | EXCEL_UPLOAD | PLAYWRIGHT_CRAWL / status: SUCCESS | FAILED | REVIEW_PENDING
// 필수 fallback 쌍: IMP-003(API 실패) → IMP-004(엑셀 업로드 대체 수집, fallbackOf: "IMP-003") — 연속 2행 유지
const IMPORT_BATCHES = [
  { id: "IMP-005", source: "PLAYWRIGHT_CRAWL", platform: "COUPANG",    status: "REVIEW_PENDING", totalRows: 31, errorRows: 3, fallbackOf: null,      collectedAt: "2026-07-10 10:40", note: "필드 매핑 변경 감지 — 검수 후 반영" },
  { id: "IMP-004", source: "EXCEL_UPLOAD",     platform: "SMARTSTORE", status: "SUCCESS",        totalRows: 45, errorRows: 2, fallbackOf: "IMP-003", collectedAt: "2026-07-10 09:10", note: "43건 등록 · 2건 오류(중복 주문) — IMP-003 실패 대체 수집" },
  { id: "IMP-003", source: "SMARTSTORE_API",   platform: "SMARTSTORE", status: "FAILED",         totalRows: 0,  errorRows: 0, fallbackOf: null,      collectedAt: "2026-07-10 06:00", note: "로그인 차단 (캡차 감지) — 세션 만료" },
  { id: "IMP-002", source: "EXCEL_UPLOAD",     platform: "COUPANG",    status: "SUCCESS",        totalRows: 52, errorRows: 1, fallbackOf: null,      collectedAt: "2026-07-09 14:20", note: "51건 등록 · 1건 오류(금액 형식)" },
  { id: "IMP-001", source: "SMARTSTORE_API",   platform: "SMARTSTORE", status: "SUCCESS",        totalRows: 28, errorRows: 0, fallbackOf: null,      collectedAt: "2026-07-08 06:00", note: null },
];

// ── 결재 양식 (ApprovalTemplate) — 5종 ───────────────────────────────
// policyMode: PRIORITY(순차 결재 — 앞 단계 승인 후 다음 활성) | BROADCAST(병렬 합의 — 동시 상신)
// followUpEffects: 최종 승인 시 자동 실행되는 후속 처리 (7연쇄 부분집합)
const APPROVAL_TEMPLATES = [
  { id: "TPL-001", name: "주문 수정",  type: "ORDER_EDIT",     policyMode: "PRIORITY",
    defaultLine: ["TEAM_LEAD"],
    followUpEffects: ["APPROVAL_STATUS", "ORDER_UPDATE", "AUDIT_LOG", "NOTIFY"] },
  { id: "TPL-002", name: "부분환불",  type: "PARTIAL_REFUND", policyMode: "PRIORITY",
    defaultLine: ["TEAM_LEAD", "FINANCE"],
    followUpEffects: ["APPROVAL_STATUS", "ORDER_STATUS", "SALES_RECALC", "SETTLEMENT_RECALC", "PROFIT_REFLECT", "AUDIT_LOG", "NOTIFY"] },
  { id: "TPL-003", name: "전체환불",  type: "FULL_REFUND",    policyMode: "PRIORITY",
    defaultLine: ["TEAM_LEAD", "FINANCE", "CEO"],
    followUpEffects: ["APPROVAL_STATUS", "ORDER_STATUS", "SALES_RECALC", "SETTLEMENT_RECALC", "PROFIT_REFLECT", "AUDIT_LOG", "NOTIFY"] },
  { id: "TPL-004", name: "재결제",    type: "REPAYMENT",      policyMode: "BROADCAST",
    defaultLine: ["TEAM_LEAD", "FINANCE"],
    followUpEffects: ["APPROVAL_STATUS", "ORDER_STATUS", "SALES_RECALC", "PROFIT_REFLECT", "AUDIT_LOG", "NOTIFY"] },
  { id: "TPL-005", name: "단가 변경", type: "RATE_CHANGE",    policyMode: "PRIORITY",
    defaultLine: ["TEAM_LEAD", "FINANCE"],
    followUpEffects: ["APPROVAL_STATUS", "SETTLEMENT_RECALC", "AUDIT_LOG", "NOTIFY"] },
];

// ── KPI 4종 + 7일 트렌드 ─────────────────────────────────────────────
const KPIS = {
  monthSales: { value: 23840000, deltaPct: 6.4,  trend: [2840000, 3120000, 2450000, 3640000, 2980000, 3310000, 3520000] },
  profit:     { value: 9396050,  deltaPct: -3.1, trend: [1120000, 1260000, 870000, 1430000, 980000, 1190000, 1240000] },
  onTimeRate: { value: 94.2,     deltaPct: 1.5,  trend: [93.1, 92.8, 94.5, 93.9, 94.7, 95.2, 94.2] },
  throughput: { value: 148,      deltaPct: 12.0, trend: [18, 22, 15, 26, 19, 23, 25] },
};

const TREND_DAYS = ["07-04", "07-05", "07-06", "07-07", "07-08", "07-09", "07-10"];

// ── 작업 (WorkTask) — 04 작업 칸반 ───────────────────────────────────
// status: TODO(대기) | IN_PROGRESS(진행중) | REVIEW(검수) | DONE(완료) — 4열 칸반 (BS0005)
// orderId → ORDERS 참조 / assigneeId → FREELANCERS 참조 (배정 교차 정합)
// priority: HIGH | NORMAL — dueDate 임박(오늘 2026-07-10 기준 D-1~2) 작업 강조
const WORK_TASKS = [
  { id: "WT-2607-001", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "릴스 1~5편 편집",        status: "DONE",        dueDate: "2026-07-08", priority: "NORMAL" },
  { id: "WT-2607-002", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "릴스 6~10편 편집",       status: "IN_PROGRESS", dueDate: "2026-07-14", priority: "HIGH"   },
  { id: "WT-2607-003", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "릴스 11~15편 편집",      status: "TODO",        dueDate: "2026-07-18", priority: "NORMAL" },
  { id: "WT-2607-004", orderId: "ORD-2607-006", assigneeId: "FR-104", title: "광고 소재 A안 카피",     status: "REVIEW",      dueDate: "2026-07-11", priority: "HIGH"   },
  { id: "WT-2607-005", orderId: "ORD-2607-006", assigneeId: "FR-104", title: "광고 소재 B안 디자인",   status: "IN_PROGRESS", dueDate: "2026-07-15", priority: "NORMAL" },
  { id: "WT-2607-006", orderId: "ORD-2607-002", assigneeId: "FR-102", title: "체험단 15~20 모집",      status: "TODO",        dueDate: "2026-07-19", priority: "NORMAL" },
  { id: "WT-2607-007", orderId: "ORD-2607-007", assigneeId: "FR-105", title: "인플루언서 9~16 시딩",   status: "IN_PROGRESS", dueDate: "2026-07-16", priority: "HIGH"   },
  { id: "WT-2607-008", orderId: "ORD-2607-009", assigneeId: "FR-103", title: "제품 상세 보정 25컷",    status: "DONE",        dueDate: "2026-07-09", priority: "NORMAL" },
  { id: "WT-2607-009", orderId: "ORD-2607-005", assigneeId: "FR-102", title: "7월 블로그 콘텐츠 기획",  status: "TODO",        dueDate: "2026-07-12", priority: "NORMAL" },
  { id: "WT-2607-010", orderId: "ORD-2607-011", assigneeId: "FR-102", title: "리뷰어 15명 배정",       status: "TODO",        dueDate: "2026-07-24", priority: "NORMAL" },
  { id: "WT-2607-011", orderId: "ORD-2607-007", assigneeId: "FR-105", title: "시딩 성과 리포트",       status: "REVIEW",      dueDate: "2026-07-20", priority: "NORMAL" },
  { id: "WT-2607-012", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "썸네일 15종 제작",       status: "REVIEW",      dueDate: "2026-07-11", priority: "HIGH"   },
];

// ── 매출 이벤트 (SalesEvent) — BS0001 부호 합산의 단위 (ADR-002) ──────
// type: ORDER(+결제) | PARTIAL_REFUND(−) | FULL_REFUND(−) | REPAYMENT(+) | FEE(−플랫폼 수수료)
// approvalId → APPROVALS 참조 (승인 반영 이벤트일 때 · 그 외 null). 반영 이벤트는 APPROVED 문서만
// 정합: ORD-2607-004(+3,200,000 −112,000 −800,000=순매출 2,288,000·부분환불 APR-01), ORD-2607-010(+2,000,000 −2,000,000=0·전체환불 APR-02)
const SALES_EVENTS = [
  { id: "SE-008", orderId: "ORD-2607-004", type: "PARTIAL_REFUND", amount: -800000,  occurredAt: "2026-07-10 09:20", approvalId: "APR-20260710-01" },
  { id: "SE-007", orderId: "ORD-2607-010", type: "FULL_REFUND",    amount: -2000000, occurredAt: "2026-07-10 09:58", approvalId: "APR-20260710-02" },
  { id: "SE-006", orderId: "ORD-2607-007", type: "ORDER",          amount: 2700000,  occurredAt: "2026-07-06 10:12", approvalId: null },
  { id: "SE-005", orderId: "ORD-2607-006", type: "ORDER",          amount: 1500000,  occurredAt: "2026-07-05 09:40", approvalId: null },
  { id: "SE-004", orderId: "ORD-2607-006", type: "FEE",            amount: -90000,   occurredAt: "2026-07-05 09:41", approvalId: null },
  { id: "SE-003", orderId: "ORD-2607-004", type: "ORDER",          amount: 3200000,  occurredAt: "2026-07-03 11:05", approvalId: null },
  { id: "SE-002", orderId: "ORD-2607-004", type: "FEE",            amount: -112000,  occurredAt: "2026-07-03 11:06", approvalId: null },
  { id: "SE-001", orderId: "ORD-2607-010", type: "ORDER",          amount: 2000000,  occurredAt: "2026-07-03 14:20", approvalId: null },
];

// ── 부서 (Department) — 07 인사·조직 ─────────────────────────────────
// headId → EMPLOYEES 참조 (부서장). 손익 귀속 태깅 단위 (BS0003)
const DEPARTMENTS = [
  { id: "DEPT-1", name: "콘텐츠팀",    headId: "EMP-03" },
  { id: "DEPT-2", name: "마케팅팀",    headId: "EMP-07" },
  { id: "DEPT-3", name: "인플루언서팀", headId: "EMP-06" },
  { id: "DEPT-4", name: "경영지원팀",  headId: "EMP-02" },
];

// ── 직원 (Employee) — 로그인 사용자 (프리랜서와 구분) ────────────────
// role: ADMIN | MANAGER | FINANCE | STAFF — ROLE_MATRIX 권한 매핑 키
// deptId → DEPARTMENTS 참조. name·직급은 APPROVALS 승인선/기안자와 정합 (박준혁·정다은·김민석 등)
const EMPLOYEES = [
  { id: "EMP-01", name: "김민석", deptId: "DEPT-4", position: "대표이사",       role: "ADMIN"   },
  { id: "EMP-02", name: "정다은", deptId: "DEPT-4", position: "재무팀장",       role: "FINANCE" },
  { id: "EMP-03", name: "박준혁", deptId: "DEPT-1", position: "콘텐츠팀장",     role: "MANAGER" },
  { id: "EMP-04", name: "이수민", deptId: "DEPT-1", position: "콘텐츠 매니저",  role: "STAFF"   },
  { id: "EMP-05", name: "김도윤", deptId: "DEPT-2", position: "퍼포먼스 매니저", role: "STAFF"   },
  { id: "EMP-06", name: "정하은", deptId: "DEPT-3", position: "인플루언서팀장",  role: "MANAGER" },
  { id: "EMP-07", name: "한소율", deptId: "DEPT-2", position: "마케팅팀장",     role: "MANAGER" },
];

// ── 역할 × 메뉴 권한 매트릭스 (MG1002 — Regulator 평가 기반) ─────────
// 9개 메뉴 키 × 4개 역할 boolean. FINANCE는 정산 가능·시스템설정 불가 등 직무 분리
const ROLE_MATRIX = {
  ADMIN:   { dashboard: true, orders: true,  kanban: true,  console: true, templates: true,  settlement: true,  hr: true,  history: true,  admin: true  },
  MANAGER: { dashboard: true, orders: true,  kanban: true,  console: true, templates: true,  settlement: true,  hr: true,  history: true,  admin: false },
  FINANCE: { dashboard: true, orders: true,  kanban: false, console: true, templates: true,  settlement: true,  hr: false, history: true,  admin: false },
  STAFF:   { dashboard: true, orders: true,  kanban: true,  console: true, templates: false, settlement: false, hr: false, history: false, admin: false },
};

// ── 연동 소스 (IntegrationSource) — 09 시스템 설정 ───────────────────
// method: API | EXCEL | CRAWL / status: CONNECTED(정상) | MANUAL(수동 대체) | ERROR(장애)
// 정합: 스마트스토어 API ERROR → 엑셀 수동 대체 (IMP-003 실패 → IMP-004), 쿠팡 크롤 검수 대기 (IMP-005)
const INTEGRATION_SOURCES = [
  { id: "INT-1", name: "스마트스토어",   method: "API",   status: "ERROR",     lastSync: "2026-07-10 06:00", note: "로그인 차단(캡차 감지) — 엑셀 업로드로 수동 대체 (IMP-003 → IMP-004)" },
  { id: "INT-2", name: "쿠팡",           method: "CRAWL", status: "MANUAL",    lastSync: "2026-07-10 10:40", note: "필드 매핑 변경 감지 — 검수 후 반영 (IMP-005 검수 대기)" },
  { id: "INT-3", name: "이메일 접수함",  method: "EXCEL", status: "CONNECTED", lastSync: "2026-07-10 09:10", note: "표준 엑셀 파서 정상 동작" },
  { id: "INT-4", name: "자사몰(Cafe24)", method: "API",   status: "CONNECTED", lastSync: "2026-07-09 23:30", note: "야간 배치 정상 동기화" },
];

// ── AI 파싱 작업 (AiParseJob) — 비정형 문서 자동 추출 검수 대기 ──────
// status: REVIEW_PENDING (사람 검수 후 반영). extracted 은닉정보(계좌)는 마스킹 표시 (MG1004)
// confidence: 0~1 (낮으면 검수 강조). name·amount 는 FREELANCERS 월정산과 정합
const AI_PARSE_JOBS = [
  { id: "AI-001", source: "인플루언서 정산서 PDF (7월)",   status: "REVIEW_PENDING", confidence: 0.92,
    extracted: { name: "정하윤", bank: "국민 ****-**-4821", amount: 1320000, campaign: "모두의반찬 인플루언서 시딩 30명" } },
  { id: "AI-002", source: "프리랜서 세금계산서 (이메일 첨부)", status: "REVIEW_PENDING", confidence: 0.78,
    extracted: { name: "박지우", bank: "신한 ****-***-3390", amount: 2100000, campaign: "서진가구 상세페이지 리뉴얼 3종" } },
];

window.ORDERS = ORDERS;
window.APPROVALS = APPROVALS;
window.SETTLEMENTS = SETTLEMENTS;
window.FREELANCERS = FREELANCERS;
window.IMPORT_BATCHES = IMPORT_BATCHES;
window.APPROVAL_TEMPLATES = APPROVAL_TEMPLATES;
window.KPIS = KPIS;
window.TREND_DAYS = TREND_DAYS;
window.WORK_TASKS = WORK_TASKS;
window.SALES_EVENTS = SALES_EVENTS;
window.DEPARTMENTS = DEPARTMENTS;
window.EMPLOYEES = EMPLOYEES;
window.ROLE_MATRIX = ROLE_MATRIX;
window.INTEGRATION_SOURCES = INTEGRATION_SOURCES;
window.AI_PARSE_JOBS = AI_PARSE_JOBS;
