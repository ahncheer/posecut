import { describe, expect, it } from 'vitest';
import { annotateManuscriptFile, annotateScene, prettyJSON, stripNotes } from './readableJson';
import { parseFile } from './file-io';
import { newManuscript, newWork } from '../scene/manuscript';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE } from '../scene/layout';
import type { EngineScene } from '../scene/types';

const scene = (): EngineScene => ({
  v: 1, slots: [{ pose: { head: { x: 8.123456, y: 0, z: -0 } }, x: 10, z: 0, y: 0, rot: 15, presence: 100, look: 'manual' }],
  camera: { pos: [0.123456789, 1.3, 3], target: [0, 1.3, 0], fov: 28.4 }, shot: 'bust', aa: 2,
});

describe('읽기 좋은 JSON', () => {
  it('짧은 값은 한 줄, 숫자는 넷째 자리까지', () => {
    const t = prettyJSON({ a: { x: 1.234567, y: -0, z: 3 }, list: [1, 2, 3] });
    expect(t).toBe('{ "a": { "x": 1.2346, "y": 0, "z": 3 }, "list": [1, 2, 3] }\n');
    const long = prettyJSON({ items: Array.from({ length: 30 }, (_, i) => ({ id: i, name: `이름${i}` })) });
    expect(long.split('\n').length).toBeGreaterThan(30);
    expect(JSON.parse(long).items[3]).toEqual({ id: 3, name: '이름3' });
  });
  it('장면 파일: 설명이 각 항목 바로 앞, 키 순서 고정, 설명을 빼면 원래 값', () => {
    const a = annotateScene(scene());
    const keys = Object.keys(a);
    expect(keys.slice(0, 3)).toEqual(['$about', 'kind', 'v']);
    expect(keys.indexOf('$camera')).toBe(keys.indexOf('camera') - 1);
    expect(Object.keys((a.slots as object[])[0])).toEqual(['x', 'y', 'z', 'rot', 'presence', 'look', 'pose']);
    const back = stripNotes(JSON.parse(prettyJSON(a)));
    expect(back.camera.pos[0]).toBe(0.1235);
    expect(Object.keys(back).some(k => k.startsWith('$'))).toBe(false);
  });
  it('원고 파일: 작은 그림은 맨 아래 thumbs, 다시 읽으면 컷에 붙는다 (예전 형식도 읽음)', () => {
    const work = newWork('작품');
    const m = newManuscript({ title: '1화', work, format: 'page', template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO });
    const id = m.pages[0].cuts[0].id;
    m.pages[0].cuts[0] = { ...m.pages[0].cuts[0], scene: scene(), thumb: 'data:image/jpeg;base64,AAA' };
    const file = annotateManuscriptFile(work, m);
    const text = prettyJSON(file);
    expect(Object.keys(file).at(-1)).toBe('thumbs');
    expect(text.indexOf('data:image')).toBeGreaterThan(text.indexOf('"$thumbs"'));
    const back = parseFile(text);
    expect(back.manuscript.pages[0].cuts[0].thumb).toBe('data:image/jpeg;base64,AAA');
    expect(back.manuscript.pages[0].cuts[1].thumb).toBeNull();
    expect(back.manuscript.pages[0].cuts[0].id).toBe(id);
    expect(back.manuscript.pages[0].cuts[0].scene?.slots.length).toBe(1);
    const old = parseFile(JSON.stringify({ kind: 'rough-manuscript', version: 1, work, manuscript: m }));
    expect(old.manuscript.pages[0].cuts[0].thumb).toBe('data:image/jpeg;base64,AAA');
  });
});
