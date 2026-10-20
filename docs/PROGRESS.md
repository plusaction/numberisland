# PROGRESS

## 현재 상태
- M0 스캐폴딩 ✅
- M1 교육 엔진 ✅ (리뷰어 채점 대기/반영)
- M2 엔진 코어 ⏳ 진행 중

## 완료
### M0
Vite 8.3 + TS 6.0 strict + React 19.3(Compiler) + Tailwind 4.3, Biome, Vitest 5, Playwright 1.64(사전설치 Chromium), dependency-cruiser, size-limit, `pnpm check`, CLAUDE.md, 리뷰 에이전트 3종, score 스킬.
### M1
`src/domain/`: rng(xoshiro128**), curriculum 테이블(17레벨, verified 플래그), 문제 생성기(14스킬, 8형식), 오개념 선지 6태그, 힌트 4단계(시범+다른 숫자 재도전), 시각 표현 5종, BKT, FSRS 단순형, 적응 규칙(승급/강등/히스테리시스/구조 모드), 배치 놀이, 세션(중복 0, 오답 개념 재출제), 메달·코인·칭찬(44문구). `tools/score/` 채점기, `docs/CURRICULUM_VERIFY.md` 자동 생성.

## 다음 할 일
1. M2: 루프·입력·렌더러(WebGPU/WebGL2)·TSL 머티리얼·파티클·숫자 아틀라스·오디오·저장, ART_BIBLE/SOUND_LIST/ASSETS/IMAGE_REQUESTS
2. M3: 허브, 인트로/결과
3. M4: 낚시·폭탄·슬라임
4. E8(부모 리포트)은 M8 — 현재 0점

## 결정 / 막힌 점
- TS 7 대신 6.0.3 (dependency-cruiser 호환) — DECISIONS D2
- L0_1·A2는 수학적 문제 공간이 500 미만(약 430/470) — GAPS 기록
- `.claude/agents/`는 세션 재시작 후 로드됨. 이번 세션은 general-purpose 에이전트에 같은 지시문 전달. **재시작하면 전용 에이전트 사용 가능.**
- 원격 저장소 없음 → 로컬 커밋만
