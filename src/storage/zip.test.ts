import { describe, expect, it } from 'vitest';
import { crc32, makeZip } from './zip';

describe('ZIP 묶기', () => {
  it('CRC32가 표준 값과 같다', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('파일 두 개를 묶고 끝 레코드에 개수가 들어간다', async () => {
    const z = makeZip([['1페이지.png', new Uint8Array([1, 2, 3])], ['b.txt', new TextEncoder().encode('hi')]]);
    const buf = new Uint8Array(await z.arrayBuffer());
    const dv = new DataView(buf.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const endAt = buf.length - 22;
    expect(dv.getUint32(endAt, true)).toBe(0x06054b50);
    expect(dv.getUint16(endAt + 10, true)).toBe(2);
  });
});
