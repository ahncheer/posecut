// 원고를 JSON 파일로 내보내고 다시 불러오기. VRM 파일은 크기가 커서 넣지 않고 이름만 남긴다.
import type { Manuscript, Work } from '../scene/types';
import { db } from './db';

export interface ManuscriptFile {
  kind: 'rough-manuscript';
  version: 1;
  work: Work;
  manuscript: Manuscript;
}

export function toFile(work: Work, manuscript: Manuscript): ManuscriptFile {
  return { kind: 'rough-manuscript', version: 1, work, manuscript };
}

export function parseFile(text: string): ManuscriptFile {
  const data = JSON.parse(text) as Partial<ManuscriptFile>;
  if (data.kind !== 'rough-manuscript' || data.version !== 1 || !data.work || !data.manuscript) {
    throw new Error('러프 도구 원고 파일이 아니에요.');
  }
  return data as ManuscriptFile;
}

export function downloadJSON(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** 불러온 파일을 저장소에 넣는다. 같은 원고가 있으면 덮어쓴다. */
export async function importManuscriptFile(file: File): Promise<string> {
  const data = parseFile(await file.text());
  await db.transaction('rw', db.works, db.manuscripts, async () => {
    if (!(await db.works.get(data.work.id))) await db.works.put(data.work);
    await db.manuscripts.put({ ...data.manuscript, updatedAt: Date.now() });
  });
  return data.manuscript.id;
}
