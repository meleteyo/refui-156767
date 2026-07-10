// data.js — #156767 마케팅 대행사 통합 ERP · 프로토타입 v2 mock 데이터
// ─────────────────────────────────────────────────────────────────────────────
// 규칙:
//  - 전역은 전부 최상위 const — data.js는 일반 <script>라 전역 렉시컬 스코프에 공유된다.
//    jsx 파일(Babel 함수 스코프)에서는 이 전역을 '맨이름'(ORDERS, APPROVALS…)으로 읽는다.
//    (jsx끼리의 공유는 window.* 만 가능 — CONTRACT.md 파일 규약 참조)
//  - 키 = 영문 camelCase / 상태값 = 대문자 ENUM (한글 라벨은 components.jsx의 ENUM_META)
//  - 오늘 = 2026-07-10. 모든 상호·인명·금액·계좌는 시연용 가상 데이터 (실데이터 미연결).
//
// ★ 7연쇄 정합 스토리 (시연 근거 데이터 — 수정 시 전 파일 동시 수정):
//  1) APR-2026-00142 부분환불 ₩800,000 (ORD-2607-004 라온뷰티) — APPROVED 07-10 09:20
//     → ORDERS.refundedAmount 0→800,000 · SALES_EVENTS SE-016 · SETTLEMENTS SET-2607-01
//       recalcHistory(5,021,000→4,221,000) · PAYOUT_STATEMENTS PO-2607-101 소급 차감 행(−240,000)
//       · AUDIT_LOGS LOG-118~121 · NOTIFICATIONS NTF-004~005
//  2) APR-2026-00139 전체환불 ₩2,000,000 (ORD-2607-010 윤슬주얼리) — APPROVED 07-10 09:58
//     → ORDERS status REFUNDED · SE-015 · SET-2607-02 recalc(3,330,000→1,330,000)
//       · LOG-122~124 · NTF-006~008
//  3) APR-2026-00131(부분환불 −300,000) → APR-2026-00135(재결제 +150,000) (ORD-2607-009 퓨어펫푸드)
//     — 현재 매출이 이벤트 합산으로만 유도됨(BS0001)을 보여주는 왕복 스토리
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = "2026-07-10";

// 시연 시점 로그인 사용자 — 정다은(재무팀장, FINANCE): 결재함 '내 차례' 2건(00145·00147)
const CURRENT_USER_ID = "EMP-02";

// ── 부서 (Department) — 손익 귀속 태깅 단위 (BS0003) ─────────────────────────
const DEPARTMENTS = [
  { id: "DEPT-1", name: "콘텐츠1팀",   headId: "EMP-03" },
  { id: "DEPT-2", name: "콘텐츠2팀",   headId: "EMP-07" },
  { id: "DEPT-3", name: "퍼포먼스팀",  headId: "EMP-08" },
  { id: "DEPT-4", name: "인플루언서팀", headId: "EMP-06" },
  { id: "DEPT-5", name: "경영지원팀",  headId: "EMP-01" },
];

// ── 프로젝트 (Project) — 주문 귀속 상위 단위 ────────────────────────────────
const PROJECTS = [
  { id: "PRJ-01", name: "블루밍코스메틱 릴스 캠페인", clientName: "블루밍코스메틱", deptId: "DEPT-1", status: "IN_PROGRESS" },
  { id: "PRJ-02", name: "라온뷰티 쇼츠 캠페인",       clientName: "라온뷰티",       deptId: "DEPT-1", status: "IN_PROGRESS" },
  { id: "PRJ-03", name: "한빛식품 체험단 시즌2",      clientName: "한빛식품",       deptId: "DEPT-1", status: "IN_PROGRESS" },
  { id: "PRJ-04", name: "모두의반찬 인플루언서 시딩", clientName: "모두의반찬",     deptId: "DEPT-4", status: "IN_PROGRESS" },
  { id: "PRJ-05", name: "퍼포먼스 광고 소재 팩",      clientName: "다온리빙",       deptId: "DEPT-3", status: "IN_PROGRESS" },
  { id: "PRJ-06", name: "윤슬주얼리 런칭 프로모션",   clientName: "윤슬주얼리",     deptId: "DEPT-2", status: "CANCELLED" },
  { id: "PRJ-07", name: "홈·리빙 콘텐츠 번들",        clientName: "복수 고객",      deptId: "DEPT-2", status: "IN_PROGRESS" },
  { id: "PRJ-08", name: "식품 체험단 상시 운영",      clientName: "해솔건강원",     deptId: "DEPT-1", status: "CONFIRMED" },
  { id: "PRJ-09", name: "커머스 콘텐츠 파일럿",       clientName: "복수 고객",      deptId: "DEPT-1", status: "IN_PROGRESS" },
];

// ── 직원 (Employee) — 로그인 사용자 · RBAC 5종 (ADMIN/EXEC/TEAM_LEAD/FINANCE/STAFF) ──
const EMPLOYEES = [
  { id: "EMP-01", name: "김민석", deptId: "DEPT-5", position: "대표이사",         role: "EXEC",      joinedAt: "2019-03-02", active: true },
  { id: "EMP-02", name: "정다은", deptId: "DEPT-5", position: "재무팀장",         role: "FINANCE",   joinedAt: "2020-01-06", active: true },
  { id: "EMP-03", name: "박준혁", deptId: "DEPT-1", position: "콘텐츠1팀장",      role: "TEAM_LEAD", joinedAt: "2020-07-13", active: true },
  { id: "EMP-04", name: "이수민", deptId: "DEPT-1", position: "콘텐츠 매니저",    role: "STAFF",     joinedAt: "2023-02-27", active: true },
  { id: "EMP-05", name: "김도윤", deptId: "DEPT-3", position: "퍼포먼스 매니저",  role: "STAFF",     joinedAt: "2024-05-07", active: true },
  { id: "EMP-06", name: "정하은", deptId: "DEPT-4", position: "인플루언서팀장",   role: "TEAM_LEAD", joinedAt: "2021-04-19", active: true },
  { id: "EMP-07", name: "한소율", deptId: "DEPT-2", position: "콘텐츠2팀장",      role: "TEAM_LEAD", joinedAt: "2021-11-01", active: true },
  { id: "EMP-08", name: "서지원", deptId: "DEPT-3", position: "퍼포먼스팀장",     role: "TEAM_LEAD", joinedAt: "2022-03-14", active: true },
  { id: "EMP-09", name: "오세훈", deptId: "DEPT-5", position: "시스템 관리자",    role: "ADMIN",     joinedAt: "2022-08-22", active: true },
  { id: "EMP-10", name: "문가영", deptId: "DEPT-4", position: "인플루언서 매니저", role: "STAFF",     joinedAt: "2025-01-13", active: true },
];

// ── 역할 × 라우트 권한 매트릭스 (MG1005) — 22 라우트 × 5 역할 ───────────────
// 보이지 않는 메뉴는 렌더링하지 않는다(비활성 아님) — §3.2
const ROLE_MATRIX = {
  ADMIN: {
    home: true, notifications: true, profit: true,
    orders: true, orderForm: true, excelImport: true,
    workGroups: true, assign: true, kanban: true,
    draft: true, inbox: true, approvalDetail: true,
    paymentImport: true, settlement: true, payout: true, taxInvoice: true,
    freelancers: true, evalInput: true, evalReport: true,
    employees: true, permissions: true, auditLog: true,
  },
  EXEC: {
    home: true, notifications: true, profit: true,
    orders: true, orderForm: false, excelImport: false,
    workGroups: true, assign: false, kanban: true,
    draft: false, inbox: true, approvalDetail: true,
    paymentImport: false, settlement: true, payout: true, taxInvoice: true,
    freelancers: true, evalInput: false, evalReport: true,
    employees: true, permissions: false, auditLog: true,
  },
  TEAM_LEAD: {
    home: true, notifications: true, profit: true,
    orders: true, orderForm: true, excelImport: true,
    workGroups: true, assign: true, kanban: true,
    draft: true, inbox: true, approvalDetail: true,
    paymentImport: false, settlement: false, payout: false, taxInvoice: false,
    freelancers: true, evalInput: true, evalReport: true,
    employees: false, permissions: false, auditLog: true,
  },
  FINANCE: {
    home: true, notifications: true, profit: true,
    orders: true, orderForm: false, excelImport: false,
    workGroups: false, assign: false, kanban: false,
    draft: true, inbox: true, approvalDetail: true,
    paymentImport: true, settlement: true, payout: true, taxInvoice: true,
    freelancers: true, evalInput: false, evalReport: true,
    employees: false, permissions: false, auditLog: true,
  },
  STAFF: {
    home: true, notifications: true, profit: false,
    orders: true, orderForm: true, excelImport: true,
    workGroups: true, assign: false, kanban: true,
    draft: true, inbox: true, approvalDetail: true,
    paymentImport: false, settlement: false, payout: false, taxInvoice: false,
    freelancers: true, evalInput: true, evalReport: false,
    employees: false, permissions: false, auditLog: false,
  },
};

// ── 프리랜서 (ExternalWorkerRecord) — 연락처·계좌는 마스킹 상태로 저장·표시 (MG1004) ──
// rateType: FIXED(건당 고정) | VARIABLE(변동 단가) — 배정 시 rateSnapshot으로 고정 (BS0008)
const FREELANCERS = [
  { id: "FR-101", name: "김서연", specialty: "영상 편집 (릴스·쇼츠)",  rateType: "FIXED",    rate: 120000, activeTasks: 4, onTimeRate: 96.4, qualityScore: 4.8, phone: "010-****-4821", account: "국민 ****-**-4821", active: true,  monthPayout: 1320000 },
  { id: "FR-102", name: "이도현", specialty: "블로그 체험단 운영",     rateType: "VARIABLE", rate: 45000,  activeTasks: 6, onTimeRate: 91.2, qualityScore: 4.2, phone: "010-****-7702", account: "우리 ****-***-7702", active: true,  monthPayout: 630000 },
  { id: "FR-103", name: "박지우", specialty: "상세페이지 디자인",      rateType: "FIXED",    rate: 350000, activeTasks: 2, onTimeRate: 98.1, qualityScore: 4.9, phone: "010-****-3390", account: "신한 ****-***-3390", active: true,  monthPayout: 1750000 },
  { id: "FR-104", name: "최민준", specialty: "카피라이팅·광고 소재",   rateType: "FIXED",    rate: 80000,  activeTasks: 5, onTimeRate: 88.7, qualityScore: 3.9, phone: "010-****-5518", account: "하나 ****-***-5518", active: true,  monthPayout: 0 },
  { id: "FR-105", name: "정하윤", specialty: "인플루언서 시딩 관리",   rateType: "VARIABLE", rate: 60000,  activeTasks: 3, onTimeRate: 94.9, qualityScore: 4.5, phone: "010-****-9047", account: "국민 ****-**-9047", active: true,  monthPayout: 0 },
  { id: "FR-106", name: "한지민", specialty: "제품 촬영·보정",         rateType: "FIXED",    rate: 200000, activeTasks: 0, onTimeRate: 92.0, qualityScore: 4.0, phone: "010-****-2214", account: "카카오 ****-**-2214", active: false, monthPayout: 0 },
];

