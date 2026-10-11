// 브라우저 안 저장소(IndexedDB). 원고·작품·VRM 파일이 이 컴퓨터의 브라우저에 남는다.
import Dexie, { type Table } from 'dexie';
import type { Manuscript, ModelRef, Work } from '../scene/types';
import { newId } from '../scene/id';

export interface StoredModel {
  id: string;
  name: string;
  blob: Blob;
  addedAt: number;
}

class RoughDB extends Dexie {
  works!: Table<Work, string>;
  manuscripts!: Table<Manuscript, string>;
  models!: Table<StoredModel, string>;

  constructor() {
    super('rough-tool');
    this.version(1).stores({
      works: 'id, updatedAt',
      manuscripts: 'id, updatedAt, workId',
      models: 'id',
    });
  }
}

export const db = new RoughDB();

export async function saveManuscript(m: Manuscript): Promise<void> {
  await db.manuscripts.put({ ...m, updatedAt: Date.now() });
}

export async function saveWork(w: Work): Promise<void> {
  await db.works.put({ ...w, updatedAt: Date.now() });
}

export async function storeModelFile(file: File): Promise<ModelRef> {
  const id = newId();
  await db.models.put({ id, name: file.name, blob: file, addedAt: Date.now() });
  return { kind: 'stored', id, name: file.name };
}

/** 샘플 모델 주소 (public/models/sample.vrm). 없으면 null을 돌려준다. */
const SAMPLE_URL = `${import.meta.env.BASE_URL}models/sample.vrm`;

export async function loadModelFile(ref: ModelRef | null): Promise<File | null> {
  if (!ref) return null;
  if (ref.kind === 'sample') {
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) return null;
      return new File([await res.blob()], 'sample.vrm');
    } catch {
      return null;
    }
  }
  const row = await db.models.get(ref.id);
  return row ? new File([row.blob], row.name) : null;
}

export async function sampleAvailable(): Promise<boolean> {
  try {
    const res = await fetch(SAMPLE_URL, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/** 원고를 지운다. 그 작품의 마지막 원고였으면 작품(설명·등장인물 설정)도 같이 지운다. */
export async function deleteManuscript(id: string): Promise<void> {
  await db.transaction('rw', db.manuscripts, db.works, async () => {
    const m = await db.manuscripts.get(id);
    await db.manuscripts.delete(id);
    if (m && (await db.manuscripts.where('workId').equals(m.workId).count()) === 0) await db.works.delete(m.workId);
  });
}
