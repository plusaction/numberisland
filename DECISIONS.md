# DECISIONS

| # | 날짜 | 결정 | 이유 |
|---|---|---|---|
| D1 | 2026-10-20 | 프로젝트 루트 `/home/user/numberisland`, 정적 SPA(Next.js 미사용) | 서버 기능 불필요(SPEC §5) |
| D2 | 2026-10-20 | **TypeScript 6.0.3** 사용 (최신 7.0.2 대신) | TS 7(Go 네이티브)은 JS 컴파일러 API가 아직 없어 dependency-cruiser가 `typescript >=2 <7`만 지원. 레이어 경계 강제(SPEC §6.1)가 더 중요. dep-cruiser가 TS7 지원하면 상향 |
| D3 | 2026-10-20 | React Compiler는 `@rolldown/plugin-babel` + `reactCompilerPreset` 경로 사용 | plugin-react 6의 Rust 컴파일러 옵션은 문서상 experimental |
| D4 | 2026-10-20 | Playwright는 사전 설치 Chromium(`/opt/pw-browsers/chromium`, SwiftShader) 사용 | 컨테이너에 GPU 없음, `playwright install` 금지. WebGPU 실기·프레임타임은 `pnpm bench`로 사용자 기기에서 측정(QUALITY96 §0-5) |
| D5 | 2026-10-20 | `check-offline`은 주석/에러메시지용 문서 링크(threejs.org, react.dev, tailwindcss.com 등)만 허용목록 | 문자열 링크는 요청을 일으키지 않음. 대신 fetch(절대URL)/XHR/WebSocket/EventSource/sendBeacon과 외부 `<script>/<link>`는 모두 실패 처리 |
| D6 | 2026-10-20 | vite-plugin-pwa 2.0.0은 Vite 8 peer 지원 확인, 도입은 M10 | M0~M4 범위 축소 |
| D7 | 2026-10-20 | 숫자·타이틀 둥근 폰트 = **Fredoka**(OFL, @fontsource 셀프호스팅), 한글 본문·제목 = Pretendard(OFL, dynamic subset 셀프호스팅) | BM 주아는 OFL이지만 특정 브랜드 정체성과 강하게 연결(P3 위험). 숫자 가독성은 Fredoka가 우수 |
| D8 | 2026-10-20 | 헤드리스 Chromium 141 + SwiftShader에서 WebGPU 어댑터는 얻지만 three r186이 **장치 손실**(“Instance reference no longer exists”) — WebGPU 실기 검증 불가. 대신 이 손실이 **자동 WebGL2 복구 경로**를 실제로 검증함(새 canvas로 교체) | GPU 없는 컨테이너 한계. 실기 WebGPU는 `pnpm bench` + HUMAN_INPUT(S3 GPU 부분) |
| D9 | 2026-10-20 | 톤매핑 **ACESFilmic**(노출 0.95) 채택, AgX는 `?tm=agx`로 비교 가능 | 같은 장면 비교(`docs/review/m2/tonemap-*.png`): AgX는 파스텔이 탁해지고 채도가 낮음, 아이용 장난감 룩에는 ACES가 선명 |
| D10 | 2026-10-20 | 그림자 = **PCFShadowMap + shadow.radius**(three r18x에서 PCFSoftShadowMap 제거) | WebGPURenderer 경고로 확인. VSM은 WebGL2 폴백 비용·아티팩트로 제외 |
| D11 | 2026-10-20 | three r186의 `swizzle:'rgba'` 텍스처 뷰 기본값을 거부하는 구형 Chrome용 호환 shim(`infra/render/webgpu-compat.ts`) | Chrome 141에서 매 프레임 TypeError 확인. 기본 swizzle 제거는 무손실 |
| D12 | 2026-10-20 | `check-offline`은 `//` 주석 줄 안의 링크(셰이더 출처 표기)를 무시하고 개수만 보고 | 요청을 만들지 않는 텍스트. fetch/XHR/WebSocket/외부 script·link·CSS url()은 계속 실패 처리 |
| D13 | 2026-10-21 | 첫 시도 오답이 **현재 레벨 이하의 리뷰 문제**에서 나와도 강등 증거로 계산, 연속 오답 중에는 도전(+1) 문제를 내지 않음 | 계속 틀리는 아이에게 리뷰·도전만 뽑혀 'current' 오답이 쌓이지 않아 강등이 일어나지 않던 결함(테스트 `[E5] 쉽게(−1)에서 계속 틀리면 강등`) |
| D14 | 2026-10-21 | 웹 호스팅 = **Vercel 정적 배포**(GitHub 연동). 헤더 원본은 `vercel.json`(=`public/_headers`와 동일 값, 다른 정적 호스트용으로 유지), `/assets/*` 1년 immutable, `index.html` no-cache, `packageManager: pnpm@10.28.0` 고정 | 사용자 요청. 분석·툴바 등 Vercel 부가 기능은 P1 위반이라 사용 안 함 |
| D15 | 2026-10-22 | **초등 1학년 범위로 고정**(사용자 요청): 1-1/1-2 설정 상한 A6 + `maxTerm` 1-2. A5(두 자리 받아올림/내림)는 2022 개정 2-1 내용으로 재표기·제외, A3(두 자리±한 자리)·A6은 받아올림 없음으로 조정(1학년 받아올림은 A2의 20 이내만). 스테이지 `stageLevel`도 상한·학기 밖으로 못 나감, 저장된 프로필 레벨은 로드 시 클램프(얻은 것은 그대로, P2). B/C 밴드는 2-1/2-2 설정용으로 코드에 유지 | 사용자 "수준을 초등학교 1학년 수준으로" |
| D16 | 2026-10-22 | **실사 장난감 디오라마 그래픽 + 성능 최적화**(사용자 요청, ART_BIBLE 파스텔 클레이보다 우선): PBR 재질(유광 플라스틱·나무·모래·금속·젤리) 공유 캐시, 절차 노이즈 텍스처 1장(파일 0, P1), PMREM 하늘 환경광·반사, 안개, Gerstner 물결(CPU와 같은 파도로 물고기 부력)+원경 링 LOD, 티어별 후처리(high: GTAO+블룸, ultra: +SSR, 지연 청크), 정적 병합·인스턴싱·외곽선 제거로 드로우콜 약 절반, 히트 프록시 비렌더 레이어, 장면 해제 시 객체 dispose 이벤트로 누수 제거, 모바일 DPR 1.25·시작 티어 낮춤, 소프트웨어 WebGPU 어댑터면 WebGL2, WebGPU가 최저 티어에서도 느리면 WebGL2로 한 번 전환. 물리는 장식 전용 자체 경량 솔버(Rapier 1.7MB 측정 후 제외, P5 판정 무관) | 측정: `docs/review/gfx/README.md`. three 0.186.1은 이미 최신 안정판. 실기기 FPS/GPU 메모리는 HUMAN(`pnpm bench`) |
| D17 | 2026-10-22 | 허브 **"쉽게"를 더 쉽게**(사용자 요청): 적응 레벨에서 허용 레벨 **두 단계 아래**(기존 한 단계), 선택지 축소 — 낚시 물고기 4마리, 폭탄 정답 전선 + 1개, 슬라임 정답 조각 + 1개(조각 쪼개기 없음). 언제나 풀 수 있음은 테스트로 확인 | 사용자 "쉽게 난이도를 더 낮춰줘" |
| D18 | 2026-10-22 | 폭탄 오답 **KABOOM 2.6초**(사용자: 더 화려하고 느리게, 연기는 오래 남아 위로): 슬로모션 시작, 주황→빨강 불덩이, 연쇄 소폭발 3회, 충격파 2겹, 순간 조명, three.js 인스턴스 스프라이트 연기(노이즈 가장자리, 불빛→회색, 부력 상승, 약 5초, 숫자 라벨보다 먼저 그려 가독성 유지). `PUFF_TICKS` 60→156. 폭탄 청크 한도 6→8KB(연기·폭발 모듈). 폭탄·낚시에 되돌리기(마지막 선택 취소, 무료), 문제 칸 스피커 아이콘 제거 | 사용자 요청 |
| D19 | 2026-10-22 | **3D 숫자 라벨은 숫자만**(사용자: 밑의 줄 표시 삭제): 자릿값 모양 표시(▬●) 제거, 자릿값은 숫자 색(일=초록, 십=파랑)으로만 구분. 터치 영역은 숫자칸+받침 전체를 덮는 기둥형으로(폭탄은 전선 아래쪽도), 인접 칸과 겹치지 않게 간격의 47% 이하 | 사용자 요청 + 숫자칸 클릭 인식 버그(인식 영역이 전선 중간 허공에 있었음) |
| D20 | 2026-10-22 | **슬라임 합체 = 쫀득 + 철퍽 소리**(사용자 요청): 새 효과음 `slime.squish`(떨어지는 덩어리음 + 젖은 노이즈 + 고무 반동 + 뽀글 2번)·`slime.grab`(집을 때), 큰 슬라임일수록 낮은 소리. 움직임: 스프링을 부드럽고 덜 감쇠되게(220/14→120/4.2) 해 오래 출렁임, 합체 시 더 깊게 눌림, 흡수되는 슬라임은 엿가락처럼 늘어나며 빨려 들어감(0.28초), 집으면 아래로 늘어진 모찌 모양, 젤리 표면 물결 더 깊고 느리게 | 사용자 요청 |
