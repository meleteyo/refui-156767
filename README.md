# 레퍼런스 UI — 위시켓 #156767 콘텐츠/마케팅 대행사 맞춤형 통합 ERP 구축

위시켓 프로젝트 **#156767 「콘텐츠/마케팅 대행사 맞춤형 통합 ERP 구축」** (예산 6,000만원 · 기간 120일 · 실행계획 17주) 제안서에 첨부하는 정적 레퍼런스 UI입니다.

## 목적

- 위시켓 지원서/제안서에 URL 한 줄로 첨부하여, 텍스트 제안서만으로 전달하기 어려운 분석 깊이(환불 승인 7연쇄 처리, 정산 엔진, 리스크 17건, 17주 타임라인)를 시각적으로 보여줍니다.
- 읽는 사람에 따라 두 벌을 제공합니다: **IT 담당자용**(아키텍처·ADR·기술 근거)과 **비IT 일반 고객용**(동작·효과·ROI 중심).
- Hero의 "라이브 데모" 버튼으로 형제 트랙인 클릭 가능한 프로토타입(`../proto/`)과 자동 시연(`../demo/`)에 연결됩니다.

## 페이지 구성 (3페이지)

| 파일 | 대상 | 내용 |
|---|---|---|
| `index.html` | 공용 랜딩 | 방문자 유형 선택 2카드 (IT / 일반). 모바일에서는 세로 스택 |
| `it.html` | IT 전문가·개발 담당자 | 환불 승인 7연쇄 설계, 정산 엔진, 아키텍처 다이어그램, ADR 8건, 리스크 R1~R17, 17주 실행계획, 기술 Q&A |
| `nonit.html` | 비IT 일반 고객 | "이렇게 동작합니다" 흐름도 1개, 업무 시간·비용 절감 효과, ROI 계산기, 불안 해소 FAQ |

지원 파일: `styles.css`(공통 스타일), `client.js`(차트·카운트업·인터랙션), `data.json`(페이지 데이터).

## 로컬 실행

CDN(Tailwind/Chart.js/Pretendard)을 사용하므로 인터넷 연결이 필요합니다. `file://`로 열어도 대체로 동작하지만, 로컬 서버 실행을 권장합니다.

```bash
cd "/Users/luna/my/output/project-analysis/156767-마케팅대행사통합ERP/refui"
python3 -m http.server 8000
# http://localhost:8000 접속 → index.html
```

프로토타입·자동시연까지 함께 확인하려면 상위 디렉토리에서 서버를 띄우세요.

```bash
cd "/Users/luna/my/output/project-analysis/156767-마케팅대행사통합ERP"
python3 -m http.server 8000
# http://localhost:8000/refui/ · /proto/ · /demo/자동시연.html · /pt/
```

## 재배포

wishket-refui 스킬의 배포 스크립트를 사용합니다. `<target>`은 `refui/`·`proto/`·`demo/`·`pt/`를 담고 있는 **부모 디렉토리**입니다.

```bash
# dry-run으로 먼저 확인
~/.claude/skills/wishket-refui/scripts/deploy.sh 156767 \
  "/Users/luna/my/output/project-analysis/156767-마케팅대행사통합ERP" --dry-run

# GitHub Pages 배포 (repo: refui-156767)
~/.claude/skills/wishket-refui/scripts/deploy.sh 156767 \
  "/Users/luna/my/output/project-analysis/156767-마케팅대행사통합ERP" --github
```

배포 URL: https://meleteyo.github.io/refui-156767/ (+ `/it.html`, `/nonit.html`, `/proto/`, `/demo/자동시연.html`, `/pt/`)

## 데이터 출처

모든 수치·문구는 상위 디렉토리의 project-analysis 산출물에서 매핑했습니다. 임의 창작 금지.

- `1_요구사항검토서.md` — 기능 범위, 환불 승인 7연쇄 처리
- `2_발주자질의서_IT.md` / `2_발주자질의서_비IT.md` — QUESTIONS 섹션
- `3_실행계획.md` — 17주 타임라인, Phase 구성
- `6_리스크분석.md` — RISKS 섹션 (R1~R17)
- `5_제안서_*.md`, `7_미팅준비자료_*.md`, `8_포트폴리오_*.md` — WHY-US, 포트폴리오 카드
- 매핑 상세(provenance)는 `../9_레퍼런스UI.md` 참조

인물·금액은 모두 가명/데모 수치이며, 공고에 없는 메타데이터(지원자 수 등)는 "비공개"로 표기하거나 생략했습니다.

## 수정 시 주의

- HTML을 직접 고치기보다 **원본 분석 MD를 수정한 뒤 wishket-refui 스킬을 재실행**하는 것을 권장합니다. HTML만 고치면 다음 스킬 실행 시 덮어써지고, 원본 MD·프로토타입·PT와 수치가 어긋납니다.
- 부득이 HTML을 직접 수정할 때:
  - Pretendard CDN은 반드시 `npm/pretendard` 경로 사용 (`gh/orioncactus/pretendard`는 폐기됨)
  - Hero의 `../proto/index.html`, `../demo/자동시연.html` 상대경로는 deploy.sh가 배포 구조에 맞게 보정하므로 형식을 바꾸지 말 것
  - 상태값 ENUM은 대문자 영문 유지(표시만 한글), 실명·실금액 삽입 금지
- 수정 후에는 `python3 -m http.server`로 3페이지 렌더·링크·모바일 세로 스택을 확인한 뒤 재배포하세요.
