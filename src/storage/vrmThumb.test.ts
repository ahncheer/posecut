import { describe, expect, it } from 'vitest';
import { thumbnailFromGlb } from './vrmThumb';

/** 최소 GLB 만들기: JSON 덩어리 + BIN 덩어리 */
function glb(json: object, bin: Uint8Array): ArrayBuffer {
  const pad = (n: number) => (n + 3) & ~3;
  const j = new TextEncoder().encode(JSON.stringify(json));
  const jl = pad(j.length), bl = pad(bin.length);
  const buf = new ArrayBuffer(12 + 8 + jl + 8 + bl);
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, buf.byteLength, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true); u8.fill(0x20, 20, 20 + jl); u8.set(j, 20);
  const b = 20 + jl;
  dv.setUint32(b, bl, true); dv.setUint32(b + 4, 0x004e4942, true); u8.set(bin, b + 8);
  return buf;
}
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

describe('VRM 썸네일', () => {
  it('VRM1 thumbnailImage를 꺼낸다', async () => {
    const buf = glb({ images: [{ bufferView: 0, mimeType: 'image/png' }], bufferViews: [{ byteOffset: 0, byteLength: 8 }], extensions: { VRMC_vrm: { meta: { thumbnailImage: 0 } } } }, png);
    const blob = thumbnailFromGlb(buf);
    expect(blob?.type).toBe('image/png');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(png);
  });
  it('VRM0 meta.texture → textures[].source', () => {
    const buf = glb({ images: [{ bufferView: 0, mimeType: 'image/jpeg' }], textures: [{ source: 0 }], bufferViews: [{ byteLength: 8 }], extensions: { VRM: { meta: { texture: 0 } } } }, png);
    expect(thumbnailFromGlb(buf)?.type).toBe('image/jpeg');
  });
  it('썸네일이 없거나 GLB가 아니면 null', () => {
    expect(thumbnailFromGlb(glb({}, png))).toBeNull();
    expect(thumbnailFromGlb(new ArrayBuffer(40))).toBeNull();
  });
});