// ── 주문 (Order) — BS0010 상태 · 부서/프로젝트 귀속 ─────────────────────────
// status: RECEIVED(접수) | CONFIRMED(확정) | IN_PROGRESS(진행중) | DONE(완료)
//       | PARTIALLY_REFUNDED(부분환불) | REFUNDED(전체환불) | CANCELLED(취소)
// amount = 원 주문 금액(불변 🔒, BS0001) / refundedAmount = 기환불 누계
// 현재 매출 = SALES_EVENTS 부호 합산으로 유도 (필드로 저장하지 않는다 — P1)
// activeApprovalId = 진행 중 결재 홀드 배지(IDEA-11) 근거
const ORDERS = [
  { id: "ORD-2607-001", platform: "SMARTSTORE", clientName: "블루밍코스메틱", item: "인스타그램 릴스 15편 제작",   deptId: "DEPT-1", projectId: "PRJ-01", managerId: "EMP-04", amount: 2400000, fee: 84000,  refundedAmount: 0,       status: "IN_PROGRESS",        dueDate: "2026-07-18", orderedAt: "2026-07-01", taskCount: 15, doneTaskCount: 9,  outsourcingCost: 1800000, activeApprovalId: null },
  { id: "ORD-2607-002", platform: "COUPANG",    clientName: "한빛식품",       item: "블로그 체험단 20건 운영",     deptId: "DEPT-1", projectId: "PRJ-03", managerId: "EMP-04", amount: 1800000, fee: 108000, refundedAmount: 0,       status: "IN_PROGRESS",        dueDate: "2026-07-21", orderedAt: "2026-07-02", taskCount: 20, doneTaskCount: 14, outsourcingCost: 900000,  activeApprovalId: "APR-2026-00145" },
  { id: "ORD-2607-003", platform: "EMAIL",      clientName: "서진가구",       item: "상세페이지 리뉴얼 3종",       deptId: "DEPT-2", projectId: "PRJ-07", managerId: "EMP-07", amount: 1650000, fee: 0,      refundedAmount: 0,       status: "DONE",               dueDate: "2026-07-08", orderedAt: "2026-07-01", taskCount: 3,  doneTaskCount: 3,  outsourcingCost: 1050000, activeApprovalId: null },
  { id: "ORD-2607-004", platform: "SMARTSTORE", clientName: "라온뷰티",       item: "유튜브 쇼츠 캠페인 8편",      deptId: "DEPT-1", projectId: "PRJ-02", managerId: "EMP-04", amount: 3200000, fee: 112000, refundedAmount: 800000,  status: "PARTIALLY_REFUNDED", dueDate: "2026-07-25", orderedAt: "2026-07-03", taskCount: 8,  doneTaskCount: 6,  outsourcingCost: 960000,  activeApprovalId: null },
  { id: "ORD-2607-005", platform: "MANUAL",     clientName: "그린리프상사",   item: "브랜드 블로그 월 운영 (7월)", deptId: "DEPT-2", projectId: "PRJ-07", managerId: "EMP-07", amount: 900000,  fee: 0,      refundedAmount: 0,       status: "CONFIRMED",          dueDate: "2026-07-31", orderedAt: "2026-07-04", taskCount: 12, doneTaskCount: 0,  outsourcingCost: 540000,  activeApprovalId: null },
  { id: "ORD-2607-006", platform: "COUPANG",    clientName: "다온리빙",       item: "SNS 광고 소재 10종 디자인",   deptId: "DEPT-3", projectId: "PRJ-05", managerId: "EMP-05", amount: 1500000, fee: 90000,  refundedAmount: 0,       status: "IN_PROGRESS",        dueDate: "2026-07-17", orderedAt: "2026-07-05", taskCount: 10, doneTaskCount: 4,  outsourcingCost: 800000,  activeApprovalId: null },
  { id: "ORD-2607-007", platform: "SMARTSTORE", clientName: "모두의반찬",     item: "인플루언서 시딩 30명",        deptId: "DEPT-4", projectId: "PRJ-04", managerId: "EMP-10", amount: 2700000, fee: 94500,  refundedAmount: 0,       status: "IN_PROGRESS",        dueDate: "2026-07-22", orderedAt: "2026-07-06", taskCount: 30, doneTaskCount: 8,  outsourcingCost: 1800000, activeApprovalId: "APR-2026-00146" },
  { id: "ORD-2607-008", platform: "EMAIL",      clientName: "코지홈데코",     item: "카드뉴스 12종 제작",          deptId: "DEPT-2", projectId: "PRJ-07", managerId: "EMP-07", amount: 720000,  fee: 0,      refundedAmount: 0,       status: "RECEIVED",           dueDate: "2026-07-24", orderedAt: "2026-07-08", taskCount: 12, doneTaskCount: 0,  outsourcingCost: 0,       activeApprovalId: null },
  { id: "ORD-2607-009", platform: "SMARTSTORE", clientName: "퓨어펫푸드",     item: "제품 상세 촬영·보정 25컷",    deptId: "DEPT-1", projectId: "PRJ-09", managerId: "EMP-04", amount: 1350000, fee: 47250,  refundedAmount: 300000,  status: "PARTIALLY_REFUNDED", dueDate: "2026-07-09", orderedAt: "2026-07-02", taskCount: 5,  doneTaskCount: 5,  outsourcingCost: 700000,  activeApprovalId: null },
  { id: "ORD-2607-010", platform: "MANUAL",     clientName: "윤슬주얼리",     item: "런칭 프로모션 랜딩페이지",    deptId: "DEPT-2", projectId: "PRJ-06", managerId: "EMP-07", amount: 2000000, fee: 0,      refundedAmount: 2000000, status: "REFUNDED",           dueDate: "2026-07-15", orderedAt: "2026-07-03", taskCount: 4,  doneTaskCount: 1,  outsourcingCost: 350000,  activeApprovalId: null },
  { id: "ORD-2607-011", platform: "COUPANG",    clientName: "해솔건강원",     item: "체험단 리뷰 15건",            deptId: "DEPT-1", projectId: "PRJ-08", managerId: "EMP-04", amount: 1050000, fee: 63000,  refundedAmount: 0,       status: "CONFIRMED",          dueDate: "2026-07-26", orderedAt: "2026-07-08", taskCount: 15, doneTaskCount: 0,  outsourcingCost: 675000,  activeApprovalId: null },
  { id: "ORD-2607-012", platform: "SMARTSTORE", clientName: "온새미로티",     item: "신제품 티저 릴스 5편",        deptId: "DEPT-1", projectId: "PRJ-09", managerId: "EMP-04", amount: 850000,  fee: 29750,  refundedAmount: 0,       status: "RECEIVED",           dueDate: "2026-07-28", orderedAt: "2026-07-09", taskCount: 5,  doneTaskCount: 0,  outsourcingCost: 0,       activeApprovalId: null },
];

// ── 매출 이벤트 (SalesEvent) — BS0001 부호 합산의 단위, 최신순 ───────────────
// type: PAYMENT(+) | PARTIAL_REFUND(−) | FULL_REFUND(−) | REPAYMENT(+)
// 현재 매출(주문) = 해당 orderId 이벤트 amount 합산. approvalId는 승인 반영 이벤트만.
// 검산: ORD-2607-004 = +3,200,000 −800,000 = 2,400,000
//       ORD-2607-009 = +1,350,000 −300,000 +150,000 = 1,200,000
//       ORD-2607-010 = +2,000,000 −2,000,000 = 0
//       월 매출 합계 = 20,120,000(결제) − 3,100,000(환불) + 150,000(재결제) = 17,170,000
const SALES_EVENTS = [
  { id: "SE-016", orderId: "ORD-2607-004", type: "PARTIAL_REFUND", amount: -800000,  occurredAt: "2026-07-10 09:20", approvalId: "APR-2026-00142" },
  { id: "SE-015", orderId: "ORD-2607-010", type: "FULL_REFUND",    amount: -2000000, occurredAt: "2026-07-10 09:58", approvalId: "APR-2026-00139" },
  { id: "SE-014", orderId: "ORD-2607-009", type: "REPAYMENT",      amount: 150000,   occurredAt: "2026-07-08 11:20", approvalId: "APR-2026-00135" },
  { id: "SE-013", orderId: "ORD-2607-009", type: "PARTIAL_REFUND", amount: -300000,  occurredAt: "2026-07-05 14:30", approvalId: "APR-2026-00131" },
  { id: "SE-012", orderId: "ORD-2607-012", type: "PAYMENT",        amount: 850000,   occurredAt: "2026-07-09 10:05", approvalId: null },
  { id: "SE-011", orderId: "ORD-2607-011", type: "PAYMENT",        amount: 1050000,  occurredAt: "2026-07-08 15:40", approvalId: null },
  { id: "SE-010", orderId: "ORD-2607-008", type: "PAYMENT",        amount: 720000,   occurredAt: "2026-07-08 09:30", approvalId: null },
  { id: "SE-009", orderId: "ORD-2607-007", type: "PAYMENT",        amount: 2700000,  occurredAt: "2026-07-06 10:12", approvalId: null },
  { id: "SE-008", orderId: "ORD-2607-006", type: "PAYMENT",        amount: 1500000,  occurredAt: "2026-07-05 09:40", approvalId: null },
  { id: "SE-007", orderId: "ORD-2607-005", type: "PAYMENT",        amount: 900000,   occurredAt: "2026-07-04 13:20", approvalId: null },
  { id: "SE-006", orderId: "ORD-2607-010", type: "PAYMENT",        amount: 2000000,  occurredAt: "2026-07-03 14:20", approvalId: null },
  { id: "SE-005", orderId: "ORD-2607-004", type: "PAYMENT",        amount: 3200000,  occurredAt: "2026-07-03 11:05", approvalId: null },
  { id: "SE-004", orderId: "ORD-2607-009", type: "PAYMENT",        amount: 1350000,  occurredAt: "2026-07-02 16:00", approvalId: null },
  { id: "SE-003", orderId: "ORD-2607-002", type: "PAYMENT",        amount: 1800000,  occurredAt: "2026-07-02 10:30", approvalId: null },
  { id: "SE-002", orderId: "ORD-2607-003", type: "PAYMENT",        amount: 1650000,  occurredAt: "2026-07-01 14:45", approvalId: null },
  { id: "SE-001", orderId: "ORD-2607-001", type: "PAYMENT",        amount: 2400000,  occurredAt: "2026-07-01 09:15", approvalId: null },
];

