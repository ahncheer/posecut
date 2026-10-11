// 컷 틀 계산. 화면·저장과 무관한 순수 함수라 단위 테스트로 검사한다.
import type { Cut, FrameStyle, Format, Page, Rect, TemplateId } from './types';
import { newId } from './id';

/** 페이지 가로 길이(단위). 여백·테두리 숫자는 이 폭 기준이다 (휴대폰 화면 폭 정도). */
export const PAGE_W = 360;
/** 웹툰 컷 하나의 기본 세로 비율 (가로 대비) */
const WEBTOON_CUT_H = 0.75;
const WEBTOON_BIG_H = 1.1;

export const TEMPLATES: { id: TemplateId; label: string; cuts: number }[] = [
  { id: 'four', label: '기본 4컷', cuts: 4 },
  { id: 'three', label: '3컷', cuts: 3 },
  { id: 'bigTwo', label: '큰 컷 + 2', cuts: 3 },
  { id: 'one', label: '1컷', cuts: 1 },
];

export const DEFAULT_STYLE: FrameStyle = { gutter: 8, margin: 12, border: { width: 2, color: '#000000' } };
export const DEFAULT_PAGE_RATIO: [number, number] = [9, 19];

export function pageHeightFor(ratio: [number, number]): number {
  return Math.round((PAGE_W * ratio[1]) / ratio[0]);
}

/** 세로로 쌓인 줄을 나눈다. weights = 줄마다 높이 비율, cols = 줄마다 칸 수 */
function rows(area: Rect, gutter: number, weights: number[], cols: number[]): Rect[] {
  const totalGap = gutter * (weights.length - 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: Rect[] = [];
  let y = area.y;
  weights.forEach((wt, i) => {
    const h = ((area.h - totalGap) * wt) / sum;
    const n = cols[i];
    const w = (area.w - gutter * (n - 1)) / n;
    for (let c = 0; c < n; c++) out.push({ x: area.x + c * (w + gutter), y, w, h });
    y += h + gutter;
  });
  return out;
}

/** 페이지 만화: 정해진 페이지 안에 틀대로 나눈다 */
export function pageLayout(template: TemplateId, style: FrameStyle, ratio: [number, number]): { height: number; rects: Rect[] } {
  const height = pageHeightFor(ratio);
  const m = style.margin;
  const area = { x: m, y: m, w: PAGE_W - 2 * m, h: height - 2 * m };
  const g = style.gutter;
  const rects =
    template === 'four' ? rows(area, g, [1, 1, 1, 1], [1, 1, 1, 1])
    : template === 'three' ? rows(area, g, [1, 1, 1], [1, 1, 1])
    : template === 'bigTwo' ? rows(area, g, [2, 1], [1, 2])
    : rows(area, g, [1], [1]);
  return { height, rects };
}

/** 웹툰: 컷이 아래로 이어지고, 페이지 높이는 컷에 맞춰 늘어난다 */
export function webtoonLayout(template: TemplateId, style: FrameStyle): { height: number; rects: Rect[] } {
  const n = TEMPLATES.find(t => t.id === template)?.cuts ?? 4;
  const m = style.margin, w = PAGE_W - 2 * m;
  const heights = Array.from({ length: n }, (_, i) => w * (template === 'bigTwo' && i === 0 ? WEBTOON_BIG_H : WEBTOON_CUT_H));
  const rects: Rect[] = [];
  let y = m;
  for (const h of heights) { rects.push({ x: m, y, w, h }); y += h + style.gutter; }
  return { height: y - style.gutter + m, rects };
}

export function layout(format: Format, template: TemplateId, style: FrameStyle, ratio: [number, number]) {
  return format === 'page' ? pageLayout(template, style, ratio) : webtoonLayout(template, style);
}

const emptyCut = (rect: Rect): Cut => ({ id: newId(), rect, scene: null, thumb: null });

export function makePage(format: Format, template: TemplateId, style: FrameStyle, ratio: [number, number]): Page {
  const { height, rects } = layout(format, template, style, ratio);
  return { id: newId(), height, cuts: rects.map(emptyCut) };
}

/** 웹툰 페이지 맨 아래에 컷 하나를 더한다 (원본은 바꾸지 않음) */
export function appendWebtoonCut(page: Page, style: FrameStyle): Page {
  const m = style.margin, w = PAGE_W - 2 * m, h = w * WEBTOON_CUT_H;
  const last = page.cuts.reduce((max, c) => Math.max(max, c.rect.y + c.rect.h), m - style.gutter);
  const rect = { x: m, y: last + style.gutter, w, h };
  return { ...page, height: rect.y + h + m, cuts: [...page.cuts, emptyCut(rect)] };
}

/** 엔진에 넘길 컷 비율 [가로, 세로] — 보기 좋게 소수 한 자리 */
export function cutRatio(rect: Rect): [number, number] {
  const r = rect.w / rect.h;
  return r >= 1 ? [Math.round(r * 9 * 10) / 10, 9] : [9, Math.round((9 / r) * 10) / 10];
}

export function describeTemplate(format: Format, template: TemplateId, ratio: [number, number]): string {
  const t = TEMPLATES.find(x => x.id === template);
  return format === 'page'
    ? `${ratio[0]}:${ratio[1]} · ${t?.label ?? ''}`
    : `웹툰 세로 · ${t?.cuts ?? 0}컷으로 시작`;
}
