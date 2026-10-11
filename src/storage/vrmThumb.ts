// VRM 파일 안에 들어 있는 썸네일 그림을 꺼낸다 (3D 엔진 없이 파일 구조만 읽음).
// VRM1: extensions.VRMC_vrm.meta.thumbnailImage (이미지 번호), VRM0: extensions.VRM.meta.texture (텍스처 번호)
import type { ModelRef } from '../scene/types';
import { loadModelFile } from './db';

interface GltfJson {
  images?: { bufferView?: number; mimeType?: string }[];
  textures?: { source?: number }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  extensions?: { VRMC_vrm?: { meta?: { thumbnailImage?: number } }; VRM?: { meta?: { texture?: number } } };
}

export function thumbnailFromGlb(buf: ArrayBuffer): Blob | null {
  if (buf.byteLength < 20) return null;
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) return null; // 'glTF'
  let off = 12;
  let json: GltfJson | null = null;
  let bin: { start: number; len: number } | null = null;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true), start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len))) as GltfJson;
    else if (type === 0x004e4942) bin = { start, len };
    off = start + len;
  }
  if (!json || !bin) return null;
  let img = json.extensions?.VRMC_vrm?.meta?.thumbnailImage;
  if (img === undefined) {
    const tex = json.extensions?.VRM?.meta?.texture;
    if (tex !== undefined && tex >= 0) img = json.textures?.[tex]?.source;
  }
  const image = img !== undefined && img >= 0 ? json.images?.[img] : undefined;
  const view = image?.bufferView !== undefined ? json.bufferViews?.[image.bufferView] : undefined;
  if (!image || !view) return null;
  return new Blob([new Uint8Array(buf, bin.start + (view.byteOffset ?? 0), view.byteLength)], { type: image.mimeType ?? 'image/png' });
}

const cache = new Map<string, Promise<string | null>>();
const keyOf = (ref: ModelRef) => (ref.kind === 'sample' ? 'sample' : ref.id);

/** 모델의 썸네일 주소 (없으면 null). 같은 모델은 한 번만 읽는다 */
export function modelThumbnail(ref: ModelRef | null): Promise<string | null> {
  if (!ref) return Promise.resolve(null);
  const k = keyOf(ref);
  if (!cache.has(k)) {
    cache.set(k, (async () => {
      const f = await loadModelFile(ref);
      if (!f) return null;
      try {
        const blob = thumbnailFromGlb(await f.arrayBuffer());
        return blob ? URL.createObjectURL(blob) : null;
      } catch {
        return null;
      }
    })());
  }
  return cache.get(k)!;
}
