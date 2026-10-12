import { describe, expect, it } from 'vitest';
import sample from '../../docs/examples/1화_취향_콘티.json?raw';
import { applyStoryboard, defaultCharMapping, pageFromStoryboard, parseStoryboard, splitFromBoxes } from './storyboard';
import { newManuscript, newWork } from './manuscript';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE } from './layout';
import { leafCount } from './split';
import type { Character } from './types';

const ch = (slot: string, name: string, model = true): Character => ({ slot, name, role: '', gender: '', age: 'adult', model: model ? { kind: 'sample' } : null });

describe('그림 콘티 → 원고', () => {
  it('예시 콘티를 읽는다 (```json 감싸기도)', () => {
    const sb = parseStoryboard('```json\n' + sample + '\n```');
    expect(sb.pages[0].panels.length).toBe(4);
    expect(sb.characters.map(c => c.id)).toEqual(['A', 'B']);
    expect(sb.pages[0].panels[0].bubbles?.[0].text).toBe('…와.\n취향이다.');
    expect(() => parseStoryboard('{"a":1}')).toThrow();
    const noisy = '여기 있어요:\n{ // 설명\n "pages": [ { "panels": [ { "box": [0,0,1,0.5], "bubbles": [ { "text": "http://a.b // 아님", }, ], }, ] } ] /* 끝 */ }\n감사합니다';
    expect(parseStoryboard(noisy).pages[0].panels[0].bubbles?.[0].text).toBe('http://a.b // 아님');
  });
  it('네모 칸들을 선으로 나눈 나무로 (2×2 + 위 큰 칸)', () => {
    const root = splitFromBoxes([
      { id: 'a', x0: 0, y0: 0, x1: 100, y1: 40 },
      { id: 'b', x0: 0, y0: 50, x1: 45, y1: 100 }, { id: 'c', x0: 55, y0: 50, x1: 100, y1: 100 },
    ]);
    expect(leafCount(root)).toBe(3);
    expect('line' in root && root.line[1]).toBe(45);
  });
  it('페이지·컷·제목·출연 인물·콘티가 들어간다', () => {
    const work = { ...newWork('w'), characters: [ch('A', '민준'), ch('B', '서진'), ch('C', '모델없음', false)] };
    const m = newManuscript({ title: '1화', work, format: 'page', template: 'four', style: DEFAULT_STYLE, pageRatio: DEFAULT_PAGE_RATIO });
    const sb = parseStoryboard(sample);
    const map = defaultCharMapping(sb, work.characters);
    expect(map).toEqual({ A: 'A', B: 'B' });
    const page = pageFromStoryboard(sb.pages[0], m, map, work.characters);
    expect(page.title?.text).toBe('1화. 취향');
    expect(page.cuts.length).toBe(4);
    expect(page.cuts[0].rect.y).toBeLessThan(page.cuts[1].rect.y);
    expect(page.cuts[0].cast).toEqual(['A', 'B']);
    expect(page.cuts[3].cast).toEqual(['A']);
    expect(page.cuts[0].plan?.bubbles?.[0].to).toBe(0);
    expect(page.cuts[0].plan?.bubbles?.[2].to).toBe(1);
    expect(page.cuts[3].plan?.chars?.[0].pose).toBe('책상에 엎드리기');
    expect(page.cuts[0].rect.y).toBeGreaterThan(DEFAULT_STYLE.margin + 10); // 제목 자리
    const added = applyStoryboard(m, [page], 'append', 0);
    expect(added.pages.length).toBe(2);
    const replaced = applyStoryboard(m, [page], 'replace', 0);
    expect(replaced.pages.length).toBe(1);
    expect(replaced.pages[0].id).toBe(page.id);
  });
});
