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

/**
 * What is actually said for a line shown on screen: pictures (emoji) are dropped — a voice would read
 * "🐙 젤리 문어" as "문어 젤리 문어" — and number sentences are spoken as words ("12 − 7 = 5" → "12 빼기 7 은 5").
 */
export function speechText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu, ' ')
    .replace(/(\d)\s*[−-]\s*(?=\d|\?|□)/g, '$1 빼기 ')
    .replace(/(\d)\s*\+\s*(?=\d|\?|□)/g, '$1 더하기 ')
    .replace(/\s*=\s*/g, ' 은 ')
    .replace(/[?□]\s*(?=은|빼기|더하기)/g, '어떤 수 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stop any line being read (leaving a screen must not leave the voice talking). */
export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): boolean {
  if (!enabled || !ttsSupported()) return false;
  speechSynthesis.cancel();
  const said = speechText(text);
  if (!said) return false;
  const u = new SpeechSynthesisUtterance(said);
  u.lang = 'ko-KR';
  const v = koreanVoice();
  if (!v) return false;
  u.voice = v;
  u.rate = opts.rate ?? 0.95;
  u.pitch = opts.pitch ?? 1.1;
  speechSynthesis.speak(u);
  return true;
}
