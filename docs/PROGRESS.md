# PROGRESS

## 현재 상태
- M0 스캐폴딩 ✅
- M1 교육 엔진 ✅ (리뷰어 판정 반영: E 75→55 주장 삭감, 지적 결함 수정 후 재채점 예정)
- M2 엔진 코어 ✅ (WebGL2 실기 검증, WebGPU는 환경 한계로 자동 폴백 검증만)
- M3 허브·인트로·결과·배치 놀이 ✅
- M4 Gold Slice ③낚시 ①폭탄 ④슬라임 ✅ (리뷰어 채점 진행)

## 완료
### M0
Vite 8.3 + TS 6.0 strict + React 19.3(Compiler) + Tailwind 4.3, Biome, Vitest 5, Playwright 1.64(사전설치 Chromium), dependency-cruiser, size-limit, `pnpm check`, CLAUDE.md, 리뷰 에이전트 3종, score 스킬.
### M1
`src/domain/`: rng(xoshiro128**), curriculum 테이블(17레벨, verified 플래그), 문제 생성기(14스킬, 8형식), 오개념 선지 6태그, 힌트 4단계(시범+다른 숫자 재도전), 시각 표현 5종, BKT, FSRS 단순형, 적응 규칙(승급/강등/히스테리시스/구조 모드), 배치 놀이, 세션(중복 0, 오답 개념 재출제), 메달·코인·칭찬(44문구). `tools/score/` 채점기, `docs/CURRICULUM_VERIFY.md` 자동 생성.

### M2
고정 60Hz 루프, 입력 액션맵(키맵 A/B, 게임패드), RenderWorld(WebGPU→WebGL2 폴백, 장치 손실 시 새 canvas로 복구), 품질 티어 거버너, TSL 머티리얼(클레이·젤리·물·외곽선), 포스트(블룸·비네트), GPU(compute)/CPU 파티클, 숫자 아틀라스+자릿값 색·모양, WebAudio(리미터·버스·워클릿 음성·절차적 BGM·덕킹), TTS, IndexedDB 저장(Valibot·마이그레이션·복구·gzip 내보내기), 문서 ART_BIBLE/SOUND_LIST/ASSETS/IMAGE_REQUESTS(95장), ingest/bench/autoplayer 뼈대. 데모: `?demo=engine&debug=1`.

### M3
3D 숫자섬 허브(8포털·3구역·성장 나무·건물·돌리 카메라), 정보 카드(스킬 태그·1P/2P·별·최고 기록·오늘의 추천·난이도 3단계·랜덤 모험·확정 보상), 다음 랭크 진행 막대, 결과 화면 3요소(별 순차→새로 해낸 것→다음 목표), 배치 놀이(괴물 친구 만나기), IndexedDB 저장·새로고침 유지.
### M4
공통 라운드 엔진(적응형 문제 선택·기록·힌트·코인), 스테이지 3종 순수 규칙+풀이기(solve/BFS)+봇(정확도 60/80/95, 전략 A/B)+리플레이, 3D 장면(시그니처 순간·웃긴 실패·연속 정답 연출 상승·6+7 폭죽), HUD(나가기 상시·진행 점·힌트·되돌리기), 4단계 힌트(SVG 표현 5종·전략·세로셈·시범), 오개념 피드백, 무언 튜토리얼(유령 손). e2e 16개(두 프로젝트) 통과.
재리뷰 N1~N8 수정 + 적응 엔진 강등 버그(계속 틀려도 리뷰/도전 문제만 나와 강등 안 됨) 수정 — DECISIONS D13.

### 그래픽 상향 (D15·D16)
초1 범위 고정. 실사 PBR 재질·환경 반사·물결 물·접촉 그림자·화면 반사(티어별)·장식 물리(동전 비·사탕·조약돌·물방울), 첫 화면/배치 놀이에 3D 섬 + 괴물 친구. 드로우콜 약 절반, 메모리 누수 제거. 측정: `docs/review/gfx/README.md`, `pnpm shots`.

## 다음 할 일
1. 남은 약점: G3 의미 있는 선택, F3 증거, 결과 화면 아이콘, 허브 태그 용어, 터치·패드 e2e, domain 커버리지 ≥90%
1. **사람 플레이테스트 1회** (docs/PLAYTEST.md) 후 M5 진행
2. M5: ② 좀비, ⑤ 방탈출 (같은 템플릿: rules.ts + solver + bot + scene + module)
3. M6: ⑦ 카드 배틀, ⑧ 레이스, ⑥ 피자 (2P 키맵 A/B, 게임패드, 터치 분할)
4. M7 메타, M8 부모 영역(E8 리포트), M9 폴리시·접근성(axe), M10 PWA·감사·README·start.bat
5. E8(부모 리포트)은 M8 — 현재 0점

## 결정 / 막힌 점
- TS 7 대신 6.0.3 (dependency-cruiser 호환) — DECISIONS D2
- L0_1·A2는 수학적 문제 공간이 500 미만(약 430/470) — GAPS 기록
- `.claude/agents/`는 세션 재시작 후 로드됨. 이번 세션은 general-purpose 에이전트에 같은 지시문 전달. **재시작하면 전용 에이전트 사용 가능.**
- 원격 저장소 없음 → 로컬 커밋만
