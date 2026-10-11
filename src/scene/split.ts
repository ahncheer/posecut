// 직접 그리기: 선을 그어 컷을 나누는 "나눔 나무".
// 나무의 마디 하나 = 선 하나. 선이 지나는 칸을 두 칸(a, b)으로 나눈다. 잎 = 컷 하나(id).
// 선을 옮기거나 지워도 다른 칸의 컷 id(=장면)는 그대로 남는다.
// 좌표는 페이지 단위(가로 PAGE_W). 칸 사이 여백은 그릴 때 선 양쪽으로 gutter/2씩 띄운다.
import type { Cut, FrameStyle, Page, Rect, SplitNode, TemplateId } from './types';
import { PAGE_W, pageHeightFor, pageLayout } from './layout';
import { newId } from './id';

export type Pt = [number, number];
/** 꼭짓점 + 그 꼭짓점에서 다음 꼭짓점으로 가는 변이 어디서 왔는지 ('outer' = 페이지 안쪽 테두리, 그 밖 = 선의 경로) */
interface TaggedPoly { pts: Pt[]; tags: string[] }

export interface Leaf { cut: string; path: string; poly: TaggedPoly }
export interface LineSeg { path: string; a: Pt; b: Pt }

const EPS = 1e-6;
/** 선에서 점이 어느 쪽인지 (양수/음수) */
const side = (l: [number, number, number, number], p: Pt) => (l[2] - l[0]) * (p[1] - l[1]) - (l[3] - l[1]) * (p[0] - l[0]);

/** 볼록 다각형을 선의 한쪽(keep: +1 / -1)만 남기고 자른다. 새로 생긴 변은 tag로 표시 */
function clip(poly: TaggedPoly, line: [number, number, number, number], keep: 1 | -1, tag: string): TaggedPoly {
  const { pts, tags } = poly;
  const out: Pt[] = [], outTags: string[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const sp = side(line, p) * keep, sq = side(line, q) * keep;
    const pin = sp >= -EPS, qin = sq >= -EPS;
    if (pin) { out.push(p); outTags.push(tags[i]); }
    if (pin !== qin) {
      const t = sp / (sp - sq);
      const x: Pt = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      if (pin) { out.push(x); outTags.push(tag); } // 안 → 밖: 여기부터는 자른 선
      else { out.push(x); outTags.push(tags[i]); } // 밖 → 안: 원래 변이 이어짐
    }
  }
  return dedupe({ pts: out, tags: outTags });
}
function dedupe(poly: TaggedPoly): TaggedPoly {
  const pts: Pt[] = [], tags: string[] = [];
  poly.pts.forEach((p, i) => {
    const prev = pts[pts.length - 1];
    if (prev && Math.hypot(prev[0] - p[0], prev[1] - p[1]) < 1e-4) { tags[tags.length - 1] = poly.tags[i]; return; }
    pts.push(p); tags.push(poly.tags[i]);
  });
  if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-4) { pts.pop(); tags.pop(); }
  return { pts, tags };
}