// ── 작업 그룹 (WorkGroup) ────────────────────────────────────────────────────
const WORK_GROUPS = [
  { id: "WG-01", name: "릴스 15편 제작",       orderId: "ORD-2607-001", deptId: "DEPT-1", ownerId: "EMP-04", taskCount: 15, doneCount: 9, dueDate: "2026-07-18" },
  { id: "WG-02", name: "체험단 20건 운영",     orderId: "ORD-2607-002", deptId: "DEPT-1", ownerId: "EMP-04", taskCount: 20, doneCount: 14, dueDate: "2026-07-21" },
  { id: "WG-03", name: "광고 소재 10종",       orderId: "ORD-2607-006", deptId: "DEPT-3", ownerId: "EMP-05", taskCount: 10, doneCount: 4, dueDate: "2026-07-17" },
  { id: "WG-04", name: "인플루언서 시딩 30명", orderId: "ORD-2607-007", deptId: "DEPT-4", ownerId: "EMP-10", taskCount: 30, doneCount: 8, dueDate: "2026-07-22" },
  { id: "WG-05", name: "7월 블로그 운영",      orderId: "ORD-2607-005", deptId: "DEPT-2", ownerId: "EMP-07", taskCount: 12, doneCount: 0, dueDate: "2026-07-31" },
  { id: "WG-06", name: "상세 촬영·보정",       orderId: "ORD-2607-009", deptId: "DEPT-1", ownerId: "EMP-04", taskCount: 5,  doneCount: 5, dueDate: "2026-07-09" },
  { id: "WG-07", name: "체험단 리뷰 15건",     orderId: "ORD-2607-011", deptId: "DEPT-1", ownerId: "EMP-04", taskCount: 15, doneCount: 0, dueDate: "2026-07-26" },
];

// ── 작업 (Task) — 칸반 5컬럼 (BS0005) ────────────────────────────────────────
// status: WAITING(대기) | IN_PROGRESS(진행중) | REVIEW(검수) | DONE(완료) | ON_HOLD(보류)
// ON_HOLD는 holdReason 필수(사유 모달 — IDEA-13). assigneeId null = 미배정(배정 화면 큐)
const TASKS = [
  { id: "TSK-001", workGroupId: "WG-01", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "릴스 1~5편 편집",       status: "DONE",        dueDate: "2026-07-08", priority: "NORMAL", holdReason: null },
  { id: "TSK-002", workGroupId: "WG-01", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "릴스 6~10편 편집",      status: "IN_PROGRESS", dueDate: "2026-07-14", priority: "HIGH",   holdReason: null },
  { id: "TSK-003", workGroupId: "WG-01", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "릴스 11~15편 편집",     status: "WAITING",     dueDate: "2026-07-18", priority: "NORMAL", holdReason: null },
  { id: "TSK-004", workGroupId: "WG-03", orderId: "ORD-2607-006", assigneeId: "FR-104", title: "광고 소재 A안 카피",    status: "REVIEW",      dueDate: "2026-07-11", priority: "HIGH",   holdReason: null },
  { id: "TSK-005", workGroupId: "WG-03", orderId: "ORD-2607-006", assigneeId: "FR-104", title: "광고 소재 B안 디자인",  status: "IN_PROGRESS", dueDate: "2026-07-15", priority: "NORMAL", holdReason: null },
  { id: "TSK-006", workGroupId: "WG-02", orderId: "ORD-2607-002", assigneeId: "FR-102", title: "체험단 15~20 모집",     status: "ON_HOLD",     dueDate: "2026-07-19", priority: "NORMAL", holdReason: "부분환불 결재 진행 중 — 범위 확정 대기 (APR-2026-00145)" },
  { id: "TSK-007", workGroupId: "WG-04", orderId: "ORD-2607-007", assigneeId: "FR-105", title: "인플루언서 9~16 시딩",  status: "ON_HOLD",     dueDate: "2026-07-16", priority: "HIGH",   holdReason: "전체환불 결재 진행 중 (APR-2026-00146)" },
  { id: "TSK-008", workGroupId: "WG-06", orderId: "ORD-2607-009", assigneeId: "FR-103", title: "제품 상세 보정 25컷",   status: "DONE",        dueDate: "2026-07-09", priority: "NORMAL", holdReason: null },
  { id: "TSK-009", workGroupId: "WG-05", orderId: "ORD-2607-005", assigneeId: "FR-102", title: "7월 블로그 콘텐츠 기획", status: "WAITING",     dueDate: "2026-07-12", priority: "NORMAL", holdReason: null },
  { id: "TSK-010", workGroupId: "WG-07", orderId: "ORD-2607-011", assigneeId: null,     title: "리뷰어 15명 배정",      status: "WAITING",     dueDate: "2026-07-24", priority: "NORMAL", holdReason: null },
  { id: "TSK-011", workGroupId: "WG-04", orderId: "ORD-2607-007", assigneeId: "FR-105", title: "시딩 성과 리포트",      status: "REVIEW",      dueDate: "2026-07-20", priority: "NORMAL", holdReason: null },
  { id: "TSK-012", workGroupId: "WG-01", orderId: "ORD-2607-001", assigneeId: "FR-101", title: "썸네일 15종 제작",      status: "REVIEW",      dueDate: "2026-07-11", priority: "HIGH",   holdReason: null },
  { id: "TSK-013", workGroupId: "WG-03", orderId: "ORD-2607-006", assigneeId: null,     title: "광고 소재 C안 카피",    status: "WAITING",     dueDate: "2026-07-16", priority: "NORMAL", holdReason: null },
  { id: "TSK-014", workGroupId: "WG-06", orderId: "ORD-2607-009", assigneeId: "FR-103", title: "보정본 납품 정리",      status: "DONE",        dueDate: "2026-07-09", priority: "NORMAL", holdReason: null },
];

// ── 칸반 컬럼 순서 + 상태 전이 규칙 (BS0005) ────────────────────────────────
const KANBAN_COLUMNS = ["WAITING", "IN_PROGRESS", "REVIEW", "DONE", "ON_HOLD"];
const TRANSITION_RULES = {
  WAITING:     ["IN_PROGRESS", "ON_HOLD"],
  IN_PROGRESS: ["REVIEW", "ON_HOLD"],
  REVIEW:      ["DONE", "IN_PROGRESS", "ON_HOLD"],
  DONE:        [],
  ON_HOLD:     ["WAITING", "IN_PROGRESS"],
};
// 비허용 전이 스냅백 토스트 문구 (실무 언어, §4.10) — key: `${from}>${to}`
const TRANSITION_DENY_MESSAGES = {
  "IN_PROGRESS>DONE": "검수를 건너뛰고 완료할 수 없어요",
  "WAITING>DONE":     "시작하지 않은 작업은 완료할 수 없어요",
  "WAITING>REVIEW":   "진행 전 작업은 검수로 보낼 수 없어요",
  "DONE>*":           "완료된 작업은 되돌릴 수 없어요 — 새 작업으로 등록해 주세요",
};
// ON_HOLD 진입은 사유 입력 필수 (사유 모달)
const HOLD_REQUIRES_REASON = true;

// ── 배정 (Assignment) — rateSnapshot: 배정 시점 단가 고정 (BS0008) ───────────
const ASSIGNMENTS = [
  { id: "ASG-001", taskId: "TSK-001", freelancerId: "FR-101", rateSnapshot: 120000, assignedAt: "2026-07-01 10:20", assignedById: "EMP-03" },
  { id: "ASG-002", taskId: "TSK-002", freelancerId: "FR-101", rateSnapshot: 120000, assignedAt: "2026-07-01 10:20", assignedById: "EMP-03" },
  { id: "ASG-003", taskId: "TSK-003", freelancerId: "FR-101", rateSnapshot: 120000, assignedAt: "2026-07-01 10:21", assignedById: "EMP-03" },
  { id: "ASG-004", taskId: "TSK-004", freelancerId: "FR-104", rateSnapshot: 80000,  assignedAt: "2026-07-05 11:00", assignedById: "EMP-08" },
  { id: "ASG-005", taskId: "TSK-005", freelancerId: "FR-104", rateSnapshot: 80000,  assignedAt: "2026-07-05 11:00", assignedById: "EMP-08" },
  { id: "ASG-006", taskId: "TSK-006", freelancerId: "FR-102", rateSnapshot: 45000,  assignedAt: "2026-07-03 09:30", assignedById: "EMP-03" },
  { id: "ASG-007", taskId: "TSK-007", freelancerId: "FR-105", rateSnapshot: 60000,  assignedAt: "2026-07-06 14:10", assignedById: "EMP-06" },
  { id: "ASG-008", taskId: "TSK-008", freelancerId: "FR-103", rateSnapshot: 350000, assignedAt: "2026-07-02 17:00", assignedById: "EMP-03" },
  { id: "ASG-009", taskId: "TSK-009", freelancerId: "FR-102", rateSnapshot: 45000,  assignedAt: "2026-07-04 15:45", assignedById: "EMP-07" },
  { id: "ASG-010", taskId: "TSK-011", freelancerId: "FR-105", rateSnapshot: 60000,  assignedAt: "2026-07-06 14:10", assignedById: "EMP-06" },
  { id: "ASG-011", taskId: "TSK-012", freelancerId: "FR-101", rateSnapshot: 120000, assignedAt: "2026-07-02 09:00", assignedById: "EMP-03" },
  { id: "ASG-012", taskId: "TSK-014", freelancerId: "FR-103", rateSnapshot: 350000, assignedAt: "2026-07-02 17:00", assignedById: "EMP-03" },
];

