// 원고를 JSON 파일로 내보내고 다시 불러오기. VRM 파일은 크기가 커서 넣지 않고 이름만 남긴다.
import type { Manuscript, Work } from '../scene/types';
import { db } from './db';
import { annotateManuscriptFile, prettyJSON, stripNotes } from './readableJson';

export interface ManuscriptFile {
  kind: 'rough-manuscript';
  version: 1;
  work: Work;
  manuscript: Manuscript;
}

export function toFile(work: Work, manuscript: Manuscript): ManuscriptFile {
  return { kind: 'rough-manuscript', version: 1, work, manuscript };
}

/** 파일로 내보낼 모양: 설명("$" 항목)을 붙이고, 작은 그림은 맨 아래 thumbs로 (readableJson.ts 규칙) */
export function toReadableFile(work: Work, manuscript: Manuscript): Record<string, unknown> {
  return annotateManuscriptFile(work, manuscript);
}

export function parseFile(text: string): ManuscriptFile {
  const raw = JSON.parse(text) as Partial<ManuscriptFile> & { thumbs?: Record<string, unknown> };
  // 설명("$…") 항목은 빼고, 따로 모아 둔 작은 그림(thumbs)은 컷에 다시 붙인다
  const { thumbs, ...data } = stripNotes(raw);
  if (data.manuscript && Array.isArray(data.manuscript.pages) && thumbs && typeof thumbs === 'object') {
    data.manuscript = { ...data.manuscript, pages: data.manuscript.pages.map(p => ({ ...p, cuts: (p.cuts ?? []).map(c => {
      const t = thumbs[c.id];
      return typeof t === 'string' && t.startsWith('data:image/') ? { ...c, thumb: t } : { ...c, thumb: c.thumb ?? null };
    }) })) };
  }
  if (data.kind !== 'rough-manuscript' || data.version !== 1 || !data.work || !data.manuscript) {
    throw new Error('러프 도구 원고 파일이 아니에요.');
  }
  return data as ManuscriptFile;
}

export function downloadJSON(name: string, data: unknown): void {
  const blob = new Blob([prettyJSON(data)], { type: 'application/json' });
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
