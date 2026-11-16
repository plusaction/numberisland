import { describe, expect, it } from 'vitest';
import { speechText } from '../../src/infra/tts/tts';

describe('[P4] 읽어 주기 문장 다듬기', () => {
  it('drops pictures and says number sentences as words', () => {
    expect(speechText('🐙 젤리 문어랑 카드 배틀!')).toBe('젤리 문어랑 카드 배틀!');
    expect(speechText('12 − 7 = 5! 이제 5 남았어!')).toBe('12 빼기 7 은 5! 이제 5 남았어!');
    expect(speechText('🍄 버섯 8조각, 🧀 치즈 4조각! 모두 몇 조각?')).toBe(
      '버섯 8조각, 치즈 4조각! 모두 몇 조각?',
    );
    expect(speechText('3 + 4 = 7')).toBe('3 더하기 4 은 7');
    expect(speechText('👑 VIP 손님!')).toBe('VIP 손님!');
    expect(speechText('🏁')).toBe('');
  });
});
