import { ko } from '../../i18n/ko';
import { speak, ttsSupported } from '../../infra/tts/tts';

/** 🔊 read-aloud for every instruction (P4). Hidden when Web Speech is missing. */
export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  if (!ttsSupported()) return null;
  return (
    <button
      type="button"
      className={`toy-btn speak-btn ${className}`}
      aria-label={ko.a11y.speak}
      onClick={() => speak(text)}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