export function area(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(s) / 2;
}
export function bbox(pts: Pt[]): Rect {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
const centroid = (pts: Pt[]): Pt => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

/** 페이지 안쪽(바깥 여백 안) 네모 */
export function contentBox(height: number, style: FrameStyle): TaggedPoly {
  const m = style.margin, t = m + (style.padTop ?? 0), r = PAGE_W - m - (style.padRight ?? 0);
  return { pts: [[m, t], [r, t], [r, height - m], [m, height - m]], tags: ['outer', 'outer', 'outer', 'outer'] };
}

/** 나무를 따라 내려가며 잎(컷)마다 칸 모양, 선마다 그 칸 안의 선분을 구한다 */
export function walk(root: SplitNode, box: TaggedPoly): { leaves: Leaf[]; lines: LineSeg[] } {
  const leaves: Leaf[] = [], lines: LineSeg[] = [];
  const go = (node: SplitNode, poly: TaggedPoly, path: string) => {
    if ('cut' in node) { leaves.push({ cut: node.cut, path, poly }); return; }
    const seg = segmentIn(poly.pts, node.line);
    if (seg) lines.push({ path, a: seg[0], b: seg[1] });
    go(node.a, clip(poly, node.line, -1, path), path + 'a');
    go(node.b, clip(poly, node.line, 1, path), path + 'b');
  };
  go(root, box, '');
  return { leaves, lines };
}

/** 무한히 늘인 선이 볼록 다각형 안에서 지나는 선분 */
function segmentIn(pts: Pt[], line: [number, number, number, number]): [Pt, Pt] | null {
  const hits: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const sp = side(line, p), sq = side(line, q);
    if (Math.abs(sp) < EPS) hits.push(p);
    else if (sp * sq < 0) { const t = sp / (sp - sq); hits.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  if (hits.length < 2) return null;
  // 가장 먼 두 점
  let best: [Pt, Pt] = [hits[0], hits[1]], d = -1;
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const dd = Math.hypot(hits[i][0] - hits[j][0], hits[i][1] - hits[j][1]);
    if (dd > d) { d = dd; best = [hits[i], hits[j]]; }
  }
  return d > 1e-3 ? best : null;
}

/** 칸 사이 여백만큼 안쪽으로 줄인 컷 모양. 바깥 테두리 쪽 변은 그대로 */
export function inset(poly: TaggedPoly, gutter: number): Pt[] | null {
  const { pts, tags } = poly, n = pts.length;
  if (n < 3) return null;
  // 시계/반시계 방향에 따라 안쪽 방향이 다르다
  let s = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; }
  const ccw = s > 0;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len; // 왼쪽 법선
    if (!ccw) { nx = -nx; ny = -ny; }
    const d = tags[i] === 'outer' ? 0 : gutter / 2;
    return { p: [p[0] + nx * d, p[1] + ny * d] as Pt, dir: [dx, dy] as Pt };
  });
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const L1 = lines[(i - 1 + n) % n], L2 = lines[i];
    const den = L1.dir[0] * L2.dir[1] - L1.dir[1] * L2.dir[0];
    if (Math.abs(den) < 1e-9) { out.push(L2.p); continue; }
    const t = ((L2.p[0] - L1.p[0]) * L2.dir[1] - (L2.p[1] - L1.p[1]) * L2.dir[0]) / den;
    out.push([L1.p[0] + L1.dir[0] * t, L1.p[1] + L1.dir[1] * t]);
  }
  // 줄였더니 뒤집히거나 너무 작으면 실패
  let s2 = 0; for (let i = 0; i < n; i++) { const p = out[i], q = out[(i + 1) % n]; s2 += p[0] * q[1] - q[0] * p[1]; }
  if (Math.sign(s2) !== Math.sign(s) || area(out) < 120) return null;
  const b = bbox(out);
  if (b.w < 14 || b.h < 14) return null;
  return out.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
}

/** 읽는 순서(위 → 아래, 같은 줄은 왼쪽 → 오른쪽) */
function readingOrder<T extends { rect: Rect }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y);
  const rows: { y0: number; y1: number; items: T[] }[] = [];
  for (const it of sorted) {
    const r = it.rect;
    const row = rows.find(rw => Math.min(rw.y1, r.y + r.h) - Math.max(rw.y0, r.y) > 0.5 * Math.min(rw.y1 - rw.y0, r.h));
    if (row) { row.items.push(it); row.y0 = Math.min(row.y0, r.y); row.y1 = Math.max(row.y1, r.y + r.h); }
    else rows.push({ y0: r.y, y1: r.y + r.h, items: [it] });
  }
  rows.sort((a, b) => a.y0 - b.y0);
  return rows.flatMap(rw => rw.items.sort((a, b) => (a.rect.x + a.rect.w / 2) - (b.rect.x + b.rect.w / 2)));
}

export interface CustomCut { id: string; rect: Rect; poly: Pt[] }
/** 나눔 나무 → 컷 목록(읽는 순서). 어느 칸이든 너무 작아지면 null */
export function customCuts(root: SplitNode, height: number, style: FrameStyle): CustomCut[] | null {
  const { leaves } = walk(root, contentBox(height, style));
  const cuts: CustomCut[] = [];
  for (const l of leaves) {
    const poly = inset(l.poly, style.gutter);
    if (!poly) return null;
    cuts.push({ id: l.cut, rect: bbox(poly), poly });
  }
  return readingOrder(cuts);
}

/** 네모 컷이면 poly를 남기지 않는다 (다른 화면이 네모로 빠르게 그리게) */
const isRect = (poly: Pt[]) => poly.length === 4 && poly.every(([x, y]) => {
  const b = bbox(poly);
  return (Math.abs(x - b.x) < 0.01 || Math.abs(x - b.x - b.w) < 0.01) && (Math.abs(y - b.y) < 0.01 || Math.abs(y - b.y - b.h) < 0.01);
});

