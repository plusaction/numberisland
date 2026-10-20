/** All user-facing Korean strings. Keep lines short (P4: ≤12 chars where possible). */
export const ko = {
  app: {
    title: '숫자섬 탐험대',
    loading: '섬으로 가는 중…',
  },
} as const;

export type Strings = typeof ko;
