import { checkUpload, sniffKind } from './file-signature';

/** Build a buffer from leading bytes plus optional trailing filler. */
function bytes(head: number[], fillTo = 0): Buffer {
  const arr = [...head];
  while (arr.length < fillTo) arr.push(0x00);
  return Buffer.from(arr);
}

describe('security/file-signature', () => {
  describe('sniffKind', () => {
    it('detects common document/image types', () => {
      expect(sniffKind(Buffer.from('%PDF-1.7\n'))).toBe('pdf');
      expect(sniffKind(bytes([0x50, 0x4b, 0x03, 0x04]))).toBe('zip');
      expect(
        sniffKind(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      ).toBe('png');
      expect(sniffKind(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
      expect(sniffKind(Buffer.from('GIF89a'))).toBe('gif');
    });

    it('detects executables and active content', () => {
      expect(sniffKind(bytes([0x4d, 0x5a, 0x90, 0x00]))).toBe('pe-executable');
      expect(sniffKind(bytes([0x7f, 0x45, 0x4c, 0x46]))).toBe('elf-executable');
      expect(sniffKind(Buffer.from('#!/bin/bash\n'))).toBe('script-shebang');
      expect(sniffKind(Buffer.from('<!DOCTYPE html><script>'))).toBe('html');
    });

    it('treats plain text/JSON/markdown as unknown (no magic bytes)', () => {
      expect(sniffKind(Buffer.from('# Notes\nhello world'))).toBe('unknown');
      expect(sniffKind(Buffer.from('{"a":1}'))).toBe('unknown');
    });

    it('flags an empty file', () => {
      expect(sniffKind(Buffer.alloc(0))).toBe('empty');
    });
  });

  describe('checkUpload', () => {
    it('accepts a genuine PDF declared as pdf', () => {
      const r = checkUpload({
        buffer: Buffer.from('%PDF-1.4 ...'),
        mimetype: 'application/pdf',
        filename: 'report.pdf',
      });
      expect(r.ok).toBe(true);
      expect(r.detected).toBe('pdf');
    });

    it('accepts plain markdown/text', () => {
      expect(
        checkUpload({
          buffer: Buffer.from('# Title\nbody'),
          mimetype: 'text/markdown',
          filename: 'notes.md',
        }).ok,
      ).toBe(true);
    });

    it('rejects an executable renamed to .pdf (content-type spoofing)', () => {
      const r = checkUpload({
        buffer: bytes([0x4d, 0x5a, 0x90, 0x00]),
        mimetype: 'application/pdf',
        filename: 'invoice.pdf',
      });
      expect(r.ok).toBe(false);
      expect(r.detected).toBe('pe-executable');
    });

    it('rejects a PDF-declared file whose bytes are actually a zip', () => {
      const r = checkUpload({
        buffer: bytes([0x50, 0x4b, 0x03, 0x04]),
        mimetype: 'application/pdf',
        filename: 'thing.pdf',
      });
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('does not match');
    });

    it('rejects HTML (stored-XSS risk) even if labelled text', () => {
      const r = checkUpload({
        buffer: Buffer.from('<!DOCTYPE html><script>alert(1)</script>'),
        mimetype: 'text/plain',
        filename: 'a.txt',
      });
      expect(r.ok).toBe(false);
      expect(r.detected).toBe('html');
    });

    it('rejects a shell script disguised as text', () => {
      const r = checkUpload({
        buffer: Buffer.from('#!/bin/sh\nrm -rf /'),
        mimetype: 'text/plain',
        filename: 'readme.txt',
      });
      expect(r.ok).toBe(false);
      expect(r.detected).toBe('script-shebang');
    });

    it('rejects an empty upload', () => {
      expect(
        checkUpload({ buffer: Buffer.alloc(0), filename: 'x.pdf' }).ok,
      ).toBe(false);
    });
  });
});