// ── 승인선 규칙 (금액 임계 — MG1002) ────────────────────────────────────────
// threshold: 이 금액 '이하'에 적용 (null = 상한 없음 / 전건). 기안 상신 시 금액으로 라인 자동 결정.
const APPROVAL_LINE_RULES = [
  { id: "RULE-01", docType: "ORDER_EDIT",       threshold: null,    line: ["TEAM_LEAD"],                  label: "주문 수정 — 전건" },
  { id: "RULE-02", docType: "PARTIAL_REFUND",   threshold: 1000000, line: ["TEAM_LEAD", "FINANCE"],       label: "부분환불 ≤ ₩1,000,000" },
  { id: "RULE-03", docType: "PARTIAL_REFUND",   threshold: null,    line: ["TEAM_LEAD", "FINANCE", "EXEC"], label: "부분환불 > ₩1,000,000" },
  { id: "RULE-04", docType: "FULL_REFUND",      threshold: null,    line: ["TEAM_LEAD", "FINANCE", "EXEC"], label: "전체환불 — 전건 (고위험 Type-to-Confirm)" },
  { id: "RULE-05", docType: "REPAYMENT",        threshold: null,    line: ["TEAM_LEAD", "FINANCE"],       label: "재결제 — 전건" },
  { id: "RULE-06", docType: "RATE_CHANGE",      threshold: null,    line: ["TEAM_LEAD", "FINANCE"],       label: "단가 변경 — 전건" },
  { id: "RULE-07", docType: "SETTLEMENT_ADJUST", threshold: null,   line: ["FINANCE", "EXEC"],            label: "확정 정산 조정 — 전건 (MG1003)" },
];

// ── 전자결재 (ApprovalDoc) — APR-2026-nnnnn, 최신순 ─────────────────────────
// status: IN_PROGRESS(진행 중) | APPROVED(승인완료) | REJECTED(반려)
// approvalLine[].status: PENDING | APPROVED | REJECTED — 순차(PRIORITY) 기준, 첫 PENDING이 '내 차례'
// expectedDiff: 반영 예상 3열(현재/승인 후/차액) 행 (IDEA-08). type: money | status | note
// chainReceipt: 최종 승인 시 7연쇄 반영 영수증(영구 저장) — APPROVED 문서만 보유
// risk: ConfirmDialog 마찰 단계 (§4.6) — high는 Type-to-Confirm
const APPROVALS = [
  {
    id: "APR-2026-00147", type: "RATE_CHANGE", orderId: null, freelancerId: "FR-104",
    requesterId: "EMP-04", requester: "이수민", amount: 90000, risk: "mid",
    status: "IN_PROGRESS", opinion: "최민준 단가 ₩80,000 → ₩90,000 인상 — 3개월 연속 품질 지표 상승",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-03", approver: "박준혁", status: "APPROVED", comment: "품질 지표 확인", decidedAt: "2026-07-10 10:31" },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "PENDING",  comment: null, decidedAt: null },
    ],
    expectedDiff: [
      { field: "rate",     label: "기준 단가 (FR-104 최민준)", type: "money", before: 80000, after: 90000, delta: 10000 },
      { field: "snapshot", label: "기존 배정 5건",             type: "note",  note: "rateSnapshot ₩80,000 유지 — 배정 시점 단가 고정 (BS0008)" },
    ],
    createdAt: "2026-07-10 10:28", decidedAt: null, chainReceipt: null, resultNote: null,
  },
  {
    id: "APR-2026-00146", type: "FULL_REFUND", orderId: "ORD-2607-007", freelancerId: null,
    requesterId: "EMP-10", requester: "문가영", amount: 2700000, risk: "high",
    status: "IN_PROGRESS", opinion: "시딩 대상 30명 중 8명만 진행 — 고객사 전체 취소 요청",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-06", approver: "정하은", status: "PENDING", comment: null, decidedAt: null },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "PENDING", comment: null, decidedAt: null },
      { step: 3, role: "EXEC",      approverId: "EMP-01", approver: "김민석", status: "PENDING", comment: null, decidedAt: null },
    ],
    expectedDiff: [
      { field: "orderStatus",  label: "주문 상태 (ORD-2607-007)",       type: "status", before: "IN_PROGRESS", after: "REFUNDED" },
      { field: "currentSales", label: "현재 매출 (ORD-2607-007)",       type: "money",  before: 2700000, after: 0, delta: -2700000 },
      { field: "settlement",   label: "정산 (인플루언서팀 7월 · 확정됨)", type: "note",   note: "확정 정산은 직접 수정 불가 — 조정 이벤트 −₩2,700,000으로 적재 (MG1003)" },
      { field: "payout",       label: "외주 지급 (FR-105 정하윤)",       type: "note",   note: "수행 완료 8명분 ₩480,000 지급 유지 · 미수행 22명분 미발생" },
    ],
    createdAt: "2026-07-10 10:15", decidedAt: null, chainReceipt: null, resultNote: null,
  },
  {
    id: "APR-2026-00145", type: "PARTIAL_REFUND", orderId: "ORD-2607-002", freelancerId: null,
    requesterId: "EMP-04", requester: "이수민", amount: 540000, risk: "mid",
    status: "IN_PROGRESS", opinion: "체험단 20건 중 6건 미진행 — 고객 요청 부분환불 (6건 × ₩90,000)",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-03", approver: "박준혁", status: "APPROVED", comment: "미진행 6건 확인", decidedAt: "2026-07-10 10:02" },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "PENDING",  comment: null, decidedAt: null },
    ],
    expectedDiff: [
      { field: "orderStatus",  label: "주문 상태 (ORD-2607-002)",     type: "status", before: "IN_PROGRESS", after: "PARTIALLY_REFUNDED" },
      { field: "currentSales", label: "현재 매출 (ORD-2607-002)",     type: "money",  before: 1800000, after: 1260000, delta: -540000 },
      { field: "settlement",   label: "정산 손익 (콘텐츠1팀 7월)",     type: "money",  before: 4221000, after: 3681000, delta: -540000 },
      { field: "outsourcing",  label: "외주비 (FR-102 이도현)",        type: "note",   note: "미진행 6건 미배정 — 차감 없음" },
    ],
    createdAt: "2026-07-10 09:42", decidedAt: null, chainReceipt: null, resultNote: null,
  },
  {
    id: "APR-2026-00144", type: "ORDER_EDIT", orderId: "ORD-2607-006", freelancerId: null,
    requesterId: "EMP-05", requester: "김도윤", amount: 1650000, risk: "low",
    status: "REJECTED", opinion: "광고 소재 10종 → 11종 변경에 따른 주문 금액 수정",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-08", approver: "서지원", status: "REJECTED", comment: "변경 계약서 증빙 누락 — 첨부 후 재기안 요청", decidedAt: "2026-07-10 11:25" },
    ],
    expectedDiff: [
      { field: "amount", label: "주문 금액 (ORD-2607-006)", type: "money", before: 1500000, after: 1650000, delta: 150000 },
    ],
    createdAt: "2026-07-10 11:02", decidedAt: "2026-07-10 11:25", chainReceipt: null,
    resultNote: "반려 확정 — 주문·매출·정산 데이터 변경 없음 (무변경 원칙 BS0006)",
  },
  {
    id: "APR-2026-00142", type: "PARTIAL_REFUND", orderId: "ORD-2607-004", freelancerId: null,
    requesterId: "EMP-04", requester: "이수민", amount: 800000, risk: "mid",
    status: "APPROVED", opinion: "쇼츠 8편 중 2편 제작 취소 — 부분환불 (2편 × ₩400,000)",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-03", approver: "박준혁", status: "APPROVED", comment: "취소 2편 확인",         decidedAt: "2026-07-10 09:08" },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "APPROVED", comment: "재계산 결과 확인",      decidedAt: "2026-07-10 09:20" },
    ],
    expectedDiff: [
      { field: "orderStatus",  label: "주문 상태 (ORD-2607-004)",   type: "status", before: "IN_PROGRESS", after: "PARTIALLY_REFUNDED" },
      { field: "currentSales", label: "현재 매출 (ORD-2607-004)",   type: "money",  before: 3200000, after: 2400000, delta: -800000 },
      { field: "settlement",   label: "정산 손익 (콘텐츠1팀 7월)",   type: "money",  before: 5021000, after: 4221000, delta: -800000 },
      { field: "payout",       label: "지급 명세서 (FR-101 김서연)", type: "money",  before: 1560000, after: 1320000, delta: -240000 },
    ],
    createdAt: "2026-07-10 08:55", decidedAt: "2026-07-10 09:20",
    chainReceipt: [
      { step: 1, label: "결재 확정",   result: "APPROVED · 최종 승인 정다은",                          at: "2026-07-10 09:20:01", async: false },
      { step: 2, label: "주문 상태",   result: "IN_PROGRESS → PARTIALLY_REFUNDED",                    at: "2026-07-10 09:20:01", async: false },
      { step: 3, label: "매출 이벤트", result: "PARTIAL_REFUND −₩800,000 적재 (SE-016)",              at: "2026-07-10 09:20:01", async: false },
      { step: 4, label: "정산 재계산", result: "콘텐츠1팀 7월 ₩5,021,000 → ₩4,221,000 (이력 적재)",  at: "2026-07-10 09:20:02", async: false },
      { step: 5, label: "손익 반영",   result: "콘텐츠1팀 손익 −₩800,000 · 지급 차감 −₩240,000",     at: "2026-07-10 09:20:02", async: false },
      { step: 6, label: "감사 로그",   result: "LOG-118 ~ LOG-121 기록",                              at: "2026-07-10 09:20:02", async: false },
      { step: 7, label: "알림 발송",   result: "관련자 3명 · 이메일 병행",                            at: "2026-07-10 09:20:03", async: true },
    ],
    resultNote: "7연쇄 반영 완료 — 예상치와 일치 ✓",
  },
  {
    id: "APR-2026-00139", type: "FULL_REFUND", orderId: "ORD-2607-010", freelancerId: null,
    requesterId: "EMP-07", requester: "한소율", amount: 2000000, risk: "high",
    status: "APPROVED", opinion: "고객사 런칭 일정 취소 — 전체환불 (수행 완료 1건 외주비 ₩350,000 지급 유지)",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-07", approver: "한소율", status: "APPROVED", comment: "기안자 겸 팀장 — 취소 사유 확인", decidedAt: "2026-07-10 09:21" },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "APPROVED", comment: "정산 재계산 결과 확인",           decidedAt: "2026-07-10 09:40" },
      { step: 3, role: "EXEC",      approverId: "EMP-01", approver: "김민석", status: "APPROVED", comment: "승인",                            decidedAt: "2026-07-10 09:58" },
    ],
    expectedDiff: [
      { field: "orderStatus",  label: "주문 상태 (ORD-2607-010)",   type: "status", before: "IN_PROGRESS", after: "REFUNDED" },
      { field: "currentSales", label: "현재 매출 (ORD-2607-010)",   type: "money",  before: 2000000, after: 0, delta: -2000000 },
      { field: "settlement",   label: "정산 손익 (콘텐츠2팀 7월)",   type: "money",  before: 3330000, after: 1330000, delta: -2000000 },
      { field: "payout",       label: "외주 지급 (FR-103 박지우)",   type: "note",   note: "수행 완료 1건 ₩350,000 지급 유지 — 소급 차감 없음" },
    ],
    createdAt: "2026-07-10 09:05", decidedAt: "2026-07-10 09:58",
    chainReceipt: [
      { step: 1, label: "결재 확정",   result: "APPROVED · 최종 승인 김민석",                         at: "2026-07-10 09:58:01", async: false },
      { step: 2, label: "주문 상태",   result: "IN_PROGRESS → REFUNDED",                             at: "2026-07-10 09:58:01", async: false },
      { step: 3, label: "매출 이벤트", result: "FULL_REFUND −₩2,000,000 적재 (SE-015)",              at: "2026-07-10 09:58:01", async: false },
      { step: 4, label: "정산 재계산", result: "콘텐츠2팀 7월 ₩3,330,000 → ₩1,330,000 (이력 적재)", at: "2026-07-10 09:58:02", async: false },
      { step: 5, label: "손익 반영",   result: "콘텐츠2팀 손익 −₩2,000,000",                         at: "2026-07-10 09:58:02", async: false },
      { step: 6, label: "감사 로그",   result: "LOG-122 ~ LOG-124 기록",                             at: "2026-07-10 09:58:02", async: false },
      { step: 7, label: "알림 발송",   result: "관련자 4명 · 이메일 병행",                           at: "2026-07-10 09:58:03", async: true },
    ],
    resultNote: "7연쇄 반영 완료 — 예상치와 일치 ✓",
  },
  {
    id: "APR-2026-00135", type: "REPAYMENT", orderId: "ORD-2607-009", freelancerId: null,
    requesterId: "EMP-04", requester: "이수민", amount: 150000, risk: "mid",
    status: "APPROVED", opinion: "부분환불(00131) 후 고객 협의 — 보정 3컷 추가 진행분 재결제 +₩150,000",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-03", approver: "박준혁", status: "APPROVED", comment: "추가 진행 합의 확인", decidedAt: "2026-07-08 10:50" },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "APPROVED", comment: "입금 확인",           decidedAt: "2026-07-08 11:20" },
    ],
    expectedDiff: [
      { field: "currentSales", label: "현재 매출 (ORD-2607-009)", type: "money", before: 1050000, after: 1200000, delta: 150000 },
      { field: "settlement",   label: "정산 손익 (콘텐츠1팀 7월)", type: "money", before: 4871000, after: 5021000, delta: 150000 },
    ],
    createdAt: "2026-07-08 10:35", decidedAt: "2026-07-08 11:20",
    chainReceipt: [
      { step: 1, label: "결재 확정",   result: "APPROVED · 최종 승인 정다은",                        at: "2026-07-08 11:20:01", async: false },
      { step: 2, label: "주문 상태",   result: "PARTIALLY_REFUNDED 유지 (기환불 누계 불변)",         at: "2026-07-08 11:20:01", async: false },
      { step: 3, label: "매출 이벤트", result: "REPAYMENT +₩150,000 적재 (SE-014)",                 at: "2026-07-08 11:20:01", async: false },
      { step: 4, label: "정산 재계산", result: "콘텐츠1팀 7월 ₩4,871,000 → ₩5,021,000 (이력 적재)", at: "2026-07-08 11:20:02", async: false },
      { step: 5, label: "손익 반영",   result: "콘텐츠1팀 손익 +₩150,000",                          at: "2026-07-08 11:20:02", async: false },
      { step: 6, label: "감사 로그",   result: "LOG-114 기록",                                       at: "2026-07-08 11:20:02", async: false },
      { step: 7, label: "알림 발송",   result: "관련자 2명 · 이메일 병행",                           at: "2026-07-08 11:20:03", async: true },
    ],
    resultNote: "7연쇄 반영 완료 — 예상치와 일치 ✓",
  },
  {
    id: "APR-2026-00131", type: "PARTIAL_REFUND", orderId: "ORD-2607-009", freelancerId: null,
    requesterId: "EMP-04", requester: "이수민", amount: 300000, risk: "mid",
    status: "APPROVED", opinion: "촬영 25컷 중 6컷 고객 불만족 — 협의 후 부분환불",
    approvalLine: [
      { step: 1, role: "TEAM_LEAD", approverId: "EMP-03", approver: "박준혁", status: "APPROVED", comment: "협의 내역 확인", decidedAt: "2026-07-05 13:58" },
      { step: 2, role: "FINANCE",   approverId: "EMP-02", approver: "정다은", status: "APPROVED", comment: "확인",           decidedAt: "2026-07-05 14:30" },
    ],
    expectedDiff: [
      { field: "orderStatus",  label: "주문 상태 (ORD-2607-009)", type: "status", before: "DONE", after: "PARTIALLY_REFUNDED" },
      { field: "currentSales", label: "현재 매출 (ORD-2607-009)", type: "money",  before: 1350000, after: 1050000, delta: -300000 },
      { field: "settlement",   label: "정산 손익 (콘텐츠1팀 7월)", type: "money",  before: 5171000, after: 4871000, delta: -300000 },
    ],
    createdAt: "2026-07-05 13:40", decidedAt: "2026-07-05 14:30",
    chainReceipt: [
      { step: 1, label: "결재 확정",   result: "APPROVED · 최종 승인 정다은",                        at: "2026-07-05 14:30:01", async: false },
      { step: 2, label: "주문 상태",   result: "DONE → PARTIALLY_REFUNDED",                         at: "2026-07-05 14:30:01", async: false },
      { step: 3, label: "매출 이벤트", result: "PARTIAL_REFUND −₩300,000 적재 (SE-013)",            at: "2026-07-05 14:30:01", async: false },
      { step: 4, label: "정산 재계산", result: "콘텐츠1팀 7월 ₩5,171,000 → ₩4,871,000 (이력 적재)", at: "2026-07-05 14:30:02", async: false },
      { step: 5, label: "손익 반영",   result: "콘텐츠1팀 손익 −₩300,000",                          at: "2026-07-05 14:30:02", async: false },
      { step: 6, label: "감사 로그",   result: "LOG-111 ~ LOG-112 기록",                            at: "2026-07-05 14:30:02", async: false },
      { step: 7, label: "알림 발송",   result: "관련자 2명 · 이메일 병행",                           at: "2026-07-05 14:30:03", async: true },
    ],
    resultNote: "7연쇄 반영 완료 — 예상치와 일치 ✓",
  },
  {
    id: "APR-2026-00118", type: "SETTLEMENT_ADJUST", orderId: null, freelancerId: null, settlementId: "SET-2606-01",
    requesterId: "EMP-02", requester: "정다은", amount: 120000, risk: "mid",
    status: "APPROVED", opinion: "6월 확정 정산 — 라온뷰티 수수료 이월분 조정 −₩120,000 (확정 후 조정은 결재로만, MG1003)",
    approvalLine: [
      { step: 1, role: "FINANCE", approverId: "EMP-02", approver: "정다은", status: "APPROVED", comment: "기안자 겸 재무 확인", decidedAt: "2026-07-03 10:12" },
      { step: 2, role: "EXEC",    approverId: "EMP-01", approver: "김민석", status: "APPROVED", comment: "승인",               decidedAt: "2026-07-03 10:40" },
    ],
    expectedDiff: [
      { field: "adjustment", label: "정산 조정 (콘텐츠1팀 6월 · 확정됨)", type: "money", before: 4720000, after: 4600000, delta: -120000 },
    ],
    createdAt: "2026-07-03 09:50", decidedAt: "2026-07-03 10:40",
    chainReceipt: [
      { step: 1, label: "결재 확정",   result: "APPROVED · 최종 승인 김민석",                     at: "2026-07-03 10:40:01", async: false },
      { step: 2, label: "조정 이벤트", result: "ADJ-01 −₩120,000 적재 (스냅샷 불변 — MG1003)",   at: "2026-07-03 10:40:01", async: false },
      { step: 3, label: "손익 반영",   result: "콘텐츠1팀 6월 손익 −₩120,000",                   at: "2026-07-03 10:40:02", async: false },
      { step: 4, label: "감사 로그",   result: "LOG-108 기록",                                    at: "2026-07-03 10:40:02", async: false },
      { step: 5, label: "알림 발송",   result: "관련자 2명",                                      at: "2026-07-03 10:40:03", async: true },
    ],
    resultNote: "조정 이벤트 적재 완료 — 확정 스냅샷은 변경되지 않음 (MG1003)",
  },
];

