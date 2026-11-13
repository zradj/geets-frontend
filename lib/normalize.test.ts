import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_CHARS, normalizeMessage as n } from './normalize';

describe('normalizeMessage', () => {
  it('lowercases', () => {
    expect(n('Hello WORLD')).toBe('hello world');
    expect(n('ПРИВЕТ Мир')).toBe('привет мир');
  });

  it('collapses all whitespace to single spaces and trims', () => {
    expect(n('  a   b\t\tc\n\nd\r\ne  f  ')).toBe('a b c d e f');
  });

  it('removes exclamation marks and their look-alikes', () => {
    expect(n('wow!!! really！ ¡hola! ok‼ what⁉')).toBe('wow really hola ok what?');
  });

  it('removes emoji, including sequences, flags, keycaps and skin tones', () => {
    expect(n('hi 😀 there 👍🏽 ok')).toBe('hi there ok');
    expect(n('family 👨‍👩‍👧‍👦 flag 🇩🇪 heart ❤️ done')).toBe('family flag heart done');
    expect(n('✅ yes ☺ no ⭐')).toBe('yes no');
    expect(n('😀😀😀')).toBe('');
  });

  it('keeps ordinary punctuation, digits and non-latin scripts', () => {
    expect(n('ok, so: 2 + 2 = 4? (yes) — "fine"; 100%.')).toBe('ok, so: 2 + 2 = 4? (yes) — "fine"; 100%.');
    expect(n('日本語 한국어 עברית')).toBe('日本語 한국어 עברית');
  });

  it('removes invisible characters that could carry a hidden mark', () => {
    expect(n('a​b‍c⁠d﻿e­f‮g')).toBe('abcdefg');
  });

  it('folds styled and fullwidth letters to plain ones', () => {
    expect(n('ＨＥＬＬＯ 𝓱𝓮𝓵𝓵𝓸 𝐇𝐄𝐋𝐋𝐎')).toBe('hello hello hello');
  });

  it('flattens piles of combining marks', () => {
    expect(n('z̀́̂̃̄̅algo').length).toBeLessThanOrEqual(7);
    expect(n('café')).toBe('café');
  });

  it('caps the length', () => {
    expect(n('a'.repeat(MAX_MESSAGE_CHARS + 500))).toHaveLength(MAX_MESSAGE_CHARS);
  });

  it('is idempotent', () => {
    for (const s of ['Hello!!  World 😀', '  A\nB ', 'ＷＯＷ！', 'İstanbul ẞ', 'x 👍🏽 ! y']) {
      expect(n(n(s))).toBe(n(s));
    }
  });

  it('never outputs upper case, "!", double spaces or line breaks', () => {
    const nasty = 'A  B!\nC\t😀 D‼ Ｅ！ ​ F';
    const out = n(nasty);
    expect(out).toBe(out.toLowerCase());
    expect(out).not.toMatch(/[!\n\r\t]| {2}/);
    expect(out).toBe('a b c d e f');
  });
});
