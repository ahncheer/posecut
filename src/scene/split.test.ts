import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE, makePage, pageHeightFor, pageLayout } from './layout';
import { applySplit, customCuts, leafCount, moveLine, removeLine, splitBySegment, splitFromTemplate, tiltLine, walk, contentBox } from './split';
import type { SplitNode } from './types';

const st = DEFAULT_STYLE, ratio = DEFAULT_PAGE_RATIO, H = pageHeightFor(ratio);

describe('직접 그리기 (선으로 컷 나누기)', () => {
  it('정해진 틀을 같은 모양의 나무로 바꾸면 컷 위치가 같다', () => {
    for (const t of ['four', 'three', 'bigTwo', 'one'] as const) {
      const ids = pageLayout(t, st, ratio).rects.map((_, i) => `c${i}`);
      const cuts = customCuts(splitFromTemplate(t, st, ratio, ids), H, st)!;
      const want = pageLayout(t, st, ratio).rects;
      expect(cuts.map(c => c.id)).toEqual(ids);
      cuts.forEach((c, i) => {
        expect(c.rect.x).toBeCloseTo(want[i].x, 1); expect(c.rect.y).toBeCloseTo(want[i].y, 1);
        expect(c.rect.w).toBeCloseTo(want[i].w, 1); expect(c.rect.h).toBeCloseTo(want[i].h, 1);
      });
    }
  });
  it('가로선을 그으면 한 칸이 위·아래로 나뉘고 위 칸이 원래 컷을 이어받는다', () => {
    const root: SplitNode = { cut: 'x' };
    const r = splitBySegment(root, H, st, [0, 300], [360, 300]);
    expect(r.split).toBe(1);
    const cuts = customCuts(r.root, H, st)!;
    expect(cuts).toHaveLength(2);
    expect(cuts[0].id).toBe('x');
    expect(cuts[0].rect.y + cuts[0].rect.h).toBeCloseTo(300 - st.gutter / 2, 1); // 여백만큼 띄움
    expect(cuts[1].rect.y).toBeCloseTo(300 + st.gutter / 2, 1);
  });
  it('사선으로 나누면 네모가 아닌 컷이 되고, 지나간 칸만 나뉜다', () => {
    const four = splitFromTemplate('four', st, ratio, ['a', 'b', 'c', 'd']);
    const cuts0 = customCuts(four, H, st)!;
    const mid = cuts0[1].rect; // 둘째 칸만 가로지르는 사선
    const r = splitBySegment(four, H, st, [0, mid.y + 10], [360, mid.y + mid.h - 10]);
    expect(r.split).toBe(1);
    const cuts = customCuts(r.root, H, st)!;
    expect(cuts).toHaveLength(5);
    expect(cuts.filter(c => c.poly.length !== 4 || Math.abs(c.poly[0][1] - c.poly[1][1]) > 0.1).length).toBeGreaterThan(0);
    expect(cuts.map(c => c.id).slice(0, 2)).toEqual(['a', 'b']);
  });
  it('너무 작은 칸은 만들지 않는다', () => {
    const r = splitBySegment({ cut: 'x' }, H, st, [0, 16], [360, 16]);
    expect(r.split).toBe(0);
  });
  it('선 옮기기 · 기울이기 · 지우기 (지우면 뒤 칸 장면이 빠진다고 알려줌)', () => {
    const r = splitBySegment({ cut: 'x' }, H, st, [0, 300], [360, 300]);
    const { lines } = walk(r.root, contentBox(H, st));
    expect(lines).toHaveLength(1);
    const moved = moveLine(r.root, H, st, lines[0].path, 0, 40)!;
    expect(customCuts(moved, H, st)![0].rect.h).toBeGreaterThan(customCuts(r.root, H, st)![0].rect.h);
    expect(moveLine(r.root, H, st, lines[0].path, 0, 5000)).toBeNull(); // 페이지 밖으로는 못 감
    const tilted = tiltLine(r.root, H, st, lines[0].path, [12, 300], [348, 380])!;
    expect(customCuts(tilted, H, st)![0].poly).toHaveLength(4);
    const rm = removeLine(r.root, lines[0].path);
    expect('root' in rm && leafCount(rm.root)).toBe(1);
    expect('removed' in rm && rm.removed).not.toBe('x');
  });
  it('안쪽이 더 나뉜 선은 바로 못 지운다', () => {
    const four = splitFromTemplate('four', st, ratio, ['a', 'b', 'c', 'd']);
    expect('error' in removeLine(four, '')).toBe(true);
  });
  it('페이지에 적용하면 같은 id의 장면은 남고 새 칸은 비어 있다', () => {
    const page = makePage('page', 'one', st, ratio);
    page.cuts[0] = { ...page.cuts[0], thumb: 'T' };
    const r = splitBySegment(page.split ?? { cut: page.cuts[0].id }, H, st, [180, 0], [180, H]);
    const p2 = applySplit(page, r.root, st, ratio)!;
    expect(p2.template).toBe('custom');
    expect(p2.cuts).toHaveLength(2);
    expect(p2.cuts[0].thumb).toBe('T');
    expect(p2.cuts[1].thumb).toBeNull();
    expect(p2.cuts[0].poly).toBeUndefined(); // 네모는 poly 없음
  });
});
