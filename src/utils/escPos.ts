// ESC/POS byte stream builder with strict CP437 sanitization
// Matches standard Epson TM-T88 clones (58mm / 80mm)

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Sanitizes text to printable CP437 / US-ASCII so cheap thermal printers
 * never print random glyphs or break column alignment.
 */
export function sanitizeForCp437(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\n' || ch === '\r') {
      out += ch;
      continue;
    }
    if (ch === '₨' || ch === '₹') {
      out += 'R';
      continue;
    }
    if (ch === '—' || ch === '–') {
      out += '-';
      continue;
    }
    if (ch === '‘' || ch === '’') {
      out += "'";
      continue;
    }
    if (ch === '“' || ch === '”') {
      out += '"';
      continue;
    }
    if (ch === '•' || ch === '·') {
      out += '*';
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) {
      out += ch;
    } else {
      out += '?';
    }
  }
  return out;
}

export interface EscPosBlock {
  text: string;
  align?: 'left' | 'center';
  bold?: boolean;
  doubleHeight?: boolean;
  doubleWidth?: boolean;
}

function encodeAscii(str: string): number[] {
  const clean = sanitizeForCp437(str);
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    bytes.push(clean.charCodeAt(i) & 0x7f);
  }
  return bytes;
}

export function buildEscPosPayload(monospacedText: string): Uint8Array {
  const sanitized = sanitizeForCp437(monospacedText);
  const textBytes = new Uint8Array(sanitized.length);
  for (let i = 0; i < sanitized.length; i++) {
    textBytes[i] = sanitized.charCodeAt(i) & 0x7f;
  }

  // ESC @ (init — clears double-height/state from previous job)
  // ESC t 0 (select code page 0 / CP437 explicitly)
  const header = new Uint8Array([ESC, 0x40, ESC, 0x74, 0x00]);

  // ESC d 4 (feed 4 lines before cut so cutter never slices the last line)
  // GS V 66 0 (partial cut; printers without cutter safely ignore)
  const footer = new Uint8Array([0x0a, ESC, 0x64, 0x04, GS, 0x56, 0x42, 0x00]);

  const payload = new Uint8Array(header.length + textBytes.length + footer.length);
  payload.set(header, 0);
  payload.set(textBytes, header.length);
  payload.set(footer, header.length + textBytes.length);
  return payload;
}

/**
 * Builds rich ESC/POS byte stream using only universal Epson TM-T88 commands:
 * ESC @, ESC t 0, ESC a (align), ESC E (bold), GS ! (size), ESC d 4, GS V 66 0.
 */
export function buildStructuredEscPosPayload(blocks: EscPosBlock[]): Uint8Array {
  const out: number[] = [
    ESC, 0x40, // ESC @ — reset printer state
    ESC, 0x74, 0x00, // ESC t 0 — select CP437
  ];

  for (const block of blocks) {
    const alignByte = block.align === 'center' ? 0x01 : 0x00;
    const boldByte = block.bold ? 0x01 : 0x00;
    const sizeByte =
      (block.doubleWidth ? 0x10 : 0x00) | (block.doubleHeight ? 0x01 : 0x00);

    out.push(ESC, 0x61, alignByte);
    out.push(ESC, 0x45, boldByte);
    out.push(GS, 0x21, sizeByte);
    out.push(...encodeAscii(block.text));
    out.push(0x0a);
  }

  // Reset style before feeding and cutting
  out.push(ESC, 0x61, 0x00);
  out.push(ESC, 0x45, 0x00);
  out.push(GS, 0x21, 0x00);
  out.push(ESC, 0x64, 0x04); // Feed 4 lines before cut
  out.push(GS, 0x56, 0x42, 0x00); // Partial cut

  return new Uint8Array(out);
}