/** 페이지에 나눔 나무를 적용한다. 같은 id 컷의 장면·그림은 그대로 */
export function applySplit(page: Page, root: SplitNode, style: FrameStyle, ratio: [number, number]): Page | null {
  const height = pageHeightFor(ratio);
  const cuts = customCuts(root, height, style);
  if (!cuts) return null;
  const old = new Map(page.cuts.map(c => [c.id, c]));
  const next: Cut[] = cuts.map(c => {
    const prev = old.get(c.id);
    const base: Cut = prev ? { ...prev } : { id: c.id, rect: c.rect, scene: null, thumb: null };
    base.rect = c.rect;
    if (isRect(c.poly)) delete base.poly; else base.poly = c.poly;
    return base;
  });
  return { ...page, template: 'custom', split: root, height, cuts: next };
}

/** 정해진 틀(네모 줄·칸)을 같은 모양의 나눔 나무로. 컷 id는 페이지의 컷 순서대로 이어받는다 */
export function splitFromTemplate(template: TemplateId, style: FrameStyle, ratio: [number, number], ids: string[] = []): SplitNode {
  const { rects } = pageLayout(template === 'custom' ? 'one' : template, style, ratio);
  const idAt = (i: number) => ids[i] ?? newId();
  // 줄 묶기
  const rows: Rect[][] = [];
  rects.forEach(r => { const row = rows.find(rw => Math.abs(rw[0].y - r.y) < 0.5); if (row) row.push(r); else rows.push([r]); });
  let k = 0;
  const rowNodes = rows.map(row => {
    const leaves = row.map(() => ({ cut: idAt(k++) } as SplitNode));
    let node = leaves[leaves.length - 1];
    for (let c = row.length - 2; c >= 0; c--) {
      const x = row[c].x + row[c].w + style.gutter / 2;
      node = { line: [x, 0, x, 1], a: leaves[c], b: node };
    }
    return node;
  });
  // side(): 세로선 (x,0)→(x,1)에서 왼쪽(x 작음)이 양수 → a는 음수 쪽이라 오른쪽이 되므로, 선 방향을 아래→위로 둔다
  const fixV = (n: SplitNode): SplitNode => ('cut' in n ? n : { line: [n.line[0], 1, n.line[2], 0], a: fixV(n.a), b: fixV(n.b) });
  let node = fixV(rowNodes[rowNodes.length - 1]);
  for (let r = rows.length - 2; r >= 0; r--) {
    const y = rows[r][0].y + rows[r][0].h + style.gutter / 2;
    node = { line: [0, y, 1, y], a: fixV(rowNodes[r]), b: node };
  }
  return node;
}

/** 지금 페이지의 나눔 나무 (정해진 틀 페이지면 같은 모양으로 만들어 줌) */
export function splitOfPage(page: Page, fallback: TemplateId, style: FrameStyle, ratio: [number, number]): SplitNode {
  if (page.split) return page.split;
  return splitFromTemplate(page.template ?? fallback, style, ratio, page.cuts.map(c => c.id));
}

const mapNode = (n: SplitNode, path: string, at: string, fn: (n: SplitNode) => SplitNode): SplitNode => {
  if (path === at) return fn(n);
  if ('cut' in n) return n;
  return { ...n, a: mapNode(n.a, path + 'a', at, fn), b: mapNode(n.b, path + 'b', at, fn) };
};

/**
 * 그은 선분(p→q)이 지나는 칸을 모두 그 선으로 나눈다.
 * 나뉜 칸 중 읽는 순서가 앞인 쪽이 원래 컷(장면)을 이어받는다. 너무 작아지는 칸은 나누지 않는다.
 */
export function splitBySegment(root: SplitNode, height: number, style: FrameStyle, p: Pt, q: Pt): { root: SplitNode; split: number } {
  if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 4) return { root, split: 0 };
  const line: [number, number, number, number] = [p[0], p[1], q[0], q[1]];
  const { leaves } = walk(root, contentBox(height, style));
  let next = root, count = 0;
  for (const leaf of leaves) {
    if (!segmentCrosses(leaf.poly.pts, p, q)) continue;
    const A = clip(leaf.poly, line, -1, 'new'), B = clip(leaf.poly, line, 1, 'new');
    if (A.pts.length < 3 || B.pts.length < 3) continue;
    const ia = inset(A, style.gutter), ib = inset(B, style.gutter);
    if (!ia || !ib) continue;
    const ca = centroid(ia), cb = centroid(ib);
    const aFirst = Math.abs(ca[1] - cb[1]) > 4 ? ca[1] < cb[1] : ca[0] < cb[0];
    const fresh = newId();
    const cand = mapNode(next, '', leaf.path, () => ({ line, a: { cut: aFirst ? leaf.cut : fresh }, b: { cut: aFirst ? fresh : leaf.cut } }));
    if (customCuts(cand, height, style)) { next = cand; count++; }
  }
  return { root: next, split: count };
}