// ── 수집 배치 (ImportBatch) — IMP-nnn, 최신순 ───────────────────────────────
// kind: ORDER(주문) | PAYMENT(결제내역) / status: SUCCESS | FAILED | REVIEW_PENDING
// rows[].status: OK(정상) | DUP(중복) | ERROR(오류 — errors[]에 셀 단위 원인, 한국어 업무 용어)
// fallback 쌍: IMP-002(API 실패) → IMP-003(엑셀 대체 수집, fallbackOf)
const IMPORT_BATCHES = [
  {
    id: "IMP-006", kind: "ORDER", source: "EXCEL_UPLOAD", platform: "SMARTSTORE", status: "SUCCESS",
    totalRows: 5, okRows: 2, dupRows: 2, errorRows: 1, fallbackOf: null,
    uploadedById: "EMP-04", collectedAt: "2026-07-09 09:10",
    note: "정상 2건 등록 (ORD-2607-011 · ORD-2607-012) · 중복 2 · 오류 1",
    rows: [
      { row: 2, status: "OK",  data: { platformOrderNo: "2026070812340011", clientName: "해솔건강원", item: "체험단 리뷰 15건",     amount: 1050000, orderedAt: "2026-07-08" }, createdOrderId: "ORD-2607-011", cause: null, errors: [] },
      { row: 3, status: "OK",  data: { platformOrderNo: "2026070912340027", clientName: "온새미로티", item: "신제품 티저 릴스 5편", amount: 850000,  orderedAt: "2026-07-09" }, createdOrderId: "ORD-2607-012", cause: null, errors: [] },
      { row: 4, status: "DUP", data: { platformOrderNo: "2026070112330001", clientName: "블루밍코스메틱", item: "인스타그램 릴스 15편 제작", amount: 2400000, orderedAt: "2026-07-01" }, createdOrderId: null, cause: "이미 등록된 플랫폼 주문번호 — ORD-2607-001", errors: [] },
      { row: 5, status: "DUP", data: { platformOrderNo: "2026070312330042", clientName: "라온뷰티", item: "유튜브 쇼츠 캠페인 8편", amount: 3200000, orderedAt: "2026-07-03" }, createdOrderId: null, cause: "이미 등록된 플랫폼 주문번호 — ORD-2607-004", errors: [] },
      { row: 6, status: "ERROR", data: { platformOrderNo: "2026070912340031", clientName: "모던홈퍼니처", item: "룩북 촬영 12컷", amount: "1,05만원", orderedAt: "" }, createdOrderId: null, cause: null,
        errors: [
          { col: "amount",    value: "1,05만원", cause: "금액은 숫자여야 합니다 (예: 1050000)" },
          { col: "orderedAt", value: "",         cause: "주문일이 비어 있습니다 (YYYY-MM-DD)" },
        ] },
    ],
  },
  {
    id: "IMP-005", kind: "PAYMENT", source: "EXCEL_UPLOAD", platform: "BANK", status: "SUCCESS",
    totalRows: 8, okRows: 5, dupRows: 1, errorRows: 2, fallbackOf: null,
    uploadedById: "EMP-02", collectedAt: "2026-07-10 08:40",
    note: "우리은행 입금내역 — 5건 등록(매칭 2 · 미매칭 3) · 중복 1 · 오류 2",
    rows: [
      { row: 2, status: "OK",  data: { paidAt: "2026-07-08", payer: "그린리프상사",   amount: 900000 },  createdPaymentId: "PAY-004", cause: null, errors: [] },
      { row: 3, status: "OK",  data: { paidAt: "2026-07-08", payer: "코지홈",         amount: 720000 },  createdPaymentId: "PAY-005", cause: null, errors: [] },
      { row: 4, status: "OK",  data: { paidAt: "2026-07-09", payer: "온새미로",       amount: 850000 },  createdPaymentId: "PAY-006", cause: null, errors: [] },
      { row: 5, status: "OK",  data: { paidAt: "2026-07-08", payer: "(주)해솔건강원", amount: 1050000 }, createdPaymentId: "PAY-007", cause: null, errors: [] },
      { row: 6, status: "OK",  data: { paidAt: "2026-07-10", payer: "가상계좌 입금",  amount: 490000 },  createdPaymentId: "PAY-008", cause: null, errors: [] },
      { row: 7, status: "DUP", data: { paidAt: "2026-07-02", payer: "한빛식품",       amount: 1800000 }, createdPaymentId: null, cause: "이미 등록된 결제내역 — PAY-002", errors: [] },
      { row: 8, status: "ERROR", data: { paidAt: "2026-07-09", payer: "", amount: 330000 }, createdPaymentId: null, cause: null,
        errors: [ { col: "payer", value: "", cause: "입금자명이 비어 있습니다" } ] },
      { row: 9, status: "ERROR", data: { paidAt: "07/10", payer: "미래상사", amount: "삼십만" }, createdPaymentId: null, cause: null,
        errors: [
          { col: "paidAt", value: "07/10",  cause: "입금일 형식이 올바르지 않습니다 (YYYY-MM-DD)" },
          { col: "amount", value: "삼십만", cause: "금액은 숫자여야 합니다" },
        ] },
    ],
  },
  {
    id: "IMP-004", kind: "ORDER", source: "PLAYWRIGHT_CRAWL", platform: "COUPANG", status: "REVIEW_PENDING",
    totalRows: 31, okRows: 28, dupRows: 0, errorRows: 3, fallbackOf: null,
    uploadedById: "EMP-09", collectedAt: "2026-07-10 10:40",
    note: "필드 매핑 변경 감지 — 검수 후 반영 (오류 3건: 옵션 컬럼 분리 실패)",
    rows: [
      { row: 12, status: "ERROR", data: { platformOrderNo: "CP26071022110812", clientName: "다온리빙", item: "SNS 광고 소재 (옵션: ?)", amount: 150000, orderedAt: "2026-07-10" }, createdOrderId: null, cause: null,
        errors: [ { col: "item", value: "SNS 광고 소재 (옵션: ?)", cause: "옵션 컬럼 분리 실패 — 매핑 규칙 확인 필요" } ] },
      { row: 19, status: "ERROR", data: { platformOrderNo: "CP26071022110897", clientName: "해솔건강원", item: "체험단 (옵션: ?)", amount: 70000, orderedAt: "2026-07-10" }, createdOrderId: null, cause: null,
        errors: [ { col: "item", value: "체험단 (옵션: ?)", cause: "옵션 컬럼 분리 실패 — 매핑 규칙 확인 필요" } ] },
      { row: 27, status: "ERROR", data: { platformOrderNo: "CP26071022110933", clientName: "미도상회", item: "", amount: 220000, orderedAt: "2026-07-10" }, createdOrderId: null, cause: null,
        errors: [ { col: "item", value: "", cause: "상품명이 비어 있습니다" } ] },
    ],
  },
  {
    id: "IMP-003", kind: "ORDER", source: "EXCEL_UPLOAD", platform: "SMARTSTORE", status: "SUCCESS",
    totalRows: 45, okRows: 43, dupRows: 2, errorRows: 0, fallbackOf: "IMP-002",
    uploadedById: "EMP-04", collectedAt: "2026-07-08 09:10",
    note: "43건 등록 · 중복 2 — IMP-002(API 실패) 대체 수집", rows: [],
  },
  {
    id: "IMP-002", kind: "ORDER", source: "SMARTSTORE_API", platform: "SMARTSTORE", status: "FAILED",
    totalRows: 0, okRows: 0, dupRows: 0, errorRows: 0, fallbackOf: null,
    uploadedById: null, collectedAt: "2026-07-08 06:00",
    note: "로그인 차단 (캡차 감지) — 세션 만료. 엑셀 업로드로 수동 대체 (IMP-003)", rows: [],
  },
  {
    id: "IMP-001", kind: "ORDER", source: "SMARTSTORE_API", platform: "SMARTSTORE", status: "SUCCESS",
    totalRows: 28, okRows: 28, dupRows: 0, errorRows: 0, fallbackOf: null,
    uploadedById: null, collectedAt: "2026-07-07 06:00", note: null, rows: [],
  },
];

