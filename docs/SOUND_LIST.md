# SOUND LIST (QUALITY96 §4.5)

모든 소리는 WebAudio 합성(`src/infra/audio/`). 외부 음원 0개. 상태: ✅ 구현 / ⏳ 예정.

## 믹싱 규칙
- 마스터: 컴프레서 리미터(threshold −6 dB, ratio 20) → 클리핑 0. 레시피 단일 피크 게인 ≤ 0.9(테스트).
- 상대 음량: UI 0.2–0.25 < 정답 0.3 ≈ 시그니처 0.3 < BGM 버스 0.35×설정.
- 문제 풀이 중 BGM 덕킹 45%. 같은 효과음 반복 시 ±3% 랜덤 디튠.
- 버스: BGM / 효과음 / 음성 개별 볼륨(부모 설정).

## BGM (절차적, 시드 변주)
| ID | 용도 | 템포 | 음계 | 상태 |
|---|---|---|---|---|
| island | 허브 | 96 | 장5음 | ✅ |
| fishing | ③ 낚시 | 78 | 장5음 | ✅ |
| bomb | ① 폭탄 | 112 | 믹솔리디안 | ✅ |
| slime | ④ 슬라임 | 100 | 리디안 | ✅ |
| zombie / escape / pizza / cards / race | ②⑤⑥⑦⑧ | 각각 | | ✅ 프리셋(스테이지는 M5–M6) |
| result | 결과 화면 | 108 | 장음계 | ✅ |

## 효과음
| ID | 의미 | 상태 |
|---|---|---|
| ui.tap / ui.back | 버튼 | ✅ |
| correct / correct.big | 정답 / 연속·큰 정답 | ✅ |
| wrong.duck / wrong.boing / wrong.pfft | 웃긴 실패음(고무오리·뿅·뿡) | ✅ |
| slime.squish / slime.grab | 슬라임 합체 철퍽·뽀글, 집을 때 쫀득한 소리 | ✅ |
| boom | 폭탄 만화 폭발(부드러운 쿵 + 펑 + 미끄러지는 웃음소리) | ✅ |
| pizza.toss | ⑥ 반죽 휙 던지기(바람 + 오르는 소리) | ✅ |
| pizza.ding | ⑥ 오븐 종 띵 | ✅ |
| pizza.box | ⑥ 피자 상자 닫힘 퉁 | ✅ |
| pizza.five | ⑥ 하이파이브 짝 + 신나는 소리 | ✅ |
| pizza.puff | ⑥ 오답: 오븐이 연기를 뿡 | ✅ |
| zombie.pop | ② 풍선 펑 + 기쁜 소리 | ✅ |
| zombie.moan | ② 졸린 "우어~"(무섭지 않게) | ✅ |
| zombie.knock | ② 문 쿵 | ✅ |
| zombie.nope | ② 못 쓰는 카드: 낮은 뿅뿅 | ✅ |
| race.go | ⑧ 출발 신호 삑 삑 삑 삐— | ✅ |
| race.boost | ⑧ 정답 부스터: 엔진 올라가는 소리 + 바람 | ✅ |
| race.turbo | ⑧ 3연속 터보: 더 길고 높은 가속 + 반짝 | ✅ |
| race.slip | ⑧ 오답: 바나나에 미끄덩 + 콩 | ✅ |
| coin / star | 보상 | ✅ |
| splash / reel | ③ 시그니처: 물방울·줄 감기 | ✅ |
| reel.crank | ③ 릴 손잡이 한 바퀴: 점점 느려지는 래칫 딸깍 + 낮은 윙 소리 | ✅ |
| snip / gift / fuse | ① 시그니처: 선 자르기·선물 변신·퓨즈 | ✅ |
| merge / pop / slime.split | ④ 시그니처: 합체·톡·뺄셈 분리 | ✅ |
| firework | 6+7=13 숨은 폭죽 | ✅ |
| levelup | 새 코스 세리머니 | ✅ |
| whoosh | 화면 전환 | ✅ |

## 괴물 음성
AudioWorklet `voice-processor`(public/voice-worklet.js): 피치·비브라토·음절 수 파라미터, 괴물별 값은 M7 도감 데이터. 미지원 시 오실레이터 대체. ✅
