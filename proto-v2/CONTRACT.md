# proto-v2 CONTRACT — 화면 작성자 계약 문서

마케팅 대행사 통합 ERP 프로토타입 **v2** (#156767). 22개 화면이 이 문서 하나만 보고
독립적으로 작성될 수 있도록 라우트·데이터 스키마·공용 컴포넌트 API·파일 규약을 확정한다.
설계 근거는 `../models/5_프로토타입모델_00_UIUX설계기준.md` (원칙 P1~P7 · §3 레이아웃 · §4 컴포넌트 · IDEA-01~18).

- **v1(`../proto/`)은 절대 수정 금지** — 참고만.
- 실행: `cd proto-v2 && python3 -m http.server 8156` → http://localhost:8156
  (Babel이 XHR로 jsx를 읽으므로 file:// 직접 열기 불가)

---

## 1. 아키텍처 · 로드 순서

React 18 UMD + Babel standalone + Tailwind CDN + Pretendard/JetBrains Mono. 빌드 없음.

```
index.html
 ├─ data.js            ← 일반 <script>. 최상위 const가 전역 렉시컬 스코프에 공유됨
 ├─ components.jsx     ← 공용 컴포넌트. 전부 window.* 노출
 ├─ tweaks-panel.jsx   ← Tweaks 셸 (v1 동일)
 ├─ (22개 화면 jsx)    ← 각자 window.컴포넌트명 노출. 파일이 없어도 앱은 죽지 않음
 └─ App 셸             ← 사이드바 7그룹 + 라우팅 + Placeholder + ToastHost
```

- 화면 해석은 **렌더 시점** `window[component] || Placeholder`. 미구현 화면은 "구현 대기" 카드.
- 라우트는 `{ name, payload }`. `navigate(name, payload)`로 이동, 셸이 `window.__navigate(name, payload)`도 노출(자동 시연 iframe 호환).
- 화면 전환 fade(`.scr`)는 셸이 처리 — 화면 파일은 신경 쓰지 않는다.

## 2. 파일 규약 (필수 준수)

```jsx
// 예: order-list.jsx
const { useState, useMemo, useEffect } = React;   // ① 최상단 훅 구조분해

function OrderList({ route, navigate, tweaks }) { // ② 시그니처 고정
  // ③ 데이터: data.js 전역을 '맨이름'으로 읽는다 (fetch 금지, window.ORDERS 아님!)
  const [orders, setOrders] = useState(ORDERS);   // ④ 변경은 useState 로컬 복사로 시뮬레이션

  // ⑤ 공용 컴포넌트·유틸은 반드시 window.* 로 참조 (Babel 스크립트별 스코프 — 파일 간 const 공유 불가)
  const { Card, EnumPill, Money, PageHeader } = window;

  // ⑥ 완료 액션엔 '다음 행동 릴레이' 토스트 최소 1개 (IDEA-16)
  // window.toast('37건 등록 완료', { actionLabel: '지금 배정하기 →', onAction: () => navigate('assign', { batchId }) });

  return ( ... );
}
window.OrderList = OrderList;                     // ⑦ 외부 노출은 window.컴포넌트명 = ... 만
```

| # | 규칙 |
|---|---|
| 1 | 훅은 파일 최상단에서 `const { useState } = React;` 구조분해 |
| 2 | 컴포넌트 시그니처 `({ route, navigate, tweaks })` 고정. `route.payload`가 딥링크 컨텍스트 |
| 3 | 데이터는 data.js 전역만(맨이름 참조). fetch/외부 요청 금지 |
| 4 | 상태 변경은 `useState` 로컬 복사 시뮬레이션 — 전역 배열을 직접 mutate 하지 않는다 |
| 5 | 다른 파일 산출물은 전부 `window.*` 참조 / 자기 화면은 `window.컴포넌트명`으로만 노출 |
| 6 | 화면당 최소 1개 릴레이 토스트(IDEA-16): 완료 토스트에 `navigate(route, payload)` 후속 버튼 |
| 7 | 금액 인라인 편집 UI 절대 금지 — "금액 변경은 결재로 진행돼요" 안내 + 기안 직행 버튼(MG1001) |
| 8 | 인터랙션은 실제로 동작(상태 변경·탭·패널·토스트·키보드). 알림/폴링은 setTimeout 시뮬레이션 허용 |
| 9 | 코드량 화면당 250~450줄, v1 수준 이상의 완성도 |
| 10 | 페이지 헤더는 `window.PageHeader` (SectionLabel → h1 → 설명 한 줄) |
| 11 | 한 화면 액센트 색 ≤ 3종. 넓은 테이블은 자체 `overflow-x-auto` (페이지 가로 스크롤 금지) |

## 3. 라우트 레지스트리 (22)

| route | component (window.*) | file | label | 그룹 | 주로 쓰는 전역 |
|---|---|---|---|---|---|
| `home` | `Home` | `home.jsx` | 홈 | 개요 | KPIS, NOTIFICATIONS, APPROVALS, TASKS, TREND_DAYS |
| `notifications` | `Notifications` | `notifications.jsx` | 알림 센터 | 개요 | NOTIFICATIONS (approvalId 스레드 그룹핑) |
| `profit` | `Profit` | `profit.jsx` | 손익 대시보드 | 개요 | SETTLEMENTS, SALES_EVENTS, DEPARTMENTS, KPIS, AGGREGATED_AT |
| `orders` | `OrderList` | `order-list.jsx` | 주문 목록 | 주문 | ORDERS, SALES_EVENTS, SAVED_VIEWS, APPROVALS |
| `orderForm` | `OrderForm` | `order-form.jsx` | 주문 등록 | 주문 | ORDERS, DEPARTMENTS, PROJECTS |
| `excelImport` | `ExcelImport` | `excel-import.jsx` | 주문 엑셀 업로드 | 주문 | IMPORT_BATCHES(kind ORDER) — IDEA-01 |
| `workGroups` | `WorkGroups` | `work-groups.jsx` | 작업 그룹 | 작업 | WORK_GROUPS, TASKS, ORDERS |
| `assign` | `Assign` | `assign.jsx` | 작업 배정 | 작업 | TASKS(미배정), FREELANCERS, ASSIGNMENTS — IDEA-12 |
| `kanban` | `Kanban` | `kanban.jsx` | 작업 칸반 | 작업 | TASKS, KANBAN_COLUMNS, TRANSITION_RULES, TRANSITION_DENY_MESSAGES — IDEA-13 |
| `draft` | `Draft` | `draft.jsx` | 기안 작성 | 결재 | ORDERS, APPROVAL_LINE_RULES, EMPLOYEES — IDEA-10/11 |
| `inbox` | `Inbox` | `inbox.jsx` | 결재함 | 결재 | APPROVALS, CURRENT_USER_ID — IDEA-09 (J/K/A/R) |
| `approvalDetail` | `ApprovalDetail` | `approval-detail.jsx` | 결재 상세 | 결재 | APPROVALS(expectedDiff·chainReceipt) — ★IDEA-08 |
| `paymentImport` | `PaymentImport` | `payment-import.jsx` | 결제내역 등록 | 재무 | PAYMENTS, IMPORT_BATCHES(kind PAYMENT), ORDERS |
| `settlement` | `SettlementConfirm` | `settlement-confirm.jsx` | 정산 확정 | 재무 | SETTLEMENTS(checklist·recalcHistory·adjustments) — IDEA-14 |
| `payout` | `Payout` | `payout.jsx` | 지급 명세서 | 재무 | PAYOUT_STATEMENTS, FREELANCERS, ASSIGNMENTS |
| `taxInvoice` | `TaxInvoice` | `tax-invoice.jsx` | 세금계산서 | 재무 | TAX_INVOICES, ORDERS — IDEA-15 미러 폼 |
| `freelancers` | `Freelancers` | `freelancers.jsx` | 프리랜서 마스터 | 리소스 | FREELANCERS(마스킹), ASSIGNMENTS, APPROVALS(RATE_CHANGE) |
| `evalInput` | `EvalInput` | `eval-input.jsx` | 평가 입력 | 리소스 | EVALUATIONS, TASKS(DONE·미평가), FREELANCERS |
| `evalReport` | `EvalReport` | `eval-report.jsx` | 평가 조회 | 리소스 | EVALUATIONS, FREELANCERS |
| `employees` | `Employees` | `employees.jsx` | 직원 관리 | 시스템 | EMPLOYEES, DEPARTMENTS |
| `permissions` | `Permissions` | `permissions.jsx` | 권한 설정 | 시스템 | ROLE_MATRIX, EMPLOYEES, (REGISTRY 라벨은 화면에서 하드코딩 가능) |
| `auditLog` | `AuditLog` | `audit-log.jsx` | 변경 이력 | 시스템 | AUDIT_LOGS, SAVED_VIEWS — §4.3 diff 규약 |

**딥링크 payload 관례** (P4 — 크로스링크가 1급 내비게이션):

| 대상 route | payload 예 |
|---|---|
| `orders` | `{ orderId: "ORD-2607-004" }` → 해당 행 사이드 패널 자동 오픈 |
| `approvalDetail` | `{ approvalId: "APR-2026-00142" }` (없으면 최신 문서 표시) |
| `assign` | `{ batchId: "IMP-006" }` 또는 `{ taskIds: [...] }` → 필터 프리셋 |
| `draft` | `{ orderId, type: "PARTIAL_REFUND" }` → 제로타이핑 프리필(IDEA-10) |
| `settlement` | `{ settlementId: "SET-2607-01" }` |
| `payout` | `{ statementId: "PO-2607-101" }` / `taxInvoice` `{ invoiceId }` |
| `kanban` | `{ taskId: "TSK-012" }` → 해당 카드 포커스 |
| `paymentImport` | `{ batchId: "IMP-005" }` / `excelImport` `{ batchId: "IMP-006" }` |
| `evalInput` | `{ taskId: "TSK-014" }` (작업 완료 → 평가 릴레이) |

## 4. data.js 전역 스키마 (실코드 기준)

모두 최상위 `const` — **맨이름으로 읽는다** (`window.` 접두 없음). 오늘 = `TODAY = "2026-07-10"`,
로그인 사용자 = `CURRENT_USER_ID = "EMP-02"`(정다은·FINANCE — 결재함 '내 차례' 2건 시점).

| 전역 | 형태 | 핵심 필드 |
|---|---|---|
| `TODAY` | string | `"2026-07-10"` |
| `CURRENT_USER_ID` | string | `"EMP-02"` |
| `DEPARTMENTS` | array(5) | `{ id, name, headId }` |
| `PROJECTS` | array(9) | `{ id, name, clientName, deptId, status }` |
| `EMPLOYEES` | array(10) | `{ id, name, deptId, position, role(ADMIN\|EXEC\|TEAM_LEAD\|FINANCE\|STAFF), joinedAt, active }` |
| `ROLE_MATRIX` | object | `역할 → { 22개 route: boolean }` — 메뉴 노출/권한 화면용 |
| `FREELANCERS` | array(6) | `{ id, name, specialty, rateType(FIXED\|VARIABLE), rate, activeTasks, onTimeRate, qualityScore, phone(마스킹), account(마스킹), active, monthPayout }` |
| `ORDERS` | array(12) | `{ id, platform, clientName, item, deptId, projectId, managerId, amount(원금액🔒), fee, refundedAmount(기환불누계), status(BS0010), dueDate, orderedAt, taskCount, doneTaskCount, outsourcingCost, activeApprovalId(진행 중 결재 홀드 배지) }` |
| `SALES_EVENTS` | array(16) | `{ id, orderId, type(PAYMENT\|PARTIAL_REFUND\|FULL_REFUND\|REPAYMENT), amount(부호 포함), occurredAt, approvalId }` — **현재 매출 = orderId별 amount 합산 (BS0001, 필드로 저장 안 함)** |
| `WORK_GROUPS` | array(7) | `{ id, name, orderId, deptId, ownerId, taskCount, doneCount, dueDate }` |
| `TASKS` | array(14) | `{ id, workGroupId, orderId, assigneeId(null=미배정), title, status(5컬럼), dueDate, priority(HIGH\|NORMAL), holdReason(ON_HOLD 필수) }` |
| `KANBAN_COLUMNS` | array | `["WAITING","IN_PROGRESS","REVIEW","DONE","ON_HOLD"]` |
| `TRANSITION_RULES` | object | `상태 → 이동 가능 상태[]` (BS0005 하드 가드) |
| `TRANSITION_DENY_MESSAGES` | object | `"FROM>TO" → 스냅백 토스트 문구` (`"DONE>*"` 와일드카드) |
| `HOLD_REQUIRES_REASON` | bool | ON_HOLD 진입 시 사유 모달 필수 |
| `ASSIGNMENTS` | array(12) | `{ id, taskId, freelancerId, rateSnapshot(배정 시점 고정 BS0008), assignedAt, assignedById }` |
| `APPROVAL_LINE_RULES` | array(7) | `{ id, docType, threshold(이 금액 이하 적용, null=전건), line(role[]), label }` — 기안 금액으로 승인선 자동 결정(MG1002) |
| `APPROVALS` | array(9) | `{ id(APR-2026-nnnnn), type, orderId, freelancerId?, settlementId?, requesterId, requester, amount, risk(low\|mid\|high), status(IN_PROGRESS\|APPROVED\|REJECTED), opinion, approvalLine[{step, role, approverId, approver, status(PENDING\|APPROVED\|REJECTED), comment, decidedAt}], expectedDiff[{field, label, type(money\|status\|note), before, after, delta, note}], createdAt, decidedAt, chainReceipt(APPROVED만: [{step, label, result, at, async}]), resultNote }` |
| `IMPORT_BATCHES` | array(6) | `{ id(IMP-nnn), kind(ORDER\|PAYMENT), source, platform, status(SUCCESS\|FAILED\|REVIEW_PENDING), totalRows, okRows, dupRows, errorRows, fallbackOf, uploadedById, collectedAt, note, rows[{row, status(OK\|DUP\|ERROR), data{...}, cause, errors[{col, value, cause}], createdOrderId/createdPaymentId}] }` — 오류는 **셀 단위 원인**(한국어 업무 용어) |
| `PAYMENTS` | array(8) | `{ id, paidAt, payer, amount, method, status(MATCHED\|UNMATCHED), orderId, suggestedOrderId(매칭 후보), batchId, memo }` |
| `SETTLEMENTS` | array(6) | `{ id, deptId, target, period(YYYY-MM), status(DRAFT\|CONFIRMED), snapshot{orderAmount, refundAmount, repaymentAmount, platformFee, outsourcingCost, profit}, recalcHistory[{at, approvalId, before, after, delta}](BS0007 이력), adjustments[{id, at, reason, amount, approvalId}](확정 후 조정), confirmedAt, confirmedById, checklist{unassignedZero, noActiveApproval, statementReviewed}(IDEA-14 확정 리추얼) }` — `profit = orderAmount − refundAmount + repaymentAmount − platformFee − outsourcingCost` |
| `PAYOUT_STATEMENTS` | array(4) | `{ id, freelancerId, period, status(DRAFT\|CONFIRMED\|PAID), lines[{id, type(WORK\|DEDUCTION), label, qty, rate, amount(차감은 음수), taskId, orderId, approvalId(차감 근거)}], total, note }` — PO-2607-101에 **환불 소급 차감 행**(−240,000, APR-2026-00142) |
| `TAX_INVOICES` | array(4) | `{ id, clientName, orderId, supplyAmount, vat, totalAmount, status(REQUESTED\|ISSUED\|DELIVERED), issueNo, requestedAt, issuedAt, requesterId, memo }` |
| `AUDIT_LOGS` | array(16) | `{ id, at, actorType(SYSTEM\|USER), actor, entityType, entityId, event, field, before, after, approvalId(SYSTEM 건 트리거), note }` — 계좌 diff는 마스킹 상태로 저장(MG1004) |
| `NOTIFICATIONS` | array(11) | `{ id, at, kind, title, body, approvalId(스레드 그룹핑 키), orderId, batchId, read, emailStatus(SENT\|QUEUED\|FAILED), route{name, payload}(클릭 딥링크 — navigate에 그대로) }` |
| `SAVED_VIEWS` | array(5) | `{ id, screen(route명), name, filters, count, shared }` |
| `EVALUATIONS` | array(3) | `{ id, freelancerId, taskId, orderId, evaluatorId, period, scores{quality, deadline, communication}(1~5), comment, createdAt }` — 평가 대기 = DONE 작업 중 미평가(TSK-014) |
| `KPIS` | object | `{ monthSales, monthProfit, onTimeRate, pendingApprovals }` 각 `{ value, deltaPct, trend[7] }` |
| `TREND_DAYS` | array(7) | `["07-04", …, "07-10"]` |
| `AGGREGATED_AT` | string | 집계 기준 시각 — 검산 배지 hover 캡션 (§6.1) |

### 4.1 ★ 7연쇄 정합 스토리 (수정 금지 — 시연 근거)

| 결재 | 내용 | 연결 데이터 |
|---|---|---|
| **APR-2026-00142** (APPROVED 07-10 09:20) | ORD-2607-004 라온뷰티 부분환불 −₩800,000 | ORDERS(refundedAmount 800,000·PARTIALLY_REFUNDED) · SE-016 · SET-2607-01 recalc(5,021,000→4,221,000) · PO-2607-101 차감 행 −240,000 · LOG-118~121 · NTF-004~005 |
| **APR-2026-00139** (APPROVED 07-10 09:58) | ORD-2607-010 윤슬주얼리 전체환불 −₩2,000,000 | ORDERS(REFUNDED) · SE-015 · SET-2607-02 recalc(3,330,000→1,330,000) · LOG-122~124 · NTF-006~008 |
| APR-2026-00131 → 00135 | ORD-2607-009 환불 −300,000 후 재결제 +150,000 | SE-013·SE-014 — 현재 매출 1,200,000이 이벤트 합산으로만 유도됨(BS0001) |
| APR-2026-00145 / 00146 / 00147 | 진행 중(부분환불 540,000 / 전체환불 2,700,000 / 단가변경) | 00145·00146은 주문 `activeApprovalId` 홀드 배지 + TSK-006·007 ON_HOLD 사유와 연결 |
| APR-2026-00144 | REJECTED — 데이터 무변경(BS0006) | LOG-125, NTF-011 |
| APR-2026-00118 | 확정 정산 조정(6월) −120,000 | SET-2606-01.adjustments ADJ-01 (MG1003) |

검산: 월 매출 17,170,000 = Σ SALES_EVENTS / 월 손익 6,966,500 = Σ 7월 SETTLEMENTS.profit.

## 5. 공용 컴포넌트 API (components.jsx — 전부 window.*)

```
Icon({ name, className })                       // 40+ 인라인 SVG: home bell chart file plus upload layers
                                                //  users columns edit inbox shieldCheck creditCard lock unlock
                                                //  wallet receipt star activity user user2 shield history search
                                                //  check x chevron* download refresh eye alert play pause minus
                                                //  arrowRight filter db mail sparkles clock link external copy
                                                //  trash calendar info calculator clipboard building zap layers…
Card({ children, className, ...rest })          // rounded-xl bg-slate-900 border-slate-700/60
SectionLabel({ children, color })               // 11px mono uppercase. purple|emerald|cyan|pink|amber|rose|slate
PageHeader({ label, labelColor, title, desc, actions })  // 페이지 헤더 3단 (§3.1)

EnumPill({ status, size='sm', className })      // ENUM_META 한글 라벨 + 도트 배지 (§4.1)
ENUM_META / PILL_COLORS                         // 직접 조회 가능 (예: ENUM_META[status].label)

Money({ value, negative, locked, formula, size='sm'|'md'|'lg', className })
  // JetBrains Mono tabular-nums. 음수(또는 negative) → '−' 부호 + rose (색약 대응 병행)
  // locked → 🔒 자물쇠 마이크로 아이콘 (원 금액 불변, BS0001)
  // formula → 점선 밑줄 + 클릭 수식 팝오버 (IDEA-07 금액 계보)
  //   string: 한 줄 설명 / array: [{ label, value, ref? }] 영수증 스타일 (ref = "APR-2026-00142" 근거 칩)
  // 우측 정렬은 소비자 책임: <td className="text-right"><window.Money …/></td>

DdayBadge({ date, base? })                      // 지연 D+n=rose 솔리드, ≤2 rose, ≤5 amber, 여유 slate (§4.4)
LockBadge({ date, reason })                     // 자물쇠+확정일, hover 툴팁 "수정은 조정 결재로만" (§4.5)

SidePanel({ open, onClose, title, subtitle, width=480, children, footer })
  // 우측 슬라이드(IDEA-06). Esc 닫기 내장, sticky 헤더, footer=하단 고정 컨텍스트 액션

SavedViewChips({ views, activeId, onSelect, allLabel })   // views=[{id,name,count}], onSelect(id|null)

ConfirmDialog({ open, risk='low'|'mid'|'high', title, message, summary, confirmValue,
                confirmLabel, cancelLabel, danger, onConfirm, onClose, children })
  // §4.6 3단 마찰: low=Enter 확정 / mid=summary 카드+명시 클릭 /
  // high=Type-to-Confirm — confirmValue(금액)와 입력이 일치해야 버튼 활성 (₩·콤마·공백 무시 비교)

toast(message, { actionLabel, onAction, tone('ok'|'warn'|'error'), duration })
useToast()                                      // → toast 반환 (호환용)
ToastHost                                       // 셸이 렌더 — 화면은 window.toast()만 호출 (IDEA-16 릴레이)

Sparkline({ data, color, height })
EmptyState({ icon, title, description, steps=[{title,desc}×3], actionLabel, onAction,
             secondaryLabel, onSecondary })     // §4.7 이전 단계 안내 + IDEA-18 3단계 온보딩

fmt(n)  pad(n)  maskPhone(p)  maskAccount(a)  ddayOf(date, base?)
```

## 6. EnumPill META (ENUM → 한글 라벨 · 색)

배지 공식 `bg-{c}-500/15 + text-{c}-300 + border-{c}-500/30 + 도트`. 색 의미 고정(§4.1):
emerald=성공·승인·확정 / rose=오류·반려·환불 / amber=진행·대기·주의·보류 / cyan=정보·배정·연동 / purple=브랜드·부분환불 / slate=중립·초안.

| 도메인 | ENUM → 라벨(색) |
|---|---|
| 주문(BS0010) | RECEIVED 접수(slate) · CONFIRMED 확정(emerald) · IN_PROGRESS 진행중(amber) · DONE 완료(emerald) · PARTIALLY_REFUNDED 부분환불(purple) · REFUNDED 전체환불(rose) · CANCELLED 취소(rose) |
| 작업(BS0005) | WAITING 대기(slate) · IN_PROGRESS 진행중(amber) · REVIEW 검수(amber) · DONE 완료(emerald) · ON_HOLD 보류(amber) |
| 결재 문서 | IN_PROGRESS 진행중(amber) · APPROVED 승인완료(emerald) · REJECTED 반려(rose) / 승인선 단계: PENDING 대기(slate) |
| 결재 유형 | ORDER_EDIT 주문수정(cyan) · PARTIAL_REFUND 부분환불(rose) · FULL_REFUND 전체환불(rose) · REPAYMENT 재결제(emerald) · RATE_CHANGE 단가변경(purple) · SETTLEMENT_ADJUST 정산조정(cyan) |
| 매출 이벤트 | PAYMENT 결제(emerald) · PARTIAL_REFUND/FULL_REFUND(rose) · REPAYMENT 재결제(emerald) |
| 정산·명세서 | DRAFT 초안(slate) · CONFIRMED 확정(emerald, **LockBadge 병기 §4.5**) · PAID 지급완료(emerald) |
| 결제 매칭 | MATCHED 매칭완료(emerald) · UNMATCHED 미매칭(amber) |
| 수집 | SUCCESS 성공(emerald) · FAILED 실패(rose) · REVIEW_PENDING 검수대기(amber) / 행: OK 정상 · DUP 중복(amber) · ERROR 오류(rose) |
| 세금계산서 | REQUESTED 발행요청(amber) · ISSUED 발행완료(emerald) · DELIVERED 전송완료(cyan) |
| 이메일(BS0011) | QUEUED 발송대기(amber) · SENT 발송완료(emerald) · FAILED 발송실패(rose) |
| 인물 | ACTIVE 활동중 · INACTIVE 비활성 / 역할: ADMIN 관리자 · EXEC 경영진 · TEAM_LEAD 팀장 · FINANCE 재무 · STAFF 실무자 |
| 기타 | HIGH 높음(rose) · NORMAL 보통(slate) · DEMO 데모(amber) |

미등록 ENUM은 라벨=원문·slate로 폴백. 새 상태는 components.jsx ENUM_META에 추가.

## 7. 금액 표기 규칙 (§4.2 — 요약)

1. 모든 금액 `window.Money` 사용: ₩ + ko-KR 콤마, mono tabular-nums. 테이블은 셀에서 우측 정렬.
2. **3분해 원칙**: 원 주문 금액(`locked` 🔒) / 기환불 누계 / 현재 매출(SALES_EVENTS 합산, `formula` 팝오버)을 항상 분리 표기 — 한 필드에 합치지 않는다(P1).
3. 환불·차감 = − 부호 + rose 병행(Money가 자동 처리). 증가 = + / emerald는 화면에서 문맥 표기.
4. 파생 금액(현재 매출·정산액·손익)엔 `formula`로 점선 밑줄 + 수식 팝오버(IDEA-07, P2).
5. **금액 인라인 편집 금지** — 수정 지점엔 "금액 변경은 결재로 진행돼요" + `navigate('draft', { orderId, type })` 버튼(MG1001).
6. 집계 숫자엔 검산 배지(초록 체크) + hover "집계 기준 {AGGREGATED_AT} · 대상 이벤트 n건".
7. 결재 번호는 `APR-2026-nnnnn` 형식으로만 표기(§4.3-6).

## 8. ConfirmDialog 3단 마찰 (§4.6)

| risk | 대상 | 동작 |
|---|---|---|
| `low` | 소액 승인, 일반 저장 | 다이얼로그 1개 — **Enter로 확정**, 반영 요약 1줄 |
| `mid` | 정산 확정, 배치 등록, 부분환불 승인 | `summary`(금액 총계 대조 카드) 재표시 + 명시 클릭 |
| `high` | 전체환불, 임계 초과 승인 | **Type-to-Confirm**: `confirmValue` 금액 재입력, 불일치 인라인 에러, 일치해야 활성. summary에 반영 예상 3줄(매출·정산·손익) 재표시 |

반려는 같은 다이얼로그 패턴 + 사유 필수 + "데이터는 변경되지 않습니다" 명시(BS0006).
APPROVALS의 `risk` 필드를 그대로 쓰면 된다.

## 9. 디자인 토큰 · Tweaks

- 다크 퍼스트 `#020617` + Aurora(셸 처리). 카드 `bg-slate-900 rounded-xl border-slate-700/60`.
- CTA·강조 = `bg-gradient-to-r from-purple-600 to-pink-600`. 브랜드 색은 `tweaks.brandColor`(CSS 변수 `--brand`).
- `tweaks = { brandName, brandColor, policyMode }`. `policyMode`: `PRIORITY`(순차 — 첫 PENDING만 활성) | `BROADCAST`(병렬 합의 — 전원 동시 상신). 결재 화면(draft·inbox·approvalDetail)은 승인선 렌더에 반영할 것.
- 모션은 의미 전달만(§4.9): 펄스=진행, 스냅백=차단, 순차 점등(420ms)=7연쇄, 자물쇠 닫힘=확정.
- UX 라이팅(§4.10): 실무 언어 + 다음 행동 안내 + 근거 코드(BS/MG) 캡션 병기.
