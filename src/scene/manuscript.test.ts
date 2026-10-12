import { describe, expect, it } from 'vitest';
import { remapSceneSlots, addCharacter, addPage, allCuts, blankCharacters, castForCut, nextEpisodeTitle, removeCharacter, changePageTemplate, clearCut, findCut, neighbourCutId, newManuscript, newWork, nextTempName, pasteScene, resolveTitle, uniqueTitle, previousCut, updateCut } from './manuscript';
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

describe('페이지마다 컷 틀', () => {
  const sc = (n: number): EngineScene => ({ ...scene, shot: `s${n}` });
  it('새 페이지는 바로 앞 페이지 틀, 틀을 주면 그 틀', () => {
    let m = make();
    m = addPage(m, 'three');
    expect(m.pages[1].template).toBe('three');
    expect(m.pages[1].cuts).toHaveLength(3);
    m = addPage(m);
    expect(m.pages[2].template).toBe('three');
  });

  it('틀을 바꾸면 장면을 앞에서부터 옮기고, 남는 장면 수를 알려준다', () => {
    const m = make();
    m.pages[0].cuts.forEach((c, i) => { if (i !== 1) c.scene = sc(i); }); // 1·3·4번 컷에 장면 (2번은 빈 컷)
    const r = changePageTemplate(m, 0, 'bigTwo');
    expect(r.lost).toBe(0);
    expect(r.manuscript.pages[0].cuts.map(c => c.scene?.shot)).toEqual(['s0', 's2', 's3']);
    const r2 = changePageTemplate(m, 0, 'one');
    expect(r2.lost).toBe(2);
    expect(r2.manuscript.pages[0].cuts).toHaveLength(1);
    expect(m.pages[0].cuts).toHaveLength(4); // 원본 그대로
  });
});

describe('제목 겹치지 않게', () => {
  it('같은 제목이 있으면 숫자를 하나씩 올린다', () => {
    expect(uniqueTitle('카페', [])).toBe('카페');
    expect(uniqueTitle('카페', ['카페'])).toBe('카페2');
    expect(uniqueTitle('카페', ['카페', '카페2'])).toBe('카페3');
    expect(uniqueTitle('임시1', ['임시1'])).toBe('임시2');
  });
  it('비우면 임시N', () => {
    expect(resolveTitle('  ', ['임시1'])).toBe('임시2');
    expect(resolveTitle(' 카페 ', ['카페'])).toBe('카페2');
  });
});

describe('등장인물 추가·삭제', () => {
  it('다음 글자로 추가하고, 지워도 최소 1명은 남는다', () => {
    let cs = addCharacter(blankCharacters());
    expect(cs.map(c => c.slot)).toEqual(['A', 'B', 'C']);
    cs = removeCharacter(cs, 'B');
    expect(addCharacter(cs).map(c => c.slot)).toEqual(['A', 'C', 'B']);
    expect(removeCharacter([cs[0]], cs[0].slot)).toHaveLength(1);
  });
  it('컷에는 모델 있는 앞의 2명', () => {
    const cs = addCharacter(blankCharacters()).map((c, i) => ({ ...c, model: i === 1 ? null : { kind: 'sample' as const } }));
    expect(castForCut(cs).map(c => c.slot)).toEqual(['A', 'C']);
  });
  it('컷마다 고른 인물 순서대로, 모델 없는 사람은 빼고, 비우면 아무도 없음', () => {
    const cs = addCharacter(blankCharacters()).map((c, i) => ({ ...c, model: i === 1 ? null : { kind: 'sample' as const } }));
    const [a, x, y] = cs.map(c => c.slot);
    expect(castForCut(cs, [y, a]).map(c => c.slot)).toEqual([y, a]);
    expect(castForCut(cs, [x, y]).map(c => c.slot)).toEqual([y]);
    expect(castForCut(cs, [])).toEqual([]);
    expect(castForCut(cs, ['없는사람', a]).map(c => c.slot)).toEqual([a]);
  });
  it('인물을 빼거나 순서를 바꾸면 장면의 자세도 따라 옮겨진다', () => {
    const scene = { v: 1 as const, slots: ['A자세', 'B자세', 'C자세'], camera: { pos: [0, 0, 0], target: [0, 0, 0], fov: 28 }, shot: 'bust', aa: 1 };
    expect(remapSceneSlots(scene, ['a', 'b', 'c'], ['a', 'c'])?.slots).toEqual(['A자세', 'C자세']);
    expect(remapSceneSlots(scene, ['a', 'b', 'c'], ['c', 'x'])?.slots).toEqual(['C자세', null]);
    expect(remapSceneSlots(null, ['a'], [])).toBeNull();
  });
  it('한 컷에 여러 명 (최대 6명)', () => {
    let cs = blankCharacters();
    for (let i = 0; i < 7; i++) cs = addCharacter(cs);
    cs = cs.map(c => ({ ...c, model: { kind: 'sample' as const } }));
    expect(castForCut(cs, cs.map(c => c.slot))).toHaveLength(6);
    expect(castForCut(cs)).toHaveLength(2);
  });
  it('다음 화 이름', () => {
    expect(nextEpisodeTitle([])).toBe('1화');
    expect(nextEpisodeTitle(['1화', '2화'])).toBe('3화');
    expect(nextEpisodeTitle(['1화', '외전'])).toBe('3화');
  });
});

describe('컷 맞바꾸기', () => {
  it('두 컷의 장면·그림·인물만 바꾸고 자리는 그대로', async () => {
    const { swapCuts, newManuscript, newWork } = await import('./manuscript');
    const { DEFAULT_STYLE, DEFAULT_PAGE_RATIO } = await import('./layout');
    const m0 = newManuscript({ title: 't', work: newWork(), format: 'page', template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO });
    const [c1, , c3] = m0.pages[0].cuts;
    const sc = { v: 1 as const, slots: [{ a: 1 }], camera: { pos: [0, 0, 0], target: [0, 0, 0], fov: 30 }, shot: 'full', aa: 1 };
    const m = { ...m0, pages: [{ ...m0.pages[0], cuts: m0.pages[0].cuts.map(c => (c.id === c1.id ? { ...c, scene: sc, thumb: 'T', cast: ['B'] } : c)) }] };
    const s = swapCuts(m, c1.id, c3.id);
    const [n1, , n3] = s.pages[0].cuts;
    expect(n1.scene).toBeNull(); expect(n1.thumb).toBeNull(); expect('cast' in n1).toBe(false);
    expect(n3.scene).toEqual(sc); expect(n3.thumb).toBe('T'); expect(n3.cast).toEqual(['B']);
    expect(n1.rect).toEqual(c1.rect); expect(n3.rect).toEqual(c3.rect); expect(n1.id).toBe(c1.id);
    expect(swapCuts(swapCuts(m, c1.id, c3.id), c1.id, c3.id)).toEqual(m);
  });
});