/** 선분이 다각형 안쪽을 지나는지 (끝점이 안에 있거나 변을 가로지름) */
function segmentCrosses(pts: Pt[], p: Pt, q: Pt): boolean {
  const seg = segmentIn(pts, [p[0], p[1], q[0], q[1]]);
  if (!seg) return false;
  // 선분 p-q 와 칸 안 선분 seg 가 겹치는 길이
  const d = [q[0] - p[0], q[1] - p[1]], L = Math.hypot(d[0], d[1]);
  const proj = (x: Pt) => ((x[0] - p[0]) * d[0] + (x[1] - p[1]) * d[1]) / L;
  const t0 = Math.min(proj(seg[0]), proj(seg[1])), t1 = Math.max(proj(seg[0]), proj(seg[1]));
  return Math.min(L, t1) - Math.max(0, t0) > 3;
}

/** 선(path)을 (dx, dy)만큼 옮긴다. 어느 칸이 너무 작아지면 null */
export function moveLine(root: SplitNode, height: number, style: FrameStyle, path: string, dx: number, dy: number): SplitNode | null {
  const cand = mapNode(root, '', path, n => ('cut' in n ? n : { ...n, line: [n.line[0] + dx, n.line[1] + dy, n.line[2] + dx, n.line[3] + dy] }));
  return customCuts(cand, height, style) ? cand : null;
}

/** 선의 한쪽 끝을 옮겨 기울기를 바꾼다 (end: 0 = 첫 점, 1 = 둘째 점, 칸 안 선분의 끝 위치 기준) */
export function tiltLine(root: SplitNode, height: number, style: FrameStyle, path: string, fixed: Pt, moved: Pt): SplitNode | null {
  if (Math.hypot(moved[0] - fixed[0], moved[1] - fixed[1]) < 8) return null;
  const cand = mapNode(root, '', path, n => {
    if ('cut' in n) return n;
    // 방향(어느 쪽이 a인지)이 뒤집히지 않게 원래 선과 같은 방향으로
    const od = [n.line[2] - n.line[0], n.line[3] - n.line[1]];
    let a = fixed, b = moved;
    if ((b[0] - a[0]) * od[0] + (b[1] - a[1]) * od[1] < 0) [a, b] = [b, a];
    return { ...n, line: [a[0], a[1], b[0], b[1]] };
  });
  return customCuts(cand, height, style) ? cand : null;
}

/**
 * 선을 지워 양쪽 칸을 합친다. 양쪽이 모두 더 나뉘지 않은 칸일 때만 된다.
 * 합친 칸은 읽는 순서가 앞인 쪽 컷을 이어받고, 다른 쪽 컷 id를 removed로 돌려준다.
 */
export function removeLine(root: SplitNode, path: string): { root: SplitNode; removed: string } | { error: string } {
  let found: SplitNode | null = null;
  const findAt = (n: SplitNode, p: string) => { if (p === path) found = n; else if (!('cut' in n)) { findAt(n.a, p + 'a'); findAt(n.b, p + 'b'); } };
  findAt(root, '');
  const node = found as SplitNode | null;
  if (!node || 'cut' in node) return { error: '선을 찾지 못했어요.' };
  if (!('cut' in node.a) || !('cut' in node.b)) return { error: '이 선의 한쪽이 더 나뉘어 있어요. 안쪽 선부터 지워 주세요.' };
  const keep = node.a.cut, removed = node.b.cut;
  return { root: mapNode(root, '', path, () => ({ cut: keep })), removed };
}

/** 나눔 나무를 복사하면서 컷 id를 새로 (페이지 복제용) */
export function cloneSplit(n: SplitNode): SplitNode {
  return 'cut' in n ? { cut: newId() } : { line: [...n.line] as [number, number, number, number], a: cloneSplit(n.a), b: cloneSplit(n.b) };
}

/** 칸 수 */
export const leafCount = (n: SplitNode): number => ('cut' in n ? 1 : leafCount(n.a) + leafCount(n.b));
