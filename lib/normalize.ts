/**
 * Uniform message format.
 *
 * Writing style is a fingerprint: capitalisation habits, exclamation marks,
 * emoji, double spaces and line breaks all help tell authors apart. Every
 * message is therefore squashed into one shape:
 *   - lower case only
 *   - words separated by exactly one space, no line breaks
 *   - no exclamation marks
 *   - no emoji / pictographs
 *   - no invisible characters (zero-width etc. -- they could carry a hidden mark)
 *   - text only: there is no attachment type anywhere in the protocol
 *
 * The server only ever sees ciphertext and cannot enforce this, so it runs
 * twice: before encrypting (sender) and again after decrypting (every
 * receiver). A modified client therefore cannot push un-normalised text
 * onto honest members' screens.
 */

export const MAX_MESSAGE_CHARS = 2000;

// Emoji and pictographs, their modifiers and joiners, flags, keycaps, tags.
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{FE00}-\u{FE0F}\u{E0000}-\u{E007F}\u{20E3}]/gu;
// Format/control/private-use/unassigned characters (zero-width, bidi overrides, soft hyphen, ...).
const INVISIBLE = /[\p{Cf}\p{Cc}\p{Co}\p{Cn}\p{Cs}]/gu;
// "!" and its look-alikes.
const EXCLAMATION = /[!¡ǃ‼⁈⁉❗❕︕﹗！]/gu;
// Combining marks stacked more than two deep ("zalgo") are decoration, not language.
const MARK_PILE = /(\p{M}{2})\p{M}+/gu;

export function normalizeMessage(input: string): string {
  return input
    .normalize('NFKC')             // fold fullwidth/styled letters (ｈｅｌｌｏ, 𝓱𝓮𝓵𝓵𝓸) into plain ones
    .replace(/\p{Cf}/gu, '')       // zero-width & co. first: JS counts U+FEFF as whitespace
    .replace(/\s+/gu, ' ')         // every whitespace run, line breaks included, becomes one space
    .replace(EMOJI, '')
    .replace(INVISIBLE, '')
    .replace(EXCLAMATION, '')
    .replace(MARK_PILE, '$1')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/ +/g, ' ')           // removals above may have left double spaces
    .trim()
    .slice(0, MAX_MESSAGE_CHARS)
    .trim();
}
