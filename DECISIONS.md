# DECISIONS

| # | 날짜 | 결정 | 이유 |
|---|---|---|---|
| D1 | 2026-10-20 | 프로젝트 루트 `/home/user/numberisland`, 정적 SPA(Next.js 미사용) | 서버 기능 불필요(SPEC §5) |
| D2 | 2026-10-20 | **TypeScript 6.0.3** 사용 (최신 7.0.2 대신) | TS 7(Go 네이티브)은 JS 컴파일러 API가 아직 없어 dependency-cruiser가 `typescript >=2 <7`만 지원. 레이어 경계 강제(SPEC §6.1)가 더 중요. dep-cruiser가 TS7 지원하면 상향 |
| D3 | 2026-10-20 | React Compiler는 `@rolldown/plugin-babel` + `reactCompilerPreset` 경로 사용 | plugin-react 6의 Rust 컴파일러 옵션은 문서상 experimental |
| D4 | 2026-10-20 | Playwright는 사전 설치 Chromium(`/opt/pw-browsers/chromium`, SwiftShader) 사용 | 컨테이너에 GPU 없음, `playwright install` 금지. WebGPU 실기·프레임타임은 `pnpm bench`로 사용자 기기에서 측정(QUALITY96 §0-5) |
| D5 | 2026-10-20 | `check-offline`은 주석/에러메시지용 문서 링크(threejs.org, react.dev, tailwindcss.com 등)만 허용목록 | 문자열 링크는 요청을 일으키지 않음. 대신 fetch(절대URL)/XHR/WebSocket/EventSource/sendBeacon과 외부 `<script>/<link>`는 모두 실패 처리 |
| D6 | 2026-10-20 | vite-plugin-pwa 2.0.0은 Vite 8 peer 지원 확인, 도입은 M10 | M0~M4 범위 축소 |
