# 숫자섬 탐험대 3D

초등 1학년 2학기 ~ 2학년 2학기 **덧셈·뺄셈**을 3D 장난감 섬에서 놀이로 익히는 오프라인 웹게임입니다.
광고·결제·계정·외부 통신이 없습니다(모든 데이터는 이 기기의 브라우저에만 저장).

> 현재 상태: **Gold Slice** — 허브 섬 + ③ 숫자 낚시 · ① 폭탄 해체반 · ④ 슬라임 합체. 나머지 5개 지역은 "준비 중"으로 표시됩니다. 진행 상황은 `docs/PROGRESS.md`.

## 바로 실행 (빌드된 폴더가 있을 때, Windows)
1. [Node.js LTS](https://nodejs.org) 설치(한 번만).
2. `dist` 폴더의 **`start.bat`** 더블클릭 → 브라우저가 `http://localhost:4173`을 엽니다.
   (`index.html`을 직접 더블클릭하는 `file://` 실행은 지원하지 않습니다 — 모듈·워커 제약)

## 개발자용
```bash
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # dist/ 생성 (start.bat, serve.mjs 포함)
pnpm preview        # http://localhost:4173 (빌드 결과 미리보기)
pnpm check          # 타입·린트·레이어 경계·단위/속성/리플레이 테스트·빌드·오프라인 검사
pnpm test:e2e       # Playwright (WebGPU / WebGL2 두 프로젝트)
pnpm check:score    # 품질 루브릭 점수표 → docs/SCORECARD.md
pnpm bench          # 실제 GPU 기기에서 프레임 타임 측정(JSON) → docs/HUMAN_INPUT.md
```
URL 옵션: `?renderer=webgl`(WebGL2 강제), `?debug=1`(백엔드·티어·프레임 HUD), `?tier=low|balanced|high|ultra`, `?demo=engine`(엔진 데모).

## 그래픽 측정
`pnpm shots` — 장면별 스크린샷과 드로우콜·삼각형·메모리·프레임 시간을 `docs/review/gfx/`에 기록(소프트웨어 렌더라 프레임 시간은 비교용).

## 배포
정적 호스팅(Cloudflare Pages / Netlify / GitHub Pages 등)에 `dist/`를 그대로 올리면 됩니다. `dist/_headers`에 보안 헤더(CSP 등)가 들어 있습니다.

### Vercel
1. 이 저장소를 GitHub에 올립니다.
2. vercel.com → **Add New → Project** → 저장소 **Import** → **Deploy**. 설정은 `vercel.json`이 정합니다(Vite, `pnpm build`, `dist/`, 보안 헤더·캐시). 따로 바꿀 것이 없습니다.
3. 이후 `main`에 푸시할 때마다 자동으로 다시 배포됩니다.

Vercel Analytics·Speed Insights는 켜지 마세요(아이 안전 P1: 원격 분석 금지, CSP가 막습니다). 미리보기 배포의 Vercel 툴바는 프로젝트 설정에서 끄는 것을 권장합니다.

## 조작
| 동작 | 마우스·터치 | 키보드 | 게임패드 |
|---|---|---|---|
| 지역 고르기(섬) | 포털 탭(한 번 더 탭 = 입장) | ← → , Enter/Space(출발) | 십자키, A |
| 낚시·폭탄 고르기 | 물고기/선 탭 | ← → 로 이동, Enter | 십자키, A |
| 슬라임 합체 | 슬라임을 끌어서 다른 슬라임 위에 놓기 | Enter로 집기 → ← → → Enter로 놓기 | 십자키, A |
| 힌트 | 💡 버튼 | H | X |
| 되돌리기(슬라임) | ↩ 버튼 | Backspace | Y |
| 나가기 | ✕ 버튼 | (화면의 나가기 버튼) | — |
2인용 키맵(M6): 프리셋 B 기본 — P1 `W A S D + J/K`, P2 방향키 + 키패드 `0`/`.`(NumLock 켜기).

## 문제 해결
- **화면이 하얗거나 느려요**: `?renderer=webgl`을 붙여 보세요. 그래픽 장치가 멈추면 게임이 자동으로 WebGL2로 다시 그립니다.
- **소리가 안 나요**: 화면을 한 번 누르면 소리가 켜집니다(브라우저 정책).
- **🔊 읽어주기 버튼이 없어요**: 기기에 한국어 *오프라인* 음성이 없으면 숨겨집니다(외부 서버 음성은 개인정보 보호를 위해 쓰지 않음).
- **"저장이 안 될 수 있어요"**: 시크릿 창 등 IndexedDB가 막힌 환경입니다.

## 문서
`docs/SPEC.md`(사양) · `docs/QUALITY96.md`(품질 기준) · `docs/SCORECARD.md`(점수) · `docs/PLAYTEST.md`(아이 관찰 방법) · `docs/HUMAN_INPUT.md`(사람 입력) · `docs/CURRICULUM_VERIFY.md`(교과 대조) · `DECISIONS.md` · `docs/GAPS.md`
