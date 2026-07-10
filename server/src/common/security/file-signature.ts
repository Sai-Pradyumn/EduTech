/**
 * File-content ("magic byte") validation (SECURITY_IMPLEMENTATION.md §18, control FU-01).
 * A declared Content-Type/extension is attacker-controlled; this inspects the actual bytes
 * so an executable renamed `notes.pdf` (or sent as `text/plain`) is caught. Pair it with
 * size limits, an extension allowlist, private buckets, and AV scanning — this is one layer.
 */

export type DetectedKind =
  | 'pdf'
  | 'zip' // also docx/xlsx/pptx (OOXML are zip containers)
  | 'png'
  | 'jpg'
  | 'gif'
  | 'webp'
  | 'gzip'
  | 'rtf'
  | 'html'
  | 'pe-executable' // Windows .exe/.dll (MZ)
  | 'elf-executable' // Linux
  | 'mach-o' // macOS Mach-O / Java class (shared CAFEBABE magic)
  | 'script-shebang' // #!/bin/sh …
  | 'empty'
  | 'unknown';

/** Content kinds that must never be accepted as an uploaded document. */
export const DANGEROUS_KINDS: ReadonlySet<DetectedKind> = new Set<DetectedKind>(
  [
    'pe-executable',
    'elf-executable',
    'mach-o',
    'script-shebang',
    'html', // can carry stored XSS if ever served inline
  ],
);

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/** Skip a leading UTF-8 BOM and ASCII whitespace for text-shape sniffing. */
function textStart(buf: Buffer): string {
  let start = 0;
  if (startsWith(buf, [0xef, 0xbb, 0xbf])) start = 3;
  const slice = buf.subarray(start, start + 512).toString('latin1');
  return slice.replace(/^[\s﻿]+/, '').toLowerCase();
}

/** Detect a file's kind from its leading bytes. Returns 'unknown' for plain text/JSON/etc. */
export function sniffKind(buf: Buffer): DetectedKind {
  if (!buf || buf.length === 0) return 'empty';

  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (
    startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buf, [0x50, 0x4b, 0x07, 0x08])
  )
    return 'zip'; // PK.. (also OOXML docx/xlsx/pptx)
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'png';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'gif'; // GIF8
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'webp'; // RIFF....WEBP
  if (startsWith(buf, [0x1f, 0x8b])) return 'gzip';
  if (startsWith(buf, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return 'rtf'; // {\rtf

  // Executables / active content — reject regardless of claimed type.
  if (startsWith(buf, [0x4d, 0x5a])) return 'pe-executable'; // MZ
  if (startsWith(buf, [0x7f, 0x45, 0x4c, 0x46])) return 'elf-executable'; // .ELF
  if (
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(buf, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(buf, [0xca, 0xfe, 0xba, 0xbe]) // Mach-O universal / Java class
  )
    return 'mach-o';
  if (startsWith(buf, [0x23, 0x21])) return 'script-shebang'; // #!

  const text = textStart(buf);
  if (
    text.startsWith('<!doctype html') ||
    text.startsWith('<html') ||
    text.startsWith('<script')
  )
    return 'html';

  return 'unknown';
}

export interface UploadCheckInput {
  buffer: Buffer;
  mimetype?: string;
  filename?: string;
}

export interface UploadCheckResult {
  ok: boolean;
  detected: DetectedKind;
  reason?: string;
}

/** Map a claimed extension/mime to the content kind we expect its bytes to have. */
function claimedBinaryKind(input: UploadCheckInput): DetectedKind | null {
  const name = (input.filename ?? '').toLowerCase();
  const mime = (input.mimetype ?? '').toLowerCase();
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (
    name.endsWith('.docx') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.pptx') ||
    mime.includes('officedocument')
  )
    return 'zip';
  if (name.endsWith('.png') || mime === 'image/png') return 'png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || mime === 'image/jpeg')
    return 'jpg';
  if (name.endsWith('.gif') || mime === 'image/gif') return 'gif';
  return null;
}

/**
 * Verify an upload's real content is safe and consistent with what it claims to be.
 * Rejects: executables/active content; a binary type whose magic bytes don't match its
 * claimed extension/mime (content-type spoofing). Accepts plain-text families (no magic
 * bytes) when their bytes aren't a disguised dangerous type.
 */
export function checkUpload(input: UploadCheckInput): UploadCheckResult {
  const detected = sniffKind(input.buffer);

  if (detected === 'empty')
    return { ok: false, detected, reason: 'Empty file' };

  if (DANGEROUS_KINDS.has(detected))
    return {
      ok: false,
      detected,
      reason: `Rejected content type: ${detected}`,
    };

  const claimed = claimedBinaryKind(input);
  if (claimed && detected !== claimed)
    return {
      ok: false,
      detected,
      reason: `Content does not match declared type (declared ${claimed}, found ${detected})`,
    };

  return { ok: true, detected };
}
