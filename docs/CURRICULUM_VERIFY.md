# CURRICULUM_VERIFY — 교과 정렬 확인표

> 자동 생성: `pnpm curriculum:verify` (원본: `src/domain/curriculum/curriculum.ts`). 직접 수정하지 마세요.
> **부모/교사 확인 방법**: 아이 교과서(출판사·개정 연도)의 차례와 아래 "학기·내용"을 대조하고, 맨 아래 서명란에 결과를 적어 주세요(QUALITY96 E2b).

| 레벨 | 밴드 | 학기 | 내용 | 스킬 | 수 범위 | 받아올림 | 표현 | 확인 상태 | 근거·메모 | 생성 예시 |
|---|---|---|---|---|---|---|---|---|---|---|
| L0_1 | 0 | 1-1 | 9 이내 덧셈·뺄셈, 가르기·모으기 | COMPOSE_10, ADD_NOCARRY, SUB_NOBORROW, MISSING_TERM, COMPARE_EXPR | ≤9 | none | dots, tenframe, numberline | ✅ confirmed | 1-1 덧셈과 뺄셈 단원: 합이 9 이하, 한 자리 수 뺄셈, 가르기·모으기 | 5 + 3 = 8<br>3 + 2 = 5<br>8 − 1 = 7<br>□ + 0 = 8 → □=8<br>6+1 vs 4 → 7 |
| A1 | A | 1-2 | 100까지의 수: 자릿값·뛰어 세기·크기 비교 | PLACE_VALUE, SKIP_COUNT, COMPARE_EXPR | ≤100 | none | blocks, numberline, tenframe | ✅ confirmed | 1-2 "100까지의 수" 단원(십·일, 뛰어 세기, 크기 비교) | 50 + 4 = 54<br>70, 60, 50, □, 30 → 40<br>86 vs 26 → 86 |
| A2 | A | 1-2 | 20 이내 받아올림 덧셈·받아내림 뺄셈 (10 만들기) | ADD_CARRY, SUB_BORROW, COMPOSE_10, MISSING_TERM | ≤20 | always | tenframe, dots, numberline | 🟡 partial | 1-2 "덧셈과 뺄셈(2)/(3)": 10 만들기, (몇)+(몇)=(십몇), (십몇)-(몇)=(몇). 출판사별 배열 확인 필요 | 7 + 5 = 12<br>14 − 9 = 5<br>6 + 7 + 4 = 17<br>□ − 8 = 5 → □=13 |
| A3 | A | 1-2 | (두 자리) ± (한 자리) | ADD_NOCARRY, ADD_CARRY, SUB_NOBORROW, SUB_BORROW | ≤99 | some | blocks, numberline, column | 🟡 partial | 1-2 두 자리 수 덧셈·뺄셈. 받아올림 포함 여부는 출판사별 확인 필요 | 92 + 2 = 94<br>66 + 9 = 75<br>29 − 1 = 28<br>53 − 8 = 45 |
| A4 | A | 1-2 | (두 자리) ± (두 자리), 받아올림·내림 없음 | ADD_NOCARRY, SUB_NOBORROW, MISSING_TERM, ESTIMATE_CLOSE | ≤99 | none | blocks, column, numberline | 🟡 partial | 1-2 "덧셈과 뺄셈(1)": (몇십몇)±(몇십몇) 받아올림 없음 | 24 + 52 = 76<br>96 − 73 = 23<br>16 + □ = 38 → □=22<br>19+40 vs 42+31 (목표 56) → 59 |
| A5 | A | 1-2 | (두 자리) ± (두 자리), 받아올림·내림 있음, 세로셈 | ADD_CARRY, SUB_BORROW | ≤99 | always | column, blocks | 🟡 partial | 일부 자료에서 1-2 포함, 다른 판에서는 2-1 "덧셈과 뺄셈" 단원. 교과서 대조 필요 | 14 + 67 = 81<br>97 − 88 = 9 |
| A6 | A | 1-2 | 세 수 덧셈·뺄셈, □ 채우기, 짧은 문장제 | THREE_TERM, MISSING_TERM, WORD, COMPARE_EXPR | ≤99 | some | dots, numberline, blocks | 🟡 partial | 1-2 세 수의 덧셈과 뺄셈(한 자리 수), □가 있는 식. 문장제는 교과서 활동 수준으로 가정 | 1 + 3 + 1 = 5<br>□ − 6 = 11 → □=17<br>36 − 6 = 30<br>20 vs 15+2 → 20 |
| B1 | B | 2-1 | 세 자리 수: 자릿값·크기 비교·뛰어 세기 | PLACE_VALUE, SKIP_COUNT, COMPARE_EXPR | ≤999 | none | blocks, numberline | ✅ confirmed | 2-1 "세 자리 수" 단원(백·십·일, 뛰어 세기, 크기 비교) | 932의 십의 자리 → 3<br>92, □, 94, 95, 96 → 93<br>908 vs 980 → 980 |
| B2 | B | 2-1 | (두 자리) + (두 자리), 합이 세 자리 (받아올림) | ADD_CARRY | ≤198 | always | column, blocks | 🟠 assumed | 2-1 "덧셈과 뺄셈" 단원으로 가정 | 76 + 64 = 140 |
| B3 | B | 2-1 | 받아내림 뺄셈 완성, 세 수 계산 | SUB_BORROW, THREE_TERM | ≤199 | always | column, blocks, numberline | 🟠 assumed | 2-1 "덧셈과 뺄셈" 단원(받아내림, 세 수의 계산)으로 가정 | 66 − 38 = 28<br>57 + 82 + 44 = 183 |
| B4 | B | 2-1 | 덧셈과 뺄셈의 관계, □ 구하기 | RELATION, MISSING_TERM, ESTIMATE_CLOSE | ≤199 | some | numberline, blocks | 🟡 partial | 2-1 "덧셈과 뺄셈" 단원의 관계·□ 구하기 차시 | 141 − 84 = 57<br>□ − 69 = 21 → □=90<br>42+51 vs 199-94 (목표 110) → 105 |
| B5 | B | 2-1 | 문장제, 같은 수 여러 번 더하기 | WORD, REPEATED_ADD | ≤199 | some | dots, blocks, numberline | 🟠 assumed | 2-1 "곱셈" 단원 도입(묶어 세기, 몇의 몇 배)로 가정 | 34 + 41 = 75<br>9 + 9 + 9 = 27 |
| C1 | C | 2-2 | 네 자리 수: 자릿값·뛰어 세기 | PLACE_VALUE, SKIP_COUNT, COMPARE_EXPR | ≤9999 | none | blocks, numberline | ✅ confirmed | 2-2 "네 자리 수" 단원 | 7000 + 700 + 60 + 2 = 7762<br>1300, 1400, 1500, □, 1700 → 1600<br>5947 vs 5847 → 5947 |
| C2 | C | 2-2 | 네 자리 수 범위의 몇백·몇십 덧셈·뺄셈 | ADD_NOCARRY, ADD_CARRY, SUB_NOBORROW, SUB_BORROW | ≤9999 | some | blocks, column | 🟠 assumed | 2-2 네 자리 수 뛰어 세기와 연계한 몇백 단위 계산으로 가정 | 200 + 2100 = 2300<br>6690 + 40 = 6730<br>9500 − 400 = 9100<br>9020 − 310 = 8710 |
| C3 | C | 2-2 | (세 자리) ± (두 자리), 받아올림·내림 포함 | ADD_NOCARRY, ADD_CARRY, SUB_NOBORROW, SUB_BORROW, MISSING_TERM | ≤999 | some | column, blocks, numberline | 🟠 assumed | 교과 근거 약함(3-1 단원 일부). 2-2 확장으로 가정 — 대조 필요 | 554 + 33 = 587<br>91 + 313 = 404<br>552 − 41 = 511<br>575 − 80 = 495<br>□ − 65 = 754 → □=819 |
| C4 | C | 3-1 | [선행·도전] (세 자리) ± (세 자리) | ADD_NOCARRY, ADD_CARRY, SUB_NOBORROW, SUB_BORROW | ≤1998 | some | column, blocks | ⭐ 선행(교과 초과) | 3-1 "덧셈과 뺄셈" 단원 내용(교과 초과 선행). 부모가 끌 수 있음 | 757 + 200 = 957<br>401 + 816 = 1217<br>484 − 324 = 160<br>674 − 638 = 36 |
| C5 | C | 2-2 | 혼합 세 수, 문장제, 반복 덧셈·뛰어 세기(2~9) | THREE_TERM, WORD, REPEATED_ADD, SKIP_COUNT | ≤999 | some | numberline, dots, column | 🟠 assumed | 2-2 "곱셈구구" 단원과 연계한 뛰어 세기·반복 덧셈으로 가정 | 28 + 29 + 79 = 136<br>574 + 47 = 621<br>7 + 7 + 7 + 7 = 28<br>24, 30, 36, 42, □ → 48 |

## 사람 확인 (E2b)

| 날짜 | 확인자 | 교과서(출판사/연도) | 일치하지 않는 레벨 | 메모 |
|---|---|---|---|---|
|  |  |  |  |  |
