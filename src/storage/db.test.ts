import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db, deleteManuscript, pruneModels, saveManuscript, saveWork, storeModelFile } from './db';
import { newManuscript, newWork } from '../scene/manuscript';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE } from '../scene/layout';

const vrm = (name: string) => new File([new Uint8Array([1, 2, 3])], name);

describe('저장소 정리', () => {
  it('작품이 쓰는 VRM은 남기고, 아무도 안 쓰는 VRM만 지운다', async () => {
    const used = await storeModelFile(vrm('a.vrm'));
    const orphan = await storeModelFile(vrm('b.vrm'));
    const w = newWork('정리 테스트');
    w.characters[0] = { ...w.characters[0], model: used };
    await saveWork(w);
    expect(await pruneModels()).toBeGreaterThanOrEqual(1);
    expect(await db.models.get(used.kind === 'stored' ? used.id : '')).toBeTruthy();
    expect(await db.models.get(orphan.kind === 'stored' ? orphan.id : '')).toBeUndefined();
  });
  it('작품의 마지막 원고를 지우면 작품과 그 VRM도 정리된다', async () => {
    const model = await storeModelFile(vrm('c.vrm'));
    const w = newWork('지울 작품');
    w.characters[0] = { ...w.characters[0], model };
    await saveWork(w);
    const m = newManuscript({ title: '1화', work: w, format: 'page', template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO });
    await saveManuscript(m);
    await deleteManuscript(m.id);
    expect(await db.works.get(w.id)).toBeUndefined();
    expect(await db.models.get(model.kind === 'stored' ? model.id : '')).toBeUndefined();
  });
});
