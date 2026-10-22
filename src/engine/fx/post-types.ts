/** Shared shape of a post-processing chain (kept apart so the lazy chunk does not import its loader). */
export interface Post {
  render(): void;
  dispose(): void;
}