// ── 결제내역 (Payment) — 매칭/미매칭 ────────────────────────────────────────
// status: MATCHED(매칭완료) | UNMATCHED(미매칭 — suggestedOrderId 있으면 후보 제시)
const PAYMENTS = [
  { id: "PAY-008", paidAt: "2026-07-10", payer: "가상계좌 입금",  amount: 490000,  method: "VIRTUAL",  status: "UNMATCHED", orderId: null,           suggestedOrderId: null,           batchId: "IMP-005", memo: "입금자 식별 불가 — 수동 확인 필요" },
  { id: "PAY-007", paidAt: "2026-07-08", payer: "(주)해솔건강원", amount: 1050000, method: "TRANSFER", status: "MATCHED",   orderId: "ORD-2607-011", suggestedOrderId: null,           batchId: "IMP-005", memo: null },
  { id: "PAY-006", paidAt: "2026-07-09", payer: "온새미로",       amount: 850000,  method: "TRANSFER", status: "UNMATCHED", orderId: null,           suggestedOrderId: "ORD-2607-012", batchId: "IMP-005", memo: "입금자명 부분 일치 (온새미로티)" },
  { id: "PAY-005", paidAt: "2026-07-08", payer: "코지홈",         amount: 720000,  method: "TRANSFER", status: "UNMATCHED", orderId: null,           suggestedOrderId: "ORD-2607-008", batchId: "IMP-005", memo: "입금자명 부분 일치 (코지홈데코)" },
  { id: "PAY-004", paidAt: "2026-07-08", payer: "그린리프상사",   amount: 900000,  method: "TRANSFER", status: "MATCHED",   orderId: "ORD-2607-005", suggestedOrderId: null,           batchId: "IMP-005", memo: null },
  { id: "PAY-003", paidAt: "2026-07-03", payer: "라온뷰티(주)",   amount: 3200000, method: "CARD",     status: "MATCHED",   orderId: "ORD-2607-004", suggestedOrderId: null,           batchId: null,      memo: null },
  { id: "PAY-002", paidAt: "2026-07-02", payer: "한빛식품",       amount: 1800000, method: "TRANSFER", status: "MATCHED",   orderId: "ORD-2607-002", suggestedOrderId: null,           batchId: null,      memo: null },
  { id: "PAY-001", paidAt: "2026-07-01", payer: "블루밍코스메틱", amount: 2400000, method: "CARD",     status: "MATCHED",   orderId: "ORD-2607-001", suggestedOrderId: null,           batchId: null,      memo: null },
];

// ── 정산 (Settlement) — 기간 × 부서, DRAFT/CONFIRMED + 스냅샷 + 조정 (MG1003) ──
// snapshot.profit = orderAmount − refundAmount + repaymentAmount − platformFee − outsourcingCost
// recalcHistory: 승인 반영 시 "이전액/재계산액/차액" 이력 적재 (BS0007 — 덮어쓰기 없음)
// adjustments: CONFIRMED 이후 변경은 조정 이벤트로만 (결재 필수)
// 검산 SET-2607-01: 10,650,000 − 1,100,000 + 150,000 − 444,000 − 5,035,000 = 4,221,000 ✓
const SETTLEMENTS = [
  {
    id: "SET-2607-01", deptId: "DEPT-1", target: "콘텐츠1팀", period: "2026-07", status: "DRAFT",
    snapshot: { orderAmount: 10650000, refundAmount: 1100000, repaymentAmount: 150000, platformFee: 444000, outsourcingCost: 5035000, profit: 4221000 },
    recalcHistory: [
      { at: "2026-07-10 09:20", approvalId: "APR-2026-00142", before: 5021000, after: 4221000, delta: -800000 },
      { at: "2026-07-08 11:20", approvalId: "APR-2026-00135", before: 4871000, after: 5021000, delta: 150000 },
      { at: "2026-07-05 14:30", approvalId: "APR-2026-00131", before: 5171000, after: 4871000, delta: -300000 },
    ],
    adjustments: [], confirmedAt: null, confirmedById: null,
    checklist: { unassignedZero: false, noActiveApproval: false, statementReviewed: false }, // 미배정 2건 · 결재 1건 진행 중
  },
  {
    id: "SET-2607-02", deptId: "DEPT-2", target: "콘텐츠2팀", period: "2026-07", status: "DRAFT",
    snapshot: { orderAmount: 5270000, refundAmount: 2000000, repaymentAmount: 0, platformFee: 0, outsourcingCost: 1940000, profit: 1330000 },
    recalcHistory: [
      { at: "2026-07-10 09:58", approvalId: "APR-2026-00139", before: 3330000, after: 1330000, delta: -2000000 },
    ],
    adjustments: [], confirmedAt: null, confirmedById: null,
    checklist: { unassignedZero: true, noActiveApproval: true, statementReviewed: false },
  },
  {
    id: "SET-2607-03", deptId: "DEPT-3", target: "퍼포먼스팀", period: "2026-07", status: "DRAFT",
    snapshot: { orderAmount: 1500000, refundAmount: 0, repaymentAmount: 0, platformFee: 90000, outsourcingCost: 800000, profit: 610000 },
    recalcHistory: [], adjustments: [], confirmedAt: null, confirmedById: null,
    checklist: { unassignedZero: false, noActiveApproval: true, statementReviewed: false }, // 미배정 1건(TSK-013)
  },
  {
    id: "SET-2607-04", deptId: "DEPT-4", target: "인플루언서팀", period: "2026-07", status: "CONFIRMED",
    snapshot: { orderAmount: 2700000, refundAmount: 0, repaymentAmount: 0, platformFee: 94500, outsourcingCost: 1800000, profit: 805500 },
    recalcHistory: [], adjustments: [], confirmedAt: "2026-07-09 18:00", confirmedById: "EMP-02",
    checklist: { unassignedZero: true, noActiveApproval: true, statementReviewed: true },
    // ⚠ 확정 후 전체환불 결재(APR-2026-00146) 진행 중 — 승인 시 조정 이벤트로만 반영되는 시연 케이스
  },
  {
    id: "SET-2606-01", deptId: "DEPT-1", target: "콘텐츠1팀", period: "2026-06", status: "CONFIRMED",
    snapshot: { orderAmount: 12400000, refundAmount: 400000, repaymentAmount: 0, platformFee: 380000, outsourcingCost: 6900000, profit: 4720000 },
    recalcHistory: [],
    adjustments: [
      { id: "ADJ-01", at: "2026-07-03 10:40", reason: "라온뷰티 수수료 이월분 조정", amount: -120000, approvalId: "APR-2026-00118" },
    ],
    confirmedAt: "2026-06-30 18:30", confirmedById: "EMP-02",
    checklist: { unassignedZero: true, noActiveApproval: true, statementReviewed: true },
  },
  {
    id: "SET-2606-02", deptId: "DEPT-2", target: "콘텐츠2팀", period: "2026-06", status: "CONFIRMED",
    snapshot: { orderAmount: 8200000, refundAmount: 0, repaymentAmount: 0, platformFee: 210000, outsourcingCost: 4400000, profit: 3590000 },
    recalcHistory: [], adjustments: [], confirmedAt: "2026-06-30 18:30", confirmedById: "EMP-02",
    checklist: { unassignedZero: true, noActiveApproval: true, statementReviewed: true },
  },
];

