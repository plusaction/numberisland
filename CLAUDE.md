# 숫자섬 탐험대 3D — 작업 규칙

초등 1-2 ~ 2-2 덧셈·뺄셈을 3D 장난감 섬 허브 + 8개 스테이지로 익히는 오프라인 웹게임(PWA).
전체 사양: `docs/SPEC.md`, 품질 루브릭: `docs/QUALITY96.md` (충돌 시 QUALITY96 우선).
**큰 문서는 통째로 읽지 말고 필요한 § 만 grep/부분 읽기.** 진행 상황은 `docs/PROGRESS.md` 먼저.

## 불변 원칙 (위반 = 실패)
- P1 네트워크 0: fetch/XHR/WebSocket/외부 CDN·폰트 금지. `tools/check-offline.mjs`가 빌드 검사.
- P2 벌칙 없음: 코인·도감·트로피 절대 감소 X. 오답 = 웃긴 연출 + 학습 피드백 + 무한 재도전.
- P3 오리지널: 실존 IP 모방 X. 3D는 프로시저럴, 소리는 WebAudio 합성.
- P4 글 최소: 한 줄 12자 권장, 모든 문자열은 `src/i18n/ko.ts`.
- P5 판정은 결정론 순수 규칙(`rules.ts`), 물리는 장식만.
- P6 시드 RNG(xoshiro128**) + 고정 60Hz → 리플레이 재현.
- P7 IndexedDB만, 별명 외 개인정보 X.
- P8 60fps 목표/30fps 하한, 품질 티어 자동.
- P9 키보드·마우스·터치·패드 전 기능, 색+모양 이중 인코딩, 모션 감소.
- P10 언제든 다시 하기/나가기.
- 기대감 윤리: 확률 뽑기·FOMO·사라지는 보상·카운트다운 압박 금지.

## 명령어 (pnpm만 사용)
| 명령 | 내용 |
|---|---|
| `pnpm dev` | 개발 서버 (`?renderer=webgl` WebGL2 강제, `?debug=1` HUD, `?tune=1` 튜닝) |
| `pnpm build` / `pnpm preview` | 프로덕션 빌드 / 4173 포트 미리보기 |
| `pnpm check` | typecheck + biome + dep-cruiser + vitest + build + check-offline |
| `pnpm check:score` | 루브릭 합계·증거 파일 검사, `docs/SCORECARD.md` 자동 섹션 갱신 |
| `pnpm test:e2e` | Playwright (Chromium `/opt/pw-browsers/chromium`, `playwright install` 금지) |
| `pnpm bench` | 사용자 기기용 성능 측정 → JSON (`docs/HUMAN_INPUT.md`에 붙여넣기) |
| `pnpm curriculum:verify` | `docs/CURRICULUM_VERIFY.md` 재생성 |

## 폴더
```
src/domain/        순수 TS (edu, curriculum, rng, scoring, progression) — 외부 import 금지
src/application/   stores(zustand vanilla), usecases, events — domain만 import
src/infra/         render, audio, tts, input, storage, platform
src/engine/        loop, ecs, tsl, particles, numbers, quality, fx
src/stages/<id>/   index.ts rules.ts config.ts scene.ts — 스테이지끼리 import 금지(_shared는 허용)
src/scenes/        island(허브), stage-intro, stage-result …
src/ui/            React 컴포넌트, HUD, 힌트, 오버레이
src/i18n/ko.ts     모든 사용자 문자열
tests/{unit,property,replay,e2e}/   tools/   docs/
```

## 레이어 경계 (dependency-cruiser가 강제)
domain ← application ← infra/engine ← presentation(ui, scenes, stages, app). 역방향 금지.
domain/application은 three/react/DOM import 금지.

## 코딩 규칙
- TS strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + verbatimModuleSyntax, `any` 금지.
- 스테이지 판정 로직은 `rules.ts`의 순수 함수 + `solve()` 교차검증 + 리플레이 테스트 필수.
- three.js는 `three/webgpu` + `three/tsl`. API는 `node_modules/three` 소스/예제로 확인 후 사용.
- 수치(보상·가격·임계)는 `src/domain/balance.ts`에만.
- 의존성 추가 시 `npm view <pkg> version`으로 안정판 확인 후 exact 고정.

## 품질 게이트 (마일스톤마다)
1. `pnpm check` 통과 2. `pnpm check:score` 3. 채점은 `adversarial-reviewer`에게 맡김(자기 점수 확정 금지)
4. 최저 3개 개선 5. `docs/PROGRESS.md` 갱신 6. 커밋.
증거 없는 점수 = 0. HUMAN 항목은 직접 채점 금지.

## 리뷰 에이전트 (`.claude/agents/`)
adversarial-reviewer · art-reviewer · curriculum-checker. 로드 안 됐으면 같은 본문을 general-purpose에 전달.

## 보고
사용자 보고는 한국어로 짧게: 무엇이 됐고 / 점수 변화 / 사람이 할 일.
작업 끝 보고에는 **항상 사이트 링크** https://numberisland.vercel.app 를 넣는다(main 푸시 → Vercel 자동 배포, 1~2분 뒤 Ctrl+Shift+R).
