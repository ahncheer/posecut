import { describe, expect, it } from 'vitest';
import { newManuscript, newWork, addPage } from './manuscript';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE } from './layout';
import { applyImport, defaultMapping, duplicateTargets, parsePoseSource, planPairs, remapCut } from './importPose';
import type { Character, EngineScene, Manuscript } from './types';

const scene = (n: number, tag = ''): EngineScene => ({ v: 1, slots: Array.from({ length: n }, (_, i) => ({ x: i * 10, tag })), camera: { pos: [0, 1, 3], target: [0, 1, 0], fov: 30 }, shot: 'full', aa: 1 });
const ch = (slot: string, name: string, model = true): Character => ({ slot, name, role: '', gender: '', age: 'adult', model: model ? { kind: 'stored', id: slot, name: `${name}.vrm` } : null });
const work = () => ({ ...newWork('w'), characters: [ch('A', '민지'), ch('B', '서준'), ch('C', '하나'), ch('D', '모델없음', false)] });
const ms = (w = work()): Manuscript => addPage(newManuscript({ title: 't', work: w, format: 'page', template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO }));

describe('JSON 포즈 가져오기', () => {
  it('장면 파일: 인원과 이름을 읽는다', () => {
    const s = parsePoseSource(JSON.stringify({ ...scene(3), who: [{ letter: 'A', name: '서준' }, { letter: 'B', name: 'B' }, { letter: 'C' }] }));
    expect(s.kind).toBe('scene');
    expect(s.people.map(p => p.label)).toEqual(['서준', 'B', '인물 C']);
  });
  it('이름이 같으면 그 인물에, 나머지는 모델 있는 인물 순서대로 짝짓는다', () => {
    const s = parsePoseSource(JSON.stringify({ ...scene(3), who: [{ name: '서준' }, { name: '누구' }, { name: '또누구' }] }));
    const map = defaultMapping(s, work().characters);
    expect(map).toEqual({ p0: 'B', p1: 'A', p2: 'C' });
    expect(duplicateTargets({ p0: 'A', p1: 'A' })).toEqual(['A']);
  });
  it('짝이 없는 인물은 빼고 순서를 맞춘다', () => {
    const src = { scene: scene(3), people: ['p0', 'p1', 'p2'] };
    const r = remapCut(src, { p0: 'C', p1: '', p2: 'A' })!;
    expect(r.cast).toEqual(['C', 'A']);
    expect((r.scene.slots as { x: number }[]).map(s => s.x)).toEqual([0, 20]);
  });
  it('원고 파일 → 페이지·원고 전체에 위치 순서대로', () => {
    const w = work();
    let src = ms(w);
    const ids = src.pages.flatMap(p => p.cuts.map(c => c.id));
    src = { ...src, pages: src.pages.map((p, pi) => ({ ...p, cuts: p.cuts.map((c, ci) => (ci % 2 === 0 ? { ...c, scene: scene(2, `${pi}-${ci}`), cast: ['B', 'A'] } : c)) })) };
    const file = JSON.stringify({ kind: 'rough-manuscript', version: 1, work: w, manuscript: src });
    const s = parsePoseSource(file);
    expect(s.people.map(p => p.key)).toEqual(['A', 'B']);
    expect(s.pages[0][0].people).toEqual(['B', 'A']);
    const target = ms(w);
    target.pages[0].cuts[2] = { ...target.pages[0].cuts[2], scene: scene(1, 'old') };
    const map = { A: 'C', B: 'A' } as const;
    const all = planPairs(target, s, { scope: 'all', skipFilled: false });
    expect(all.length).toBe(4);
    const r = applyImport(target, all, map, false);
    expect(r.summary).toEqual({ applied: 4, replaced: 1, skipped: 0, empty: 0 });
    expect(r.manuscript.pages[1].cuts[2].cast).toEqual(['A', 'C']);
    expect((r.manuscript.pages[1].cuts[2].scene!.slots[0] as { tag: string }).tag).toBe('1-2');
    const skip = applyImport(target, all, map, true);
    expect(skip.summary.skipped).toBe(1);
    const page = planPairs(target, s, { scope: 'page', targetPage: 0, srcPage: 1, skipFilled: false });
    expect(page.map(p => (p.src.scene!.slots[0] as { tag: string }).tag)).toEqual(['1-0', '1-2']);
    const one = planPairs(target, s, { scope: 'cut', targetCutId: target.pages[1].cuts[3].id, srcCut: [0, 2], skipFilled: false });
    expect(one.length).toBe(1);
    expect(ids.length).toBe(8);
  });
  it('러프 도구 파일이 아니면 알려준다', () => {
    expect(() => parsePoseSource('{"a":1}')).toThrow();
    expect(() => parsePoseSource('not json')).toThrow();
  });
});
