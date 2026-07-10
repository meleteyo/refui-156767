/* =========================================================
   wishket-refui · Client JavaScript
   - CountUp animations
   - Chart.js 초기화 (KPI·trend·allocation·radar·risks scatter)
   - ⌘K Command Menu
   - MRR Simulator
   - ROI Calculator
   - Architecture tabs
   - Floating chatbot toggle + demo messages
   - Side panel
   ========================================================= */

(() => {
  // =========================================================
  // 1. CountUp (숫자 애니메이션)
  // =========================================================
  function countUp(el, target, duration = 1500, decimal = false) {
    const start = 0;
    const startTime = performance.now();
    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = start + (target - start) * eased;
      el.textContent = decimal
        ? value.toFixed(1)
        : Math.round(value).toLocaleString('ko-KR');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function observeCountUps() {
    const els = document.querySelectorAll('[data-countup], [data-countup-decimal]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || e.target.dataset.countupDone) return;
        e.target.dataset.countupDone = '1';
        const isDecimal = e.target.hasAttribute('data-countup-decimal');
        const target = parseFloat(e.target.getAttribute(isDecimal ? 'data-countup-decimal' : 'data-countup'));
        countUp(e.target, target, 1500, isDecimal);
      });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
  }

  // =========================================================
  // 2. Chart.js global defaults
  // =========================================================
  function initChartDefaults() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = 'rgba(241,245,249,0.7)';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
    Chart.defaults.font.family = "'Pretendard Variable', Pretendard, system-ui, sans-serif";
  }

  // =========================================================
  // 3. Portfolio charts
  //    - chart-trend       자산 추이 (line)
  //    - chart-allocation  자산 비중 (doughnut)
  //    - sparkline-today   오늘 스파크라인
  //    - chart-radar       평가 엔진 레이더
  //    - chart-risks       리스크 매트릭스 scatter
  // =========================================================
  function initCharts() {
    if (typeof Chart === 'undefined') return;

    const trendData = window.REFUI_DATA?.trend || defaultTrendData();
    const allocationData = window.REFUI_DATA?.allocation || defaultAllocationData();
    const subScores = window.REFUI_DATA?.subScores || [94, 91, 82, 61, 88];
    const risks = window.REFUI_DATA?.risks || defaultRiskData();

    // Trend
    const trendEl = document.getElementById('chart-trend');
    if (trendEl) {
      new Chart(trendEl, {
        type: 'line',
        data: {
          labels: trendData.labels,
          datasets: [{
            label: '총 평가액',
            data: trendData.values,
            borderColor: '#a855f7',
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 260);
              g.addColorStop(0, 'rgba(168,85,247,0.3)');
              g.addColorStop(1, 'rgba(168,85,247,0)');
              return g;
            },
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5,
          }],
        },
        options: commonChartOpts({
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { callback: (v) => '₩' + (v/1e7).toFixed(1) + '천만' },
            },
          },
        }),
      });
    }

    // Allocation doughnut
    const allocEl = document.getElementById('chart-allocation');
    if (allocEl) {
      new Chart(allocEl, {
        type: 'doughnut',
        data: {
          labels: allocationData.labels,
          datasets: [{
            data: allocationData.values,
            backgroundColor: ['#a855f7', '#10b981', '#22d3ee', '#f59e0b', '#ec4899'],
            borderWidth: 0,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' },
            },
          },
        },
      });
    }

    // Sparkline today
    const sparkEl = document.getElementById('sparkline-today');
    if (sparkEl) {
      new Chart(sparkEl, {
        type: 'line',
        data: {
          labels: Array.from({length: 24}, (_, i) => i),
          datasets: [{
            data: defaultSparklineData(),
            borderColor: '#10b981',
            borderWidth: 1.5,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        },
      });
    }

    // Radar chart
    const radarEl = document.getElementById('chart-radar');
    if (radarEl) {
      new Chart(radarEl, {
        type: 'radar',
        data: {
          labels: ['성장성', '수익성', '안정성', '밸류에이션', '모멘텀'],
          datasets: [{
            label: '점수',
            data: subScores,
            backgroundColor: 'rgba(168,85,247,0.2)',
            borderColor: '#a855f7',
            borderWidth: 2,
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              angleLines: { color: 'rgba(255,255,255,0.1)' },
              grid: { color: 'rgba(255,255,255,0.08)' },
              pointLabels: { font: { size: 12 }, color: '#cbd5e1' },
              ticks: { backdropColor: 'transparent', color: '#64748b', stepSize: 20 },
              suggestedMin: 0, suggestedMax: 100,
            },
          },
        },
      });
    }

    // Risk scatter — 확률·영향 1~5, 점수 = 확률×영향 (최대 25)
    // 등급: Critical 15+ / High 10~14 / ≤9 관리 (6_리스크분석 §1)
    const riskEl = document.getElementById('chart-risks');
    if (riskEl) {
      const datasetsByColor = {
        danger: { label: 'Critical 15+', data: [], backgroundColor: 'rgba(239,68,68,0.8)', borderColor: '#ef4444' },
        warn:   { label: 'High 10~14',  data: [], backgroundColor: 'rgba(245,158,11,0.8)', borderColor: '#f59e0b' },
        info:   { label: '≤ 9', data: [], backgroundColor: 'rgba(100,116,139,0.8)', borderColor: '#64748b' },
      };
      // 동일 좌표 리스크는 겹치므로 살짝 지터를 준다 (좌표당 최대 ±0.14)
      const seen = {};
      risks.forEach((r) => {
        const color = r.score >= 15 ? 'danger' : (r.score >= 10 ? 'warn' : 'info');
        const key = `${r.impact},${r.prob}`;
        const n = (seen[key] = (seen[key] || 0) + 1);
        const jitter = (n - 1) * 0.14 * (n % 2 === 0 ? 1 : -1);
        datasetsByColor[color].data.push({ x: r.impact + jitter, y: r.prob + (n > 2 ? jitter / 2 : 0), id: r.id, name: r.name, strategy: r.strategy, score: r.score, cat: r.cat || '', grade: r.grade || '' });
      });
      new Chart(riskEl, {
        type: 'scatter',
        data: { datasets: Object.values(datasetsByColor).map((ds) => ({ ...ds, pointRadius: 10, pointHoverRadius: 14, borderWidth: 2 })) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (e, elements) => {
            if (!elements.length) return;
            const el = elements[0];
            const dataset = e.chart.data.datasets[el.datasetIndex];
            const pt = dataset.data[el.index];
            openRiskPanel(pt);
          },
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw.id}: ${ctx.raw.name} (${ctx.raw.score})`,
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: '영향 →' },
              min: 0.5, max: 5.5,
              ticks: { stepSize: 1, callback: (v) => ['', '1 하', '2', '3 중', '4', '5 상'][v] || '' },
              grid: { color: 'rgba(255,255,255,0.04)' },
            },
            y: {
              title: { display: true, text: '확률 →' },
              min: 0.5, max: 5.5,
              ticks: { stepSize: 1, callback: (v) => ['', '1 하', '2', '3 중', '4', '5 상'][v] || '' },
              grid: { color: 'rgba(255,255,255,0.04)' },
            },
          },
        },
      });
    }
  }

  // 리스크 상세 사이드 패널 (scatter 클릭 + .risk-card 클릭 공용)
  function openRiskPanel(r) {
    const gradeLabel = r.grade || (r.score >= 15 ? 'Critical' : (r.score >= 10 ? 'High' : 'Medium/Low'));
    const gradeColor = r.score >= 15 ? 'text-red-300' : (r.score >= 10 ? 'text-amber-300' : 'text-slate-300');
    openSidePanel(`리스크 ${r.id}: ${r.name}`, `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg p-3 bg-white/5 border border-white/10">
            <div class="text-xs text-slate-400">점수 (확률×영향)</div>
            <div class="text-2xl font-bold font-mono">${r.score} / 25</div>
          </div>
          <div class="rounded-lg p-3 bg-white/5 border border-white/10">
            <div class="text-xs text-slate-400">등급 · 카테고리</div>
            <div class="text-lg font-bold ${gradeColor}">${gradeLabel}</div>
            <div class="text-xs text-slate-500">${r.cat || ''}</div>
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-400 mb-1">대응 전략</div>
          <p class="text-sm text-slate-200 leading-relaxed">${r.strategy}</p>
        </div>
        <p class="text-xs text-slate-500">출처: 리스크 분석서 §1 매트릭스 — 확률·영향 1~5 수치 병기</p>
      </div>
    `);
  }

  // RISKS 섹션 우측 카드 버튼 → 사이드 패널
  function initRiskCards() {
    const cards = document.querySelectorAll('.risk-card[data-risk]');
    if (!cards.length) return;
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-risk');
        const r = (window.REFUI_DATA?.risks || []).find((x) => x.id === id);
        if (r) openRiskPanel(r);
      });
    });
  }

  function commonChartOpts(extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(2,6,23,0.95)',
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
        },
      },
      ...extra,
    };
  }

  function defaultTrendData() {
    const months = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
    const values = [95000000, 98500000, 103200000, 107100000, 112800000, 119400000, 128420500];
    return { labels: months, values };
  }
  function defaultAllocationData() {
    return { labels: ['Tech', 'Finance', 'Consumer', 'Energy', 'Health'], values: [52, 18, 16, 8, 6] };
  }
  function defaultSparklineData() {
    const arr = [];
    let v = 50;
    for (let i = 0; i < 24; i++) {
      v += (Math.random() - 0.4) * 8;
      arr.push(v);
    }
    return arr;
  }
  function defaultRiskData() {
    return [
      { id: 'R1', name: 'Yahoo Finance 대체 지연', impact: 3, prob: 3, score: 9, strategy: 'KIS + Finnhub 즉시 제안' },
      { id: 'R2', name: '평가 엔진 복잡도', impact: 3, prob: 3, score: 9, strategy: '로직서 열람 후 범위 재합의' },
      { id: 'R5', name: '예산 저평가', impact: 3, prob: 3, score: 7.5, strategy: '옵션 3종 협상' },
      { id: 'R10', name: '스코프 크리프', impact: 2, prob: 3, score: 6, strategy: '변경 관리 프로세스' },
      { id: 'R15', name: '경쟁 수주', impact: 3, prob: 2, score: 6, strategy: '차별화 요소 집중' },
      { id: 'R7', name: 'OpenAI 비용 폭증', impact: 2, prob: 2, score: 4, strategy: '쿼터·캐싱' },
      { id: 'R13', name: '보안 사고', impact: 3, prob: 1, score: 3, strategy: 'RLS + 2FA' },
    ];
  }

  // =========================================================
  // 4. ⌘K Command Menu
  // =========================================================
  function initCmdK() {
    const modal = document.getElementById('cmdk-modal');
    const backdrop = document.getElementById('cmdk-backdrop');
    const trigger = document.getElementById('cmdk-trigger');
    const input = document.getElementById('cmdk-input');
    const items = document.querySelectorAll('.cmdk-item');
    if (!modal || !backdrop) return;

    let selectedIdx = 0;

    function open() {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      backdrop.classList.remove('hidden');
      input?.focus();
    }
    function close() {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      backdrop.classList.add('hidden');
      if (input) input.value = '';
      filterItems('');
    }
    function filterItems(q) {
      const query = q.toLowerCase();
      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        item.style.display = query && !text.includes(query) ? 'none' : '';
      });
      const visible = Array.from(items).filter(it => it.style.display !== 'none');
      items.forEach((it, i) => it.classList.remove('bg-white/5'));
      if (visible[0]) { visible[0].classList.add('bg-white/5'); selectedIdx = 0; }
    }
    function goto(item) {
      const target = item.getAttribute('data-target');
      close();
      if (target) document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
    }

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        modal.classList.contains('hidden') ? open() : close();
      }
      if (e.key === 'Escape') close();
      if (!modal.classList.contains('hidden')) {
        const visible = Array.from(items).filter(it => it.style.display !== 'none');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIdx = Math.min(selectedIdx + 1, visible.length - 1);
          visible.forEach((it, i) => it.classList.toggle('bg-white/5', i === selectedIdx));
          visible[selectedIdx]?.scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIdx = Math.max(selectedIdx - 1, 0);
          visible.forEach((it, i) => it.classList.toggle('bg-white/5', i === selectedIdx));
          visible[selectedIdx]?.scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const visible = Array.from(items).filter(it => it.style.display !== 'none');
          if (visible[selectedIdx]) goto(visible[selectedIdx]);
        }
      }
    });

    trigger?.addEventListener('click', open);
    backdrop?.addEventListener('click', close);
    input?.addEventListener('input', (e) => filterItems(e.target.value));
    items.forEach((item) => item.addEventListener('click', () => goto(item)));
  }

  // =========================================================
  // 5. MRR Simulator
  // =========================================================
  function initMrrSim() {
    const pro = document.getElementById('mrr-pro');
    const free = document.getElementById('mrr-free');
    const proDisp = document.getElementById('mrr-pro-display');
    const freeDisp = document.getElementById('mrr-free-display');
    const result = document.getElementById('mrr-result');
    const yearly = document.getElementById('mrr-yearly');
    if (!pro || !free || !result) return;

    const PRICE = 12000;
    function update() {
      const p = +pro.value;
      const f = +free.value;
      const monthly = p * PRICE;
      if (proDisp) proDisp.textContent = p.toLocaleString();
      if (freeDisp) freeDisp.textContent = f.toLocaleString();
      result.textContent = monthly.toLocaleString();
      if (yearly) yearly.textContent = (monthly * 12).toLocaleString();
    }
    pro.addEventListener('input', update);
    free.addEventListener('input', update);
    update();
  }

  // =========================================================
  // 6. ROI Calculator
  // =========================================================
  function initRoi() {
    const trades = document.getElementById('roi-trades');
    const tradesDisp = document.getElementById('roi-trades-display');
    const hours = document.getElementById('roi-hours');
    const cost = document.getElementById('roi-cost');
    if (!trades || !hours) return;

    const HOURLY_WAGE = 50000; // 시간당 단가 추정
    function update() {
      const t = +trades.value;
      // 월 거래 × 12개월 × 20분/건 = 연간 분 절감
      const yearlyMinutes = t * 12 * 20;
      const yearlyHours = Math.round(yearlyMinutes / 60);
      if (tradesDisp) tradesDisp.textContent = `${t}회`;
      hours.textContent = yearlyHours;
      if (cost) cost.textContent = (yearlyHours * HOURLY_WAGE).toLocaleString();
    }
    trades.addEventListener('input', update);
    update();
  }

  // =========================================================
  // 7. Architecture tabs
  // =========================================================
  function initArchTabs() {
    const tabs = document.querySelectorAll('.arch-tab-trigger');
    const panels = document.querySelectorAll('.arch-tab-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        tabs.forEach((t) => {
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
          t.classList.toggle('text-slate-400', t !== tab);
          t.classList.toggle('text-cyan-400', t === tab);
        });
        panels.forEach((p) => p.classList.toggle('hidden', p.getAttribute('data-panel') !== target));
      });
    });
  }

  // =========================================================
  // 8. Floating chatbot (demo)
  // =========================================================
  function initChatbot() {
    const toggle = document.getElementById('chatbot-toggle');
    const panel = document.getElementById('chatbot-panel');
    const close = document.getElementById('chatbot-close');
    const form = document.getElementById('chatbot-form');
    const input = document.getElementById('chatbot-input');
    const msgs = document.getElementById('chatbot-messages');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => panel.classList.toggle('hidden'));
    close?.addEventListener('click', () => panel.classList.add('hidden'));

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMsg('user', text);
      input.value = '';
      // 데모 모의 응답
      setTimeout(() => {
        const ai = simulateResponse(text);
        addMsg('ai', ai);
      }, 600);
    });

    function addMsg(role, text) {
      const div = document.createElement('div');
      div.className = `rounded-xl px-3 py-2 text-sm ${role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}`;
      div.textContent = text;
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function simulateResponse(userText) {
      const lower = userText.toLowerCase();
      if (/애플|aapl/i.test(userText)) {
        return '✓ AAPL 10주 등록 예정입니다. (데모 모드 · 실제 연동은 미팅에서 시연)';
      }
      if (/삼성|005930/i.test(userText)) {
        return '✓ 삼성전자(005930) 50주 등록 예정입니다. (데모 모드)';
      }
      if (/엔비디아|nvda/i.test(userText)) {
        return '✓ NVDA 3주 등록 예정입니다. Ledger Score: 87/100 (A)';
      }
      if (/얼마|비용|가격/i.test(userText)) {
        return '이 MVP는 1,500만원부터 시작 가능합니다. 옵션 T1~T3 중 선택해주세요. 자세한 내용은 30분 화상 미팅에서 안내드려요.';
      }
      if (/yahoo|야후/i.test(userText)) {
        return 'Yahoo Finance 공식 API는 2017년에 종료되었습니다. 저희는 KIS OpenAPI(한국) + Finnhub(미국) 조합을 권장드립니다.';
      }
      return '실제 OpenAI Function Calling은 미팅에서 라이브로 시연 드립니다. "애플 10주", "비용 얼마?" 등 질문해보세요.';
    }
  }

  // =========================================================
  // 9. Side panel
  // =========================================================
  function openSidePanel(title, html) {
    const panel = document.getElementById('side-panel');
    const titleEl = document.getElementById('side-panel-title');
    const body = document.getElementById('side-panel-body');
    if (!panel) return;
    if (titleEl) titleEl.textContent = title;
    if (body) body.innerHTML = html;
    panel.classList.remove('translate-x-full');
  }
  function closeSidePanel() {
    const panel = document.getElementById('side-panel');
    panel?.classList.add('translate-x-full');
  }
  window.openSidePanel = openSidePanel;
  document.getElementById('side-panel-close')?.addEventListener('click', closeSidePanel);

  // =========================================================
  // 10. Init
  // =========================================================
  function init() {
    observeCountUps();
    initChartDefaults();
    // Charts 초기화는 Chart.js 로드 후
    if (typeof Chart !== 'undefined') {
      initCharts();
    } else {
      window.addEventListener('load', initCharts);
    }
    initCmdK();
    initMrrSim();
    initRoi();
    initArchTabs();
    initChatbot();
    initRiskCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
