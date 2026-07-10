/* pt/slides.js — 슬라이드 렌더링 + 키보드 네비게이션
 * - 좌/우/스페이스: 이동
 * - N: 발표자 노트 토글
 * - Esc: 개요 그리드 토글
 * - URL hash sync (#1 ~ #8)
 */
(function () {
  "use strict";

  const SLIDES = window.SLIDES || [];
  const PROTO_SCREENS = window.PROTO_SCREENS || [];
  const SYSTEM_FLOW = window.SYSTEM_FLOW || [];
  const MILESTONES = window.MILESTONES || [];
  const ARCH_TIERS = window.ARCH_TIERS || [];
  const ARCH_WORKER = window.ARCH_WORKER || null;
  const ARCH_REASONS = window.ARCH_REASONS || [];
  const QNA_ITEMS = window.QNA_ITEMS || [];

  /* ── Mini SVG previews for proto screens (9화면 대표 8항목 그리드) ─── */
  function svgPreview(id) {
    // Lightweight placeholder: layout structure only, replace with PNG screenshots later
    const map = {
      "search":        '<svg viewBox="0 0 120 38"><rect x="3" y="4" width="40" height="6" rx="1" fill="rgba(168,85,247,0.4)"/><rect x="3" y="14" width="114" height="3" rx="0.5" fill="rgba(255,255,255,0.1)"/><rect x="3" y="20" width="114" height="3" rx="0.5" fill="rgba(255,255,255,0.06)"/><rect x="3" y="26" width="80" height="3" rx="0.5" fill="rgba(255,255,255,0.06)"/></svg>',
      "analytics":     '<svg viewBox="0 0 120 38"><rect x="3" y="20" width="6" height="14" fill="rgba(110,231,183,0.5)"/><rect x="13" y="14" width="6" height="20" fill="rgba(110,231,183,0.6)"/><rect x="23" y="22" width="6" height="12" fill="rgba(110,231,183,0.5)"/><rect x="33" y="10" width="6" height="24" fill="rgba(110,231,183,0.7)"/><rect x="43" y="18" width="6" height="16" fill="rgba(110,231,183,0.55)"/><circle cx="80" cy="22" r="10" fill="none" stroke="rgba(168,85,247,0.5)" stroke-width="3"/><circle cx="80" cy="22" r="10" fill="none" stroke="rgba(244,114,182,0.6)" stroke-width="3" stroke-dasharray="40 100"/></svg>',
      "tender-detail": '<svg viewBox="0 0 120 38"><rect x="3" y="3" width="80" height="4" rx="1" fill="rgba(255,255,255,0.4)"/><rect x="3" y="11" width="114" height="2" rx="0.5" fill="rgba(255,255,255,0.1)"/><rect x="3" y="16" width="114" height="2" rx="0.5" fill="rgba(255,255,255,0.1)"/><rect x="3" y="21" width="90" height="2" rx="0.5" fill="rgba(255,255,255,0.08)"/><rect x="3" y="29" width="40" height="6" rx="1" fill="rgba(168,85,247,0.4)"/><rect x="48" y="29" width="40" height="6" rx="1" fill="rgba(255,255,255,0.08)"/></svg>',
      "scraps":        '<svg viewBox="0 0 120 38"><rect x="3" y="4" width="22" height="30" rx="1" fill="rgba(255,255,255,0.06)"/><rect x="29" y="4" width="22" height="30" rx="1" fill="rgba(168,85,247,0.18)"/><rect x="55" y="4" width="22" height="30" rx="1" fill="rgba(110,231,183,0.18)"/><rect x="81" y="4" width="22" height="30" rx="1" fill="rgba(252,211,77,0.18)"/></svg>',
      "dashboard":     '<svg viewBox="0 0 120 38"><rect x="3" y="3" width="26" height="14" rx="1" fill="rgba(168,85,247,0.18)"/><rect x="33" y="3" width="26" height="14" rx="1" fill="rgba(110,231,183,0.18)"/><rect x="63" y="3" width="26" height="14" rx="1" fill="rgba(252,211,77,0.18)"/><rect x="93" y="3" width="24" height="14" rx="1" fill="rgba(244,114,182,0.18)"/><polyline points="3,30 20,24 40,28 60,20 80,26 100,18 117,22" fill="none" stroke="rgba(110,231,183,0.7)" stroke-width="1.5"/></svg>',
      "console":       '<svg viewBox="0 0 120 38"><circle cx="15" cy="20" r="5" fill="rgba(168,85,247,0.6)"/><line x1="20" y1="20" x2="35" y2="20" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="2 2"/><circle cx="40" cy="20" r="5" fill="rgba(168,85,247,0.4)"/><line x1="45" y1="20" x2="60" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2 2"/><circle cx="65" cy="20" r="5" fill="rgba(255,255,255,0.15)"/><line x1="70" y1="20" x2="85" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2 2"/><circle cx="90" cy="20" r="5" fill="rgba(255,255,255,0.15)"/><rect x="3" y="29" width="80" height="5" rx="1" fill="rgba(252,211,77,0.25)"/></svg>',
      "history":       '<svg viewBox="0 0 120 38"><rect x="3" y="5" width="114" height="2" fill="rgba(255,255,255,0.1)"/><rect x="3" y="11" width="114" height="2" fill="rgba(110,231,183,0.3)"/><rect x="3" y="17" width="80" height="2" fill="rgba(244,63,94,0.3)"/><rect x="3" y="23" width="114" height="2" fill="rgba(110,231,183,0.3)"/><rect x="3" y="29" width="100" height="2" fill="rgba(255,255,255,0.1)"/></svg>',
      "templates":     '<svg viewBox="0 0 120 38"><rect x="3" y="4" width="36" height="30" rx="1" fill="rgba(255,255,255,0.06)" stroke="rgba(168,85,247,0.4)"/><rect x="43" y="4" width="36" height="30" rx="1" fill="rgba(255,255,255,0.06)" stroke="rgba(110,231,183,0.4)"/><rect x="83" y="4" width="34" height="30" rx="1" fill="rgba(255,255,255,0.06)" stroke="rgba(252,211,77,0.4)"/></svg>',
      // 신규 5화면 — 엑셀 업로드·칸반·정산·평가·권한 매트릭스
      "orders":        '<svg viewBox="0 0 120 38"><rect x="3" y="4" width="30" height="6" rx="1" fill="rgba(110,231,183,0.4)"/><rect x="3" y="13" width="114" height="2.5" rx="0.5" fill="rgba(255,255,255,0.1)"/><rect x="3" y="18" width="114" height="2.5" rx="0.5" fill="rgba(255,255,255,0.07)"/><rect x="3" y="23" width="114" height="2.5" rx="0.5" fill="rgba(255,255,255,0.07)"/><polyline points="3,34 25,30 45,32 65,26 85,29 117,22" fill="none" stroke="rgba(168,85,247,0.6)" stroke-width="1.5"/></svg>',
      "kanban":        '<svg viewBox="0 0 120 38"><rect x="3" y="4" width="34" height="30" rx="1" fill="rgba(255,255,255,0.04)"/><rect x="43" y="4" width="34" height="30" rx="1" fill="rgba(255,255,255,0.04)"/><rect x="83" y="4" width="34" height="30" rx="1" fill="rgba(255,255,255,0.04)"/><rect x="6" y="7" width="28" height="7" rx="1" fill="rgba(168,85,247,0.4)"/><rect x="6" y="16" width="28" height="7" rx="1" fill="rgba(168,85,247,0.25)"/><rect x="46" y="7" width="28" height="7" rx="1" fill="rgba(110,231,183,0.4)"/><rect x="86" y="7" width="28" height="7" rx="1" fill="rgba(252,211,77,0.4)"/></svg>',
      "settlement":    '<svg viewBox="0 0 120 38"><rect x="3" y="4" width="70" height="4" rx="1" fill="rgba(255,255,255,0.35)"/><rect x="3" y="12" width="114" height="2.5" rx="0.5" fill="rgba(255,255,255,0.1)"/><rect x="3" y="18" width="114" height="2.5" rx="0.5" fill="rgba(255,255,255,0.08)"/><rect x="3" y="24" width="90" height="2.5" rx="0.5" fill="rgba(255,255,255,0.08)"/><rect x="3" y="30" width="60" height="5" rx="1" fill="rgba(110,231,183,0.45)"/><rect x="95" y="30" width="22" height="5" rx="1" fill="rgba(252,211,77,0.4)"/></svg>',
      "hr":            '<svg viewBox="0 0 120 38"><circle cx="12" cy="14" r="7" fill="rgba(168,85,247,0.45)"/><circle cx="12" cy="30" r="5" fill="rgba(244,114,182,0.35)"/><rect x="26" y="9" width="60" height="3.5" rx="1" fill="rgba(110,231,183,0.5)"/><rect x="26" y="15" width="40" height="3.5" rx="1" fill="rgba(110,231,183,0.3)"/><rect x="26" y="27" width="70" height="3.5" rx="1" fill="rgba(252,211,77,0.45)"/><rect x="26" y="33" width="30" height="3.5" rx="1" fill="rgba(252,211,77,0.25)"/></svg>',
      "admin":         '<svg viewBox="0 0 120 38"><g fill="rgba(255,255,255,0.06)"><rect x="3" y="4" width="14" height="8" rx="1"/><rect x="21" y="4" width="14" height="8" rx="1"/><rect x="39" y="4" width="14" height="8" rx="1"/><rect x="3" y="15" width="14" height="8" rx="1"/><rect x="21" y="15" width="14" height="8" rx="1"/><rect x="39" y="15" width="14" height="8" rx="1"/><rect x="3" y="26" width="14" height="8" rx="1"/><rect x="21" y="26" width="14" height="8" rx="1"/><rect x="39" y="26" width="14" height="8" rx="1"/></g><rect x="3" y="4" width="14" height="8" rx="1" fill="rgba(168,85,247,0.5)"/><rect x="39" y="15" width="14" height="8" rx="1" fill="rgba(168,85,247,0.5)"/><rect x="21" y="26" width="14" height="8" rx="1" fill="rgba(168,85,247,0.5)"/><circle cx="96" cy="19" r="11" fill="none" stroke="rgba(110,231,183,0.5)" stroke-width="2"/><path d="M90 19 l4 4 l8 -9" fill="none" stroke="rgba(110,231,183,0.7)" stroke-width="2"/></svg>',
    };
    return map[id] || '<svg viewBox="0 0 120 38"><rect x="0" y="0" width="120" height="38" fill="rgba(255,255,255,0.04)"/></svg>';
  }

  /* ── Slide renderers ─────────────────────────────────── */
  function renderCover(s) {
    return `
      <div class="slide-cover">
        <div class="badge">
          <span class="pulse"></span>
          위시켓 #156767 · 사전 분석 완료
        </div>
        <h1>
          ${escapeHtml(s.title)}<br/>
          <span class="grad-text">${escapeHtml(s.subtitle)}</span>
        </h1>
        <div class="meta">6,000만원 · 120일(17주) · 22년차 백엔드 · 2분 PT</div>
      </div>
    `;
  }

  function renderWho(s) {
    return `
      <div class="slide-chapter-label">
        ${escapeHtml(s.chapter)}
        <span class="duration">${escapeHtml(s.duration)}</span>
      </div>
      <h2 class="slide-title">${escapeHtml(s.title)}</h2>
      <p class="slide-subtitle">Java/Spring Boot 22년 · 32+ 프로젝트 — 엔터프라이즈 백엔드 + 전자결재 실무 + AI/LLM 통합</p>

      <div class="career-timeline">
        <div class="career-block si">
          <div class="span">22년 · 32+ 프로젝트</div>
          <div class="label">Java/Spring Boot 백엔드</div>
          <div class="desc">ERP·금융·관리시스템 엔터프라이즈 백엔드 (Spring Boot·PostgreSQL·Docker·AWS)</div>
        </div>
        <div class="career-block sm">
          <div class="span">금융권 실무</div>
          <div class="label">산업은행 EKP 전자결재</div>
          <div class="desc">전자결재 시스템 유지보수 리드 — 기안·승인선·문서 워크플로우 (Java·Spring·Oracle)</div>
        </div>
        <div class="career-block remote">
          <div class="span">최근 집중 영역</div>
          <div class="label">AI/LLM 통합</div>
          <div class="desc">노동법 AI RAG(판례 8만건 검색·요약) · ChatGPT/Claude API 연동 · 업무 자동화</div>
        </div>
      </div>

      <div class="highlight-box">
        <div class="label">본 공고와 직접 연결</div>
        <div class="text">우대사항 "복잡한 전자결재 워크플로우" — 산업은행 EKP 전자결재 유지보수 리드</div>
        <div class="sub">환불 승인의 7연쇄 처리(결재→주문→매출→정산→손익→이력→알림)를 금융권 결재 실무 감각으로 설계합니다</div>
      </div>
    `;
  }

  function renderFit(s) {
    const flow = SYSTEM_FLOW.map(f => `
      <div class="flow-card">
        <div class="step">STEP ${f.step}</div>
        <div class="icon">${f.icon}</div>
        <div class="label">${escapeHtml(f.label)}</div>
        <div class="note">${escapeHtml(f.note)}</div>
      </div>
    `).join("");

    const screens = PROTO_SCREENS.map(p => {
      const grpClass = p.group === "코어" ? "member" : "admin";
      return `
        <div class="screen-card">
          <div class="head">
            <span class="grp ${grpClass}">${escapeHtml(p.group)}</span>
            <span class="uc">${escapeHtml(p.uc)}</span>
          </div>
          <div class="label">${escapeHtml(p.label)}</div>
          <div class="preview">${svgPreview(p.id)}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="slide-chapter-label">
        ${escapeHtml(s.chapter)}
        <span class="duration">${escapeHtml(s.duration)}</span>
      </div>
      <h2 class="slide-title">${escapeHtml(s.title)}</h2>

      <div class="flow-row">${flow}</div>

      <div class="screens-section">
        <div class="screens-caption">
          공고 분석하면서 <strong>라이브 관리자 콘솔 데모</strong>를 미리 만들어 두었습니다 — 5그룹 9화면 + 환불 결재 위저드 4스텝
        </div>
        <div class="screens-grid">${screens}</div>
        <div class="url-caption"><span class="arrow">↗</span>meleteyo.github.io/refui-156767/proto/</div>
      </div>
    `;
  }

  function renderArch(s) {
    const tiers = ARCH_TIERS.map((t, i) => `
      <div class="arch-tier${t.core ? ' core' : ''}">
        <div class="tier-head">
          <span class="tier-name">${escapeHtml(t.tier)}</span>
          <span class="tier-tech">${escapeHtml(t.tech)}</span>
        </div>
        <div class="tier-note">${escapeHtml(t.note)}</div>
      </div>
      ${i < ARCH_TIERS.length - 1 ? '<div class="arch-arrow">↓</div>' : ""}
    `).join("");

    const worker = ARCH_WORKER ? `
      <div class="arch-worker">
        <div class="lane-label">별도 레인</div>
        <div class="tier-head">
          <span class="tier-name">${escapeHtml(ARCH_WORKER.tier)}</span>
        </div>
        <div class="tier-tech">${escapeHtml(ARCH_WORKER.tech)}</div>
        <div class="tier-note">${escapeHtml(ARCH_WORKER.note)}</div>
      </div>
    ` : "";

    const reasons = ARCH_REASONS.map(r => `
      <div class="arch-reason">
        <div class="no">${escapeHtml(r.no)}</div>
        <div class="body">
          <div class="head">${escapeHtml(r.head)}</div>
          <div class="text">${escapeHtml(r.body)}</div>
        </div>
      </div>
    `).join("");

    return `
      <div class="slide-chapter-label">
        ${escapeHtml(s.chapter)}
        <span class="duration">${escapeHtml(s.duration)}</span>
      </div>
      <h2 class="slide-title">${escapeHtml(s.title)}</h2>
      <p class="slide-subtitle">${escapeHtml(s.subtitle)}</p>

      <div class="arch-layout">
        <div class="arch-main">${tiers}</div>
        ${worker}
      </div>

      <div class="arch-reasons">${reasons}</div>

      <p class="bottom-line">
        <strong>MSA · Kafka · CQRS는 배제</strong> — 120일·6,000만원 규모엔 과설계라 의도적으로 뺐습니다
      </p>
    `;
  }

  function renderHow(s) {
    const cards = MILESTONES.map(m => `
      <div class="milestone${m.highlight ? ' featured' : ''}">
        <div class="week">${escapeHtml(m.week)}</div>
        <div class="focus">${escapeHtml(m.focus)}</div>
        <ul class="items">
          ${m.items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
        ${m.highlight ? `<div class="pin">📌 ${escapeHtml(m.highlight)}</div>` : ""}
      </div>
    `).join("");

    return `
      <div class="slide-chapter-label">
        ${escapeHtml(s.chapter)}
        <span class="duration">${escapeHtml(s.duration)}</span>
      </div>
      <h2 class="slide-title">${escapeHtml(s.title)}</h2>
      <p class="slide-subtitle">매주 금요일 30분 시연으로 막판 "이게 아닌데" 함정을 막습니다.</p>

      <div class="milestones">${cards}</div>

      <div class="comm-bar">
        <div class="item">💬 <strong>당일 응답</strong> — 카톡·슬랙</div>
        <div class="item">📅 <strong>주 1회 진행 보고</strong> — 금요일 30분 시연</div>
        <div class="item">🎥 <strong>화상 미팅</strong> — 가능</div>
      </div>
    `;
  }

  function renderQna(s) {
    const items = QNA_ITEMS.map((it, i) => `
      <div class="qna-item">
        <div class="qna-index">Q${i + 1}</div>
        <div class="qna-body">
          <div class="qna-tag">${escapeHtml(it.tag)}</div>
          <div class="qna-q">"${escapeHtml(it.q)}"</div>
          <div class="qna-a">${escapeHtml(it.a)}</div>
          <div class="qna-evidence"><span class="ev-mark">근거</span>${escapeHtml(it.evidence)}</div>
        </div>
      </div>
    `).join("");

    return `
      <div class="slide-chapter-label">
        ${escapeHtml(s.chapter)}
        <span class="duration">${escapeHtml(s.duration)}</span>
      </div>
      <h2 class="slide-title">${escapeHtml(s.title)}</h2>
      <p class="slide-subtitle">${escapeHtml(s.subtitle)}</p>

      <div class="qna-list">${items}</div>
    `;
  }

  function renderAsk(s) {
    return `
      <div class="slide-chapter-label">
        ${escapeHtml(s.chapter)}
        <span class="duration">${escapeHtml(s.duration)}</span>
      </div>

      <h2 class="question-headline">
        <em>'부분환불 시 정산 재계산 규칙'</em><br/>
        — 매출만 차감? 외주비·수수료까지 연동?
      </h2>

      <div class="branches">
        <div class="branch good">
          <div class="case">해석 A · 매출만 차감</div>
          <div class="verdict">산식 단순 — 기준선 일정 그대로</div>
          <div class="desc">환불액만큼 매출만 차감, 외주비·플랫폼 수수료는 불변. 이벤트 원장 구조로 즉시 수용됩니다.</div>
        </div>
        <div class="branch warn">
          <div class="case">해석 B · 외주비·수수료 연동 재계산</div>
          <div class="verdict">정산 산식 계층 확장</div>
          <div class="desc">어느 해석이든 이벤트 원장 설계로 흡수합니다 — 단, 첫날 확정돼야 11~12주차 정산 개발이 흔들리지 않습니다.</div>
        </div>
      </div>

      <p class="bottom-line">
        <strong>착수 3일 내 필요한 것</strong> — ①주문·환불·정산 실사례 5~10건 ②현재 엑셀 양식 ③판매 플랫폼 목록(API 확인용)
      </p>
    `;
  }

  function renderThanks(s) {
    return `
      <div class="slide-cover">
        <h1 class="grad-text" style="margin-bottom: 0.5rem;">${escapeHtml(s.title)}</h1>
        <p class="slide-subtitle" style="text-align:center; margin: 0 0 1rem;">${escapeHtml(s.subtitle)}</p>
      </div>

      <div class="thanks-grid">
        <a class="url-card" href="https://meleteyo.github.io/refui-156767/" target="_blank" rel="noopener">
          <div class="ic">🌐</div>
          <div class="label">시스템 소개</div>
          <div class="url">meleteyo.github.io/refui-156767/</div>
          <div class="desc">IT 전문가용 / 일반 고객용 2벌 + 랜딩</div>
        </a>
        <a class="url-card" href="https://meleteyo.github.io/refui-156767/proto/" target="_blank" rel="noopener">
          <div class="ic">🖥️</div>
          <div class="label">라이브 관리자 콘솔</div>
          <div class="url">meleteyo.github.io/refui-156767/proto/</div>
          <div class="desc">9화면 + 환불 결재 4스텝 위저드 — 모두 클릭 가능</div>
        </a>
        <a class="url-card" href="https://meleteyo.github.io/refui-156767/demo/자동시연.html" target="_blank" rel="noopener">
          <div class="ic">▶️</div>
          <div class="label">90초 자동 시연</div>
          <div class="url">meleteyo.github.io/refui-156767/demo/자동시연.html</div>
          <div class="desc">클릭 없이 자동 재생 · 한국어 캡션</div>
        </a>
      </div>

      <p class="thanks-attach">
        <span class="attach-label">별첨 자료</span>
        요구사항 검토서 · 리스크 분석 20건 · 17주 실행계획 · 자동화/수동화 구분표 · 도메인 모델 설계
      </p>
    `;
  }

  const RENDERERS = {
    "cover": renderCover,
    "who": renderWho,
    "fit": renderFit,
    "arch": renderArch,
    "how": renderHow,
    "qna": renderQna,
    "ask": renderAsk,
    "thanks": renderThanks,
  };

  /* ── Mount slides ────────────────────────────────────── */
  const deck = document.getElementById("deck");
  SLIDES.forEach((s, i) => {
    const el = document.createElement("section");
    el.className = "slide";
    el.dataset.index = String(i);
    el.dataset.id = s.id;
    const renderer = RENDERERS[s.id] || (() => `<h2 class="slide-title">${escapeHtml(s.title || "")}</h2>`);
    el.innerHTML = renderer(s);
    deck.appendChild(el);
  });

  /* ── Mount overview ──────────────────────────────────── */
  const overviewGrid = document.getElementById("overview-grid");
  SLIDES.forEach((s, i) => {
    const tile = document.createElement("div");
    tile.className = "overview-tile";
    tile.dataset.index = String(i);
    tile.innerHTML = `
      <div class="num">${String(i + 1).padStart(2, "0")} / ${String(SLIDES.length).padStart(2, "0")}</div>
      <div class="title">${escapeHtml(s.title || "")}</div>
      <div class="ch">${escapeHtml(s.chapter || "")}${s.duration ? " · " + escapeHtml(s.duration) : ""}</div>
    `;
    tile.addEventListener("click", () => {
      goTo(i);
      closeOverview();
    });
    overviewGrid.appendChild(tile);
  });

  /* ── State ───────────────────────────────────────────── */
  let current = parseHash();

  function parseHash() {
    const m = (location.hash || "").match(/^#(\d+)$/);
    if (!m) return 0;
    const n = parseInt(m[1], 10) - 1;
    return clamp(n, 0, SLIDES.length - 1);
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  /* ── Navigation ──────────────────────────────────────── */
  function goTo(idx) {
    current = clamp(idx, 0, SLIDES.length - 1);
    renderState();
    location.hash = String(current + 1);
  }
  function next() { if (current < SLIDES.length - 1) goTo(current + 1); }
  function prev() { if (current > 0) goTo(current - 1); }

  function renderState() {
    // Active slide
    [...deck.children].forEach((el, i) => {
      el.classList.toggle("active", i === current);
      el.classList.toggle("prev", i < current);
    });
    // Overview tiles
    [...overviewGrid.children].forEach((el, i) => {
      el.classList.toggle("active", i === current);
    });
    // Footer
    const s = SLIDES[current];
    document.getElementById("slide-num").textContent = `${current + 1} / ${SLIDES.length}`;
    document.getElementById("slide-chapter").textContent = (s.chapter || "") + (s.duration ? " · " + s.duration : "");
    // Notes
    document.getElementById("notes-body").textContent = s.note || "";
  }

  /* ── Notes ──────────────────────────────────────────── */
  const notesEl = document.getElementById("notes");
  function toggleNotes() { notesEl.classList.toggle("open"); }

  /* ── Overview ───────────────────────────────────────── */
  const overviewEl = document.getElementById("overview");
  function openOverview() { overviewEl.classList.add("open"); }
  function closeOverview() { overviewEl.classList.remove("open"); }
  function toggleOverview() { overviewEl.classList.toggle("open"); }

  /* ── Keyboard ───────────────────────────────────────── */
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      if (overviewEl.classList.contains("open")) return;
      next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      if (overviewEl.classList.contains("open")) return;
      prev();
    } else if (e.key === "Escape") {
      e.preventDefault();
      toggleOverview();
    } else if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      toggleNotes();
    } else if (e.key === "Home") {
      goTo(0);
    } else if (e.key === "End") {
      goTo(SLIDES.length - 1);
    }
  });

  // Touch swipe (optional, simple)
  let touchStartX = 0;
  document.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next();
    else prev();
  }, { passive: true });

  // Mouse click navigation
  // - Left-click on slide content → next slide
  // - Right-click on slide content → previous slide (preventDefault context menu)
  // - Skip if click is on a link (<a>), notes panel, footer, or overview
  function shouldIgnoreClick(target) {
    return !!(target.closest("a") ||
              target.closest(".notes") ||
              target.closest(".overview") ||
              target.closest(".deck-footer"));
  }

  deck.addEventListener("click", (e) => {
    if (shouldIgnoreClick(e.target)) return;
    if (overviewEl.classList.contains("open")) return;
    next();
  });

  deck.addEventListener("contextmenu", (e) => {
    if (shouldIgnoreClick(e.target)) return;
    if (overviewEl.classList.contains("open")) return;
    e.preventDefault();
    prev();
  });

  // hashchange for back/forward buttons
  window.addEventListener("hashchange", () => {
    const idx = parseHash();
    if (idx !== current) {
      current = idx;
      renderState();
    }
  });

  /* ── Font size scaler ───────────────────────────────── */
  const FS_KEY = "pt156767.fontScale";
  const fsButtons = [...document.querySelectorAll(".fs-btn")];
  const allowedScales = fsButtons.map(b => parseFloat(b.dataset.scale));

  function applyFontScale(scale) {
    const s = allowedScales.includes(scale) ? scale : 1;
    document.documentElement.style.fontSize = (16 * s) + "px";
    fsButtons.forEach(b => {
      b.classList.toggle("active", parseFloat(b.dataset.scale) === s);
    });
    try { localStorage.setItem(FS_KEY, String(s)); } catch (_) {}
  }

  fsButtons.forEach(b => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      applyFontScale(parseFloat(b.dataset.scale));
    });
  });

  let initialScale = 1.5;
  try {
    const saved = parseFloat(localStorage.getItem(FS_KEY) || "");
    if (allowedScales.includes(saved)) initialScale = saved;
  } catch (_) {}
  applyFontScale(initialScale);

  // Initial render
  renderState();
})();
