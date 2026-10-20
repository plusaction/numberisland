---
name: score
description: 루브릭 점수 검사 실행 후 docs/SCORECARD.md 갱신 (수동 호출 전용)
disable-model-invocation: true
---
1. `pnpm check:score`를 실행한다(자동 항목 재측정, 증거 파일 존재 확인, 루브릭 합 100 검증).
2. 출력과 `reports/score.json`을 읽고 `docs/SCORECARD.md`의 자동 섹션이 갱신됐는지 확인한다.
3. `adversarial-reviewer` 에이전트에게 SCORECARD 검토를 맡기고, 깎인 점수와 이유를 `docs/SCORECARD.md`의 "리뷰어 판정" 섹션과 `DECISIONS.md`에 기록한다.
4. 최저 점수 3개 항목을 `docs/PROGRESS.md`의 "다음 할 일" 맨 위에 적는다.
