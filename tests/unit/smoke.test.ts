import { describe, expect, it } from 'vitest';
import { ko } from '../../src/i18n/ko';

describe('smoke', () => {
  it('has a title', () => {
    expect(ko.app.title).toBe('숫자섬 탐험대');
  });
});
