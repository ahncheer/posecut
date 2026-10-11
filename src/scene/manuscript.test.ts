import { describe, expect, it } from 'vitest';
import { addPage, allCuts, clearCut, findCut, neighbourCutId, newManuscript, newWork, nextTempName, pasteScene, previousCut, updateCut } from './manuscript';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE } from './layout';
import type { EngineScene } from './types';

const scene: EngineScene = { v: 1, slots: [{ x: 1 }], camera: { pos: [0, 1, 2], target: [0, 1, 0], fov: 30 }, shot: 'bust', aa: 1 };
const make = (format: 'page' | 'webtoon' = 'page') =>
  newManuscript({ title: '1화', work: newWork('작품'), format, template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO });

describe('원고 다루기', () => {
  it('컷 장면을 바꿔도 원본 원고는 그대로다', () => {
    const m = make();
    const id = m.pages[0].cuts[1].id;
    const m2 = updateCut(m, id, { scene, thumb: 'data:x' });
    expect(findCut(m2, id)?.cut.scene).toEqual(scene);
    expect(findCut(m, id)?.cut.scene).toBeNull();
    expect(findCut(clearCut(m2, id), id)?.cut.thumb).toBeNull();
  });

  it('앞 컷·다음 컷은 페이지를 넘어 이어진다', () => {
    const m = addPage(make());
    const lastOfFirst = m.pages[0].cuts[3].id, firstOfSecond = m.pages[1].cuts[0].id;
    expect(neighbourCutId(m, lastOfFirst, 1)).toBe(firstOfSecond);
    expect(previousCut(m, firstOfSecond)?.id).toBe(lastOfFirst);
    expect(neighbourCutId(m, m.pages[0].cuts[0].id, -1)).toBeNull();
    expect(allCuts(m)).toHaveLength(8);
  });

  it('붙여넣은 장면은 복사본이라 원래 장면을 바꿔도 따라 바뀌지 않는다', () => {
    const m = make();
    const id = m.pages[0].cuts[0].id;
    const copy = structuredClone(scene);
    const m2 = pasteScene(m, id, copy, null);
    (copy.slots as { x: number }[])[0].x = 99;
    expect((findCut(m2, id)?.cut.scene?.slots as { x: number }[])[0].x).toBe(1);
  });

  it('웹툰은 페이지 추가 대신 컷이 아래로 늘어난다', () => {
    const m = addPage(make('webtoon'));
    expect(m.pages).toHaveLength(1);
    expect(m.pages[0].cuts).toHaveLength(5);
  });
});

describe('자동 이름', () => {
  it('비어 있으면 임시1, 있으면 가장 큰 번호 다음', () => {
    expect(nextTempName([])).toBe('임시1');
    expect(nextTempName(['카페', '임시1', '임시 3'])).toBe('임시4');
    expect(nextTempName(['임시작품'])).toBe('임시1');
  });
});
