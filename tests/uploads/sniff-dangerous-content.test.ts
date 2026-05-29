import { describe, it, expect } from 'vitest';
import { sniffDangerousContent } from '@/lib/uploads';

const bytes = (...parts: (number[] | string)[]): Uint8Array => {
  const flat: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') {
      for (let i = 0; i < p.length; i++) flat.push(p.charCodeAt(i));
    } else {
      flat.push(...p);
    }
  }
  return new Uint8Array(flat);
};

describe('sniffDangerousContent', () => {
  it('rejects HTML documents regardless of leading whitespace/case', () => {
    expect(sniffDangerousContent(bytes('<!DOCTYPE html>'))).not.toBeNull();
    expect(sniffDangerousContent(bytes('  \n<HtMl>'))).not.toBeNull();
    expect(sniffDangerousContent(bytes('<body onload=alert(1)>'))).not.toBeNull();
  });

  it('rejects SVG / XML (browser-renderable, script-capable)', () => {
    expect(sniffDangerousContent(bytes('<svg xmlns="...">'))).not.toBeNull();
    expect(sniffDangerousContent(bytes('<?xml version="1.0"?>'))).not.toBeNull();
  });

  it('rejects scripts and server-page markers', () => {
    expect(sniffDangerousContent(bytes('#!/bin/sh'))).not.toBeNull();
    expect(sniffDangerousContent(bytes('<script>alert(1)</script>'))).not.toBeNull();
    expect(sniffDangerousContent(bytes('<% eval %>'))).not.toBeNull();
  });

  it('rejects executable magic numbers (PE / ELF / Mach-O)', () => {
    expect(sniffDangerousContent(bytes([0x4d, 0x5a, 0x90, 0x00]))).not.toBeNull(); // MZ
    expect(sniffDangerousContent(bytes([0x7f, 0x45, 0x4c, 0x46]))).not.toBeNull(); // ELF
    expect(sniffDangerousContent(bytes([0xfe, 0xed, 0xfa, 0xce]))).not.toBeNull(); // Mach-O
    expect(sniffDangerousContent(bytes([0xca, 0xfe, 0xba, 0xbe]))).not.toBeNull();
  });

  it('accepts legitimate allowlisted uploads', () => {
    // PDF
    expect(sniffDangerousContent(bytes('%PDF-1.7'))).toBeNull();
    // PNG
    expect(
      sniffDangerousContent(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBeNull();
    // JPEG
    expect(sniffDangerousContent(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    // ZIP-based Office docs (docx/xlsx/pptx)
    expect(sniffDangerousContent(bytes([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
    // Legacy OLE2 (doc/xls/ppt)
    expect(
      sniffDangerousContent(bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    ).toBeNull();
    // Plain CSV / text
    expect(
      sniffDangerousContent(bytes('community,district,investment_name\n')),
    ).toBeNull();
  });

  it('treats empty input as not-dangerous (size is handled elsewhere)', () => {
    expect(sniffDangerousContent(new Uint8Array())).toBeNull();
  });
});
