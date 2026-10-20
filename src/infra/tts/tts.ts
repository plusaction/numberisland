/** 🔊 Read-aloud with Web Speech ko-KR (SPEC §8). Hidden when unsupported. */
export function ttsSupported(): boolean {
  if (
    typeof globalThis.speechSynthesis === 'undefined' ||
    typeof globalThis.SpeechSynthesisUtterance === 'undefined'
  )
    return false;
  return koreanVoice() !== undefined;
}

let enabled = true;
export function setTtsEnabled(on: boolean) {
  enabled = on;
  if (!on && ttsSupported()) speechSynthesis.cancel();
}

/**
 * Only on-device voices: a remote voice (localService=false, e.g. Chrome's "Google 한국의") would send the
 * text to a server and break P1. No local Korean voice ⇒ no read-aloud.
 */
export function koreanVoice(
  voices: readonly SpeechSynthesisVoice[] = speechSynthesis.getVoices(),
): SpeechSynthesisVoice | undefined {
  return voices.find((v) => v.lang.toLowerCase().startsWith('ko') && v.localService);
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): boolean {
  if (!enabled || !ttsSupported()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  const v = koreanVoice();
  if (!v) return false;
  u.voice = v;
  u.rate = opts.rate ?? 0.95;
  u.pitch = opts.pitch ?? 1.1;
  speechSynthesis.speak(u);
  return true;
}