// ── 지급 명세서 (PayoutStatement) — 환불 소급 차감 행 포함 ───────────────────
// lines[].type: WORK(작업 대금) | DEDUCTION(소급 차감 — approvalId 필수)
// status: DRAFT(작성 중) | CONFIRMED(확정) | PAID(지급완료)
const PAYOUT_STATEMENTS = [
  {
    id: "PO-2607-101", freelancerId: "FR-101", period: "2026-07", status: "DRAFT",
    lines: [
      { id: "L1", type: "WORK",      label: "릴스 1~5편 편집 (TSK-001)",             qty: 5, rate: 120000, amount: 600000,  taskId: "TSK-001", orderId: "ORD-2607-001", approvalId: null },
      { id: "L2", type: "WORK",      label: "라온뷰티 쇼츠 8편 (배정분)",             qty: 8, rate: 120000, amount: 960000,  taskId: null,      orderId: "ORD-2607-004", approvalId: null },
      { id: "L3", type: "DEDUCTION", label: "환불 소급 차감 — 라온뷰티 쇼츠 2편 취소", qty: 2, rate: 120000, amount: -240000, taskId: null,      orderId: "ORD-2607-004", approvalId: "APR-2026-00142" },
    ],
    total: 1320000, note: "차감 근거: APR-2026-00142 (부분환불 승인 07-10)",
  },
  {
    id: "PO-2607-102", freelancerId: "FR-102", period: "2026-07", status: "DRAFT",
    lines: [
      { id: "L1", type: "WORK", label: "한빛식품 체험단 완료 14건", qty: 14, rate: 45000, amount: 630000, taskId: null, orderId: "ORD-2607-002", approvalId: null },
    ],
    total: 630000, note: null,
  },
  {
    id: "PO-2607-103", freelancerId: "FR-103", period: "2026-07", status: "CONFIRMED",
    lines: [
      { id: "L1", type: "WORK", label: "서진가구 상세페이지 3종",        qty: 3, rate: 350000, amount: 1050000, taskId: null,      orderId: "ORD-2607-003", approvalId: null },
      { id: "L2", type: "WORK", label: "제품 상세 보정 25컷 (TSK-008)",  qty: 1, rate: 350000, amount: 350000,  taskId: "TSK-008", orderId: "ORD-2607-009", approvalId: null },
      { id: "L3", type: "WORK", label: "보정본 납품 정리 (TSK-014)",     qty: 1, rate: 350000, amount: 350000,  taskId: "TSK-014", orderId: "ORD-2607-009", approvalId: null },
    ],
    total: 1750000, note: "확정 2026-07-09 — 수정은 조정 결재로만 (MG1003)",
  },
  {
    id: "PO-2606-105", freelancerId: "FR-105", period: "2026-06", status: "PAID",
    lines: [
      { id: "L1", type: "WORK", label: "6월 인플루언서 시딩 22건", qty: 22, rate: 60000, amount: 1320000, taskId: null, orderId: null, approvalId: null },
    ],
    total: 1320000, note: "지급완료 2026-07-05",
  },
];

// ── 세금계산서 (TaxInvoice) — 공급가 = 현재 매출, VAT 10% 별도 ───────────────
// status: REQUESTED(발행요청) | ISSUED(발행완료) | DELIVERED(전송완료)
const TAX_INVOICES = [
  { id: "TAX-2607-03", clientName: "라온뷰티",   orderId: "ORD-2607-004", supplyAmount: 2400000, vat: 240000, totalAmount: 2640000, status: "REQUESTED", issueNo: null, requestedAt: "2026-07-10 10:30", issuedAt: null, requesterId: "EMP-02", memo: "부분환불(APR-2026-00142) 반영 후 금액으로 발행 요청" },
  { id: "TAX-2607-02", clientName: "퓨어펫푸드", orderId: "ORD-2607-009", supplyAmount: 1200000, vat: 120000, totalAmount: 1320000, status: "REQUESTED", issueNo: null, requestedAt: "2026-07-09 15:20", issuedAt: null, requesterId: "EMP-02", memo: "환불 −300,000 · 재결제 +150,000 반영 금액" },
  { id: "TAX-2607-01", clientName: "서진가구",   orderId: "ORD-2607-003", supplyAmount: 1650000, vat: 165000, totalAmount: 1815000, status: "ISSUED",    issueNo: "20260709-41000012-11223344", requestedAt: "2026-07-08 17:00", issuedAt: "2026-07-09 10:12", requesterId: "EMP-02", memo: null },
  { id: "TAX-2606-04", clientName: "그린리프상사", orderId: null,         supplyAmount: 900000,  vat: 90000,  totalAmount: 990000,  status: "DELIVERED", issueNo: "20260630-41000012-10938271", requestedAt: "2026-06-30 11:00", issuedAt: "2026-06-30 14:40", requesterId: "EMP-02", memo: "6월 블로그 운영분" },
];

