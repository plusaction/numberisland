# ART BIBLE — 숫자섬 탐험대 (QUALITY96 §4.3)

모든 시각 작업과 `art-reviewer` 리뷰의 기준 문서. 코드 상수는 `src/engine/palette.ts`가 단일 출처.

## 1. 한 줄 콘셉트
**책상 위 장난감 디오라마.** 말랑한 클레이·젤리, 파스텔, 부드러운 그림자, 굵고 둥근 숫자. 무섭거나 날카로운 것은 없다.

## 2. 팔레트
| 역할 | 이름 | HEX | 용도 |
|---|---|---|---|
| 주색 | sand | `#ffe3b3` | 섬 바닥, 따뜻한 배경 |
| 주색 | sea | `#6fd0e3` | 물, 차가운 강조 |
| 주색 | leaf | `#8bd48f` | 풀, 성공 |
| 주색 | berry | `#ff8fab` | 캐릭터 포인트, 슬라임 |
| 주색 | sun | `#ffd166` | 코인·별·보상 |
| 보조 | lavender `#b9a6f2` · peach `#ffb38a` · mint `#a8ebd8` · sky `#bfe6ff` · cocoa `#8a6a5c` | | 소품 다양성 |
| 선 | ink | `#3b3355` | 외곽선, 숫자 테두리, 글자 |
| 바탕 | cream | `#fff8ec` | UI 카드 |

**자릿값 색(전역 규칙, SPEC §7.3)** — 색 + 모양 이중 인코딩
| 자리 | 색 | 모양 |
|---|---|---|
| 일 | 초록 `#22a654` | ● 점 |
| 십 | 파랑 `#2f6fe8` | ▬ 막대 |
| 백 | 보라 `#8a46dc` | ★ 별 |
| 천 | 금색 `#d99a00` | ◆ 마름모 |

**금지색**: 순수 빨강 `#ff0000`(경고·피 연상), 형광 원색, 순흑 `#000`(대신 ink), 회색조 화면 전체(우울).

## 3. 형태 언어
- 최소 라운드 반경 = 짧은 변의 **25%** (`roundedBox` 기본값). 날카로운 모서리 금지.
- 외곽선(inverted hull) 두께: 소품 0.03, 캐릭터 0.035–0.045 월드 단위, 색 ink.
- 비율: 머리 큰 2~2.5등신, 눈은 크고 간격 넓게. 괴물은 **20종이 서로 다른 큰 실루엣**(구·원통·물방울·별·삼각·도넛·버섯…)을 가진다.
- 노이즈 변위(blob)는 진폭 ≤ 반지름의 20%, 항상 부드러운 법선(mergeVertices).

## 4. 라이팅 프리셋 (3종)
| 프리셋 | 하늘(위→아래) | 키라이트 | 필(반구광) | 용도 |
|---|---|---|---|---|
| day | `#9fd8ff` → `#fff1d6` | `#fff4e0` 2.4, (6,12,7) | `#dff3ff`/`#f2d9b8` 1.5 | 기본 |
| sunset | `#ffb8a8` → `#ffe9b8` | `#ffd2a8` 2.0 | `#ffe0d0`/`#e8c7a8` 1.4 | 저녁 테마 |
| night | `#4b4f8f` → `#b9a6f2` | `#cfd8ff` 1.2 | `#a8b4ff`/`#6a5a8a` 1.0 | 밤 테마(어둡지 않게) |
그림자: PCF + radius 4(soft)/1(basic). 톤매핑: ACES, 노출 0.95(D9).

## 5. 카메라 규칙
- 스테이지: 고정 디오라마, 하이앵글 35–45°, FOV 35–42, 살짝 패럴랙스(마우스/기울기 ±1.5°).
- 허브: 느린 오빗(주기 ≥ 60초), 포털 선택 시 돌리 0.6–0.9초 ease-in-out.
- 셰이크: 진폭 ≤ 0.05 단위, 모션 감소 설정 시 0.

## 6. 타이포 스케일
| 용도 | 폰트 | 크기(1080p 기준) |
|---|---|---|
| 3D 숫자(문제) | Fredoka 700 (아틀라스) | 화면 높이의 8–12% |
| 3D 숫자(보조) | 같음 | 5–7% |
| UI 제목 | Pretendard 800 | 40–56px |
| UI 버튼 | Pretendard 700 | 28–36px |
| 본문(부모 영역만) | Pretendard 500 | 18–20px |
숫자는 흰 채움 + ink 외곽선(22px @120px 글리프). 한 줄 문장 ≤ 12자(P4).

## 7. 모션 곡선
- 스쿼시/스트레치: `Spring(stiffness 180–220, damping 9–14)`, 부피 보존(`squashScale`).
- 정답 팝: 스케일 1 → 1.25 → 1 (스프링), 0.25초.
- 히트스톱 30–60ms. 시그니처 순간 슬로모션 0.3초(시간 배율 0.25).
- 번쩍임: 초당 3회 이하(`FlashGuard`), 화면 전체 플래시 금지.

## 8. UI 컴포넌트 상태 규칙
모든 버튼: 기본 / 호버(밝기 +6%, 1px 위로) / 프레스(스케일 0.94) / 포커스(두께 4px ink 링 + 2px 흰 간격) / 비활성(채도 40%, "안 돼요" 흔들림). 최소 64×64px, 대비 ≥ 4.5:1.

## 9. 괴물 실루엣 설계 규칙
- 20종 기본 몸통 = 서로 다른 기본 도형(겹치지 않게 표에 배정, M7).
- 진화 2단계: 부속물 추가(뿔·귀·모자), 3단계: 크기 +25% + 고유 이펙트.
- 흑백 실루엣으로 서로 구별될 것(F2 자동 테스트).

## 10. 이미지 생성 규칙 (QUALITY96 §4.2)
**스타일 프롬프트 접두어(모든 생성에 동일하게):**
> `cute toy diorama style, soft clay and jelly materials, pastel colors (sand #ffe3b3, sea #6fd0e3, leaf #8bd48f, berry #ff8fab, sun #ffd166), thick rounded shapes, soft studio lighting, gentle shadows, dark purple outline (#3b3355), friendly and not scary, for children age 6-7, original character design,`

**금지 요소(모든 프롬프트 끝에 붙임):** `no text, no letters, no numbers, no watermark, no signature, no logo, no UI, no existing characters or brands, no weapons, no blood, no horror, no realistic humans`

**해상도/용량 표준**
| 종류 | 해상도 | 형식 | 1장 예산 |
|---|---|---|---|
| 아이콘(키링·아이템·배지·오브젝트·포털) | 512×512, 투명 | WebP | ≤ 40 KB |
| 스프라이트·도감 카드·표정 | 1024×1024, 투명 | WebP | ≤ 120 KB |
| 배경·하늘·텍스처 | 2048×1024 | AVIF/WebP | ≤ 300 KB |
전체 이미지 예산 ≤ 25 MB(PWA 프리캐시).
