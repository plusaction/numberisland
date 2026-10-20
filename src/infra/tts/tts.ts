/** 🔊 Read-aloud with Web Speech ko-KR (SPEC §8). Hidden when unsupported. */
export function ttsSupported(): boolean {
  return (
    typeof globalThis.speechSynthesis !== 'undefined' &&
    typeof globalThis.SpeechSynthesisUtterance !== 'undefined'
  );
}

let enabled = true;
export function setTtsEnabled(on: boolean) {
  enabled = on;
  if (!on && ttsSupported()) speechSynthesis.cancel();
}

function koreanVoice(): SpeechSynthesisVoice | undefined {
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ko'));
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): boolean {
  if (!enabled || !ttsSupported()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  const v = koreanVoice();
  if (v) u.voice = v;
  u.rate = opts.rate ?? 0.95;
  u.pitch = opts.pitch ?? 1.1;
  speechSynthesis.speak(u);
  return true;
}