// ── 감사 로그 (AuditLog) — 필드 단위 before/after diff, 최신순 ───────────────
// actorType: SYSTEM(자동 — approvalId 트리거 필수) | USER
// 민감 필드(계좌)는 diff에서도 마스킹 (MG1004)
const AUDIT_LOGS = [
  { id: "LOG-125", at: "2026-07-10 11:25", actorType: "USER",   actor: "서지원", entityType: "APPROVAL",   entityId: "APR-2026-00144", event: "REJECT",        field: "status",         before: "IN_PROGRESS",       after: "REJECTED",           approvalId: "APR-2026-00144", note: "반려 — 데이터 무변경 (BS0006)" },
  { id: "LOG-124", at: "2026-07-10 09:58", actorType: "SYSTEM", actor: "시스템", entityType: "SETTLEMENT", entityId: "SET-2607-02",    event: "RECALC",        field: "profit",         before: "3,330,000",         after: "1,330,000",          approvalId: "APR-2026-00139", note: "정산 재계산 — 이력 적재 (BS0007)" },
  { id: "LOG-123", at: "2026-07-10 09:58", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-010",   event: "FIELD_CHANGE",  field: "refundedAmount", before: "0",                 after: "2,000,000",          approvalId: "APR-2026-00139", note: null },
  { id: "LOG-122", at: "2026-07-10 09:58", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-010",   event: "STATUS_CHANGE", field: "status",         before: "IN_PROGRESS",       after: "REFUNDED",           approvalId: "APR-2026-00139", note: null },
  { id: "LOG-121", at: "2026-07-10 09:20", actorType: "SYSTEM", actor: "시스템", entityType: "SETTLEMENT", entityId: "SET-2607-01",    event: "RECALC",        field: "profit",         before: "5,021,000",         after: "4,221,000",          approvalId: "APR-2026-00142", note: "정산 재계산 — 이력 적재 (BS0007)" },
  { id: "LOG-120", at: "2026-07-10 09:20", actorType: "SYSTEM", actor: "시스템", entityType: "PAYOUT",     entityId: "PO-2607-101",    event: "DEDUCTION_ADD", field: "total",          before: "1,560,000",         after: "1,320,000",          approvalId: "APR-2026-00142", note: "환불 소급 차감 행 추가 (−240,000)" },
  { id: "LOG-119", at: "2026-07-10 09:20", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-004",   event: "FIELD_CHANGE",  field: "refundedAmount", before: "0",                 after: "800,000",            approvalId: "APR-2026-00142", note: null },
  { id: "LOG-118", at: "2026-07-10 09:20", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-004",   event: "STATUS_CHANGE", field: "status",         before: "IN_PROGRESS",       after: "PARTIALLY_REFUNDED", approvalId: "APR-2026-00142", note: null },
  { id: "LOG-117", at: "2026-07-10 08:45", actorType: "USER",   actor: "박준혁", entityType: "TASK",       entityId: "TSK-006",        event: "STATUS_CHANGE", field: "status",         before: "IN_PROGRESS",       after: "ON_HOLD",            approvalId: null,             note: "사유: 부분환불 결재 진행 중 (APR-2026-00145)" },
  { id: "LOG-116", at: "2026-07-09 18:00", actorType: "USER",   actor: "정다은", entityType: "SETTLEMENT", entityId: "SET-2607-04",    event: "CONFIRM",       field: "status",         before: "DRAFT",             after: "CONFIRMED",          approvalId: null,             note: "정산 확정 — 이후 수정은 조정 결재로만 (MG1003)" },
  { id: "LOG-115", at: "2026-07-09 16:20", actorType: "USER",   actor: "오세훈", entityType: "PERMISSION", entityId: "ROLE_MATRIX",    event: "FIELD_CHANGE",  field: "STAFF.profit",   before: "허용",              after: "차단",               approvalId: null,             note: "STAFF 손익 대시보드 열람 차단" },
  { id: "LOG-114", at: "2026-07-08 11:20", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-009",   event: "SALES_EVENT",   field: "currentSales",   before: "1,050,000",         after: "1,200,000",          approvalId: "APR-2026-00135", note: "재결제 +150,000 (SE-014)" },
  { id: "LOG-113", at: "2026-07-08 10:05", actorType: "USER",   actor: "오세훈", entityType: "FREELANCER", entityId: "FR-103",         event: "FIELD_CHANGE",  field: "account",        before: "신한 ****-***-2201", after: "신한 ****-***-3390", approvalId: null,             note: "계좌 변경 — diff에서도 마스킹 (MG1004)" },
  { id: "LOG-112", at: "2026-07-05 14:30", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-009",   event: "STATUS_CHANGE", field: "status",         before: "DONE",              after: "PARTIALLY_REFUNDED", approvalId: "APR-2026-00131", note: null },
  { id: "LOG-111", at: "2026-07-05 14:30", actorType: "SYSTEM", actor: "시스템", entityType: "ORDER",      entityId: "ORD-2607-009",   event: "FIELD_CHANGE",  field: "refundedAmount", before: "0",                 after: "300,000",            approvalId: "APR-2026-00131", note: null },
  { id: "LOG-108", at: "2026-07-03 10:40", actorType: "SYSTEM", actor: "시스템", entityType: "SETTLEMENT", entityId: "SET-2606-01",    event: "ADJUSTMENT",    field: "adjustments",    before: "—",                 after: "ADJ-01 (−120,000)",  approvalId: "APR-2026-00118", note: "확정 정산 조정 이벤트 적재 — 스냅샷 불변 (MG1003)" },
];

// ── 알림 (Notification) — approvalId 스레드 그룹핑, 최신순 ───────────────────
// emailStatus: SENT(발송완료) | QUEUED(발송대기) | FAILED(발송실패) — 3상태 (BS0011 비동기)
// route: 클릭 시 딥링크 { name, payload } (navigate에 그대로 전달)
const NOTIFICATIONS = [
  { id: "NTF-011", at: "2026-07-10 11:25", kind: "APPROVAL_REJECTED", title: "결재 반려 — APR-2026-00144 주문 수정",              body: "증빙 누락 — 데이터는 변경되지 않았습니다 (BS0006)",        approvalId: "APR-2026-00144", orderId: "ORD-2607-006", batchId: null,      read: false, emailStatus: "SENT",   route: { name: "approvalDetail", payload: { approvalId: "APR-2026-00144" } } },
  { id: "NTF-010", at: "2026-07-10 10:15", kind: "APPROVAL_REQUEST",  title: "새 결재 도착 — APR-2026-00146 전체환불 ₩2,700,000", body: "모두의반찬 인플루언서 시딩 — 1단계 정하은 차례",            approvalId: "APR-2026-00146", orderId: "ORD-2607-007", batchId: null,      read: false, emailStatus: "QUEUED", route: { name: "approvalDetail", payload: { approvalId: "APR-2026-00146" } } },
  { id: "NTF-009", at: "2026-07-10 10:02", kind: "APPROVAL_STEP",     title: "결재 진행 — APR-2026-00145 1/2단계 승인",           body: "박준혁 승인 — 다음 차례: 정다은 (재무)",                    approvalId: "APR-2026-00145", orderId: "ORD-2607-002", batchId: null,      read: false, emailStatus: "SENT",   route: { name: "approvalDetail", payload: { approvalId: "APR-2026-00145" } } },
  { id: "NTF-008", at: "2026-07-10 09:58", kind: "SETTLEMENT_RECALC", title: "정산 재계산 — 콘텐츠2팀 7월 (−₩2,000,000)",         body: "₩3,330,000 → ₩1,330,000 · 트리거 APR-2026-00139",          approvalId: "APR-2026-00139", orderId: null,           batchId: null,      read: false, emailStatus: "QUEUED", route: { name: "settlement", payload: { settlementId: "SET-2607-02" } } },
  { id: "NTF-007", at: "2026-07-10 09:58", kind: "SALES_REFLECT",     title: "매출 반영 — 윤슬주얼리 전체환불 −₩2,000,000",       body: "SE-015 적재 · 현재 매출 ₩0",                               approvalId: "APR-2026-00139", orderId: "ORD-2607-010", batchId: null,      read: false, emailStatus: "QUEUED", route: { name: "orders", payload: { orderId: "ORD-2607-010" } } },
  { id: "NTF-006", at: "2026-07-10 09:58", kind: "APPROVAL_DONE",     title: "결재 승인 완료 — APR-2026-00139 전체환불",          body: "7연쇄 반영 완료 — 반영 영수증 확인",                        approvalId: "APR-2026-00139", orderId: "ORD-2607-010", batchId: null,      read: false, emailStatus: "SENT",   route: { name: "approvalDetail", payload: { approvalId: "APR-2026-00139" } } },
  { id: "NTF-005", at: "2026-07-10 09:20", kind: "SETTLEMENT_RECALC", title: "정산 재계산 — 콘텐츠1팀 7월 (−₩800,000)",           body: "₩5,021,000 → ₩4,221,000 · 트리거 APR-2026-00142",          approvalId: "APR-2026-00142", orderId: null,           batchId: null,      read: true,  emailStatus: "FAILED", route: { name: "settlement", payload: { settlementId: "SET-2607-01" } } },
  { id: "NTF-004", at: "2026-07-10 09:20", kind: "APPROVAL_DONE",     title: "결재 승인 완료 — APR-2026-00142 부분환불",          body: "라온뷰티 쇼츠 2편 취소 −₩800,000 · 7연쇄 반영 완료",        approvalId: "APR-2026-00142", orderId: "ORD-2607-004", batchId: null,      read: true,  emailStatus: "SENT",   route: { name: "approvalDetail", payload: { approvalId: "APR-2026-00142" } } },
  { id: "NTF-003", at: "2026-07-10 08:40", kind: "IMPORT_DONE",       title: "결제내역 8건 수집 — 미매칭 3건",                    body: "IMP-005 · 매칭 2 · 미매칭 3 · 중복 1 · 오류 2",             approvalId: null,             orderId: null,           batchId: "IMP-005", read: false, emailStatus: "SENT",   route: { name: "paymentImport", payload: { batchId: "IMP-005" } } },
  { id: "NTF-002", at: "2026-07-09 17:10", kind: "TASK_REVIEW",       title: "검수 요청 — 썸네일 15종 (TSK-012)",                 body: "김서연 제출 · D-2 (07-11 마감)",                            approvalId: null,             orderId: "ORD-2607-001", batchId: null,      read: true,  emailStatus: "SENT",   route: { name: "kanban", payload: { taskId: "TSK-012" } } },
  { id: "NTF-001", at: "2026-07-08 11:20", kind: "SALES_REFLECT",     title: "재결제 반영 — 퓨어펫푸드 +₩150,000",                body: "SE-014 적재 · 현재 매출 ₩1,200,000",                        approvalId: "APR-2026-00135", orderId: "ORD-2607-009", batchId: null,      read: true,  emailStatus: "SENT",   route: { name: "orders", payload: { orderId: "ORD-2607-009" } } },
];

// ── 저장된 뷰 (SavedView) — IDEA-05, 숫자키 1~5 전환 ────────────────────────
const SAVED_VIEWS = [
  { id: "SV-01", screen: "orders",   name: "마감 임박 (7일)",  filters: { dueWithinDays: 7 },              count: 5, shared: false },
  { id: "SV-02", screen: "orders",   name: "환불 진행 중",     filters: { hasActiveRefundApproval: true }, count: 2, shared: true },
  { id: "SV-03", screen: "inbox",    name: "내 차례",          filters: { myTurn: true },                  count: 2, shared: false },
  { id: "SV-04", screen: "payout",   name: "미확정 명세서",    filters: { status: "DRAFT" },               count: 2, shared: true },
  { id: "SV-05", screen: "auditLog", name: "금액 변경만",      filters: { fields: ["refundedAmount", "profit", "total"] }, count: 6, shared: false },
];

// ── 평가 (Evaluation) — 프리랜서 × 작업, 5점 척도 3항목 ─────────────────────
// 평가 대기 = DONE 작업 중 평가 미존재 (TSK-014가 대기 케이스)
const EVALUATIONS = [
  { id: "EV-003", freelancerId: "FR-103", taskId: "TSK-008", orderId: "ORD-2607-009", evaluatorId: "EMP-04", period: "2026-07", scores: { quality: 5, deadline: 5, communication: 4 }, comment: "보정 퀄리티 최상 — 재의뢰 의사 있음",       createdAt: "2026-07-09 17:30" },
  { id: "EV-002", freelancerId: "FR-101", taskId: "TSK-001", orderId: "ORD-2607-001", evaluatorId: "EMP-04", period: "2026-07", scores: { quality: 5, deadline: 4, communication: 5 }, comment: "1편 지연 있었으나 사전 공유 — 결과물 우수", createdAt: "2026-07-08 18:10" },
  { id: "EV-001", freelancerId: "FR-104", taskId: null,      orderId: null,           evaluatorId: "EMP-08", period: "2026-06", scores: { quality: 4, deadline: 3, communication: 4 }, comment: "6월 총평 — 마감 준수율 개선 필요",           createdAt: "2026-06-30 16:00" },
];

// ── KPI (홈·손익 대시보드) — 집계 기준 시각 병기 (§6.1) ─────────────────────
// monthSales = SALES_EVENTS 합산(17,170,000) / monthProfit = SETTLEMENTS 7월 profit 합(6,966,500)
const KPIS = {
  monthSales:       { value: 17170000, deltaPct: 5.2,  trend: [2140000, 2680000, 1950000, 3120000, 2410000, 2290000, 2580000] },
  monthProfit:      { value: 6966500,  deltaPct: -2.8, trend: [890000, 1120000, 760000, 1310000, 940000, 1010000, 936500] },
  onTimeRate:       { value: 94.2,     deltaPct: 1.5,  trend: [93.1, 92.8, 94.5, 93.9, 94.7, 95.2, 94.2] },
  pendingApprovals: { value: 3,        deltaPct: 0,    trend: [1, 2, 1, 3, 2, 4, 3] },
};
const TREND_DAYS = ["07-04", "07-05", "07-06", "07-07", "07-08", "07-09", "07-10"];
const AGGREGATED_AT = "2026-07-10 11:30"; // 집계 기준 시각 — 검산 배지 hover 캡션용
