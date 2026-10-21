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
