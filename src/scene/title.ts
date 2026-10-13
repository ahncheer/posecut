// 페이지 제목: 제목 자리만큼 컷 칸을 줄이고(위 또는 오른쪽), 바뀌면 컷을 다시 배치한다.
import type { FrameStyle, Manuscript, Page, PageTitle, SplitNode, TitlePos } from './types';
import { PAGE_W, pageHeightFor, pageLayout, templateOf } from './layout';
import { applySplit } from './split';

/** 제목 글꼴 (모두 상업적 사용 가능한 OFL 무료 글꼴, 컷 편집 말풍선과 같은 목록) */
export const TITLE_FONTS: [string, string][] = [
  ['Noto Sans KR', '기본 고딕'], ['Gowun Dodum', '부드러운 고딕'], ['Nanum Myeongjo', '명조'], ['Jua', '둥글둥글'],
  ['Do Hyeon', '각진 굵은 글씨'], ['Black Han Sans', '아주 굵게'], ['Gaegu', '손글씨'], ['Nanum Pen Script', '펜글씨'],
  ['Hi Melody', '귀여운 손글씨'], ['East Sea Dokdo', '거친 붓글씨'],
];
export const TITLE_POS: [TitlePos, string, string][] = [
  ['top-center', '위 가운데', '컷 위 여백 가운데 (치이카와처럼 4컷 위에 제목)'],
  ['top-left', '위 왼쪽', '컷 위 여백 왼쪽 (피크민 가든처럼 제목을 왼쪽 위에)'],
  ['top-right', '위 오른쪽', '컷 위 여백 오른쪽'],
  ['band', '위 색 띠', '위쪽에 색 띠를 깔고 흰 글씨로'],
  ['side', '오른쪽 세로', '일본 4컷 만화처럼 컷 오른쪽에 세로로'],
  ['in-cut', '첫 컷 안', '자리를 따로 비우지 않고 첫 컷 왼쪽 위에 이름표처럼'],
];
export const TITLE_SIZES: [number, string][] = [[13, '작게'], [17, '보통'], [22, '크게'], [28, '아주 크게']];
export const DEFAULT_TITLE: PageTitle = { text: '', pos: 'top-center', font: 'Jua', size: 17, color: '#111111' };

/** 제목 때문에 비우는 칸 (위, 오른쪽) */
export function titleReserve(t: PageTitle | undefined): { top: number; right: number } {
  if (!t) return { top: 0, right: 0 };
  if (t.pos === 'in-cut') return { top: 0, right: 0 };
  if (t.pos === 'side') return { top: 0, right: Math.round(t.size * 1.5) };
  if (t.pos === 'band') return { top: Math.round(t.size * 2), right: 0 };
  return { top: Math.round(t.size * 1.7), right: 0 };
}

/** 이 페이지를 그릴 때 쓰는 틀 모양 (제목 자리만큼 안쪽 칸이 줄어든 것) */
export function pageStyle(style: FrameStyle, page: Pick<Page, 'title'> | undefined): FrameStyle {
  const r = titleReserve(page?.title);
  if (!r.top && !r.right) return style;
  return { ...style, padTop: r.top, padRight: r.right };
}

/** 안쪽 칸이 바뀌면 직접 그린 선도 같은 비율로 옮긴다 */
function mapSplit(n: SplitNode, fx: (x: number) => number, fy: (y: number) => number): SplitNode {
  if ('cut' in n) return n;
  const [x1, y1, x2, y2] = n.line;
  return { line: [fx(x1), fy(y1), fx(x2), fy(y2)], a: mapSplit(n.a, fx, fy), b: mapSplit(n.b, fx, fy) };
}

/** 페이지 제목을 바꾸고, 제목 자리가 달라졌으면 컷을 다시 배치한다 (장면·컷 id는 그대로) */
export function setTitleOnPage(page: Page, title: PageTitle | undefined, m: Pick<Manuscript, 'style' | 'template' | 'pageRatio'>): Page {
  const next: Page = { ...page };
  if (title) next.title = title; else delete next.title;
  const before = titleReserve(page.title), after = titleReserve(next.title);
  if (before.top === after.top && before.right === after.right) return next;
  const oldS = pageStyle(m.style, page), newS = pageStyle(m.style, next);
  const height = pageHeightFor(m.pageRatio), mg = m.style.margin;
  if (page.split) {
    const ox0 = mg, ox1 = PAGE_W - mg - (oldS.padRight ?? 0), nx1 = PAGE_W - mg - (newS.padRight ?? 0);
    const oy0 = mg + (oldS.padTop ?? 0), ny0 = mg + (newS.padTop ?? 0), y1 = height - mg;
    const fx = (x: number) => ox0 + ((x - ox0) * (nx1 - ox0)) / (ox1 - ox0);
    const fy = (y: number) => ny0 + ((y - oy0) * (y1 - ny0)) / (y1 - oy0);
    const moved = applySplit(next, mapSplit(page.split, fx, fy), newS, m.pageRatio);
    if (moved) return moved;
    return { ...page }; // 칸이 너무 작아져서 못 바꿈 → 그대로
  }
  const { rects } = pageLayout(templateOf(page, m.template), newS, m.pageRatio);
  if (rects.length !== page.cuts.length) return next;
  return { ...next, cuts: page.cuts.map((c, i) => ({ ...c, rect: rects[i] })) };
}

/** 여러 페이지에 제목 넣기/빼기. text는 지금 페이지(또는 아직 제목 글자가 없는 페이지)에만 넣는다 */
export function applyTitle(m: Manuscript, pageIndexes: number[], current: number, title: PageTitle | null): Manuscript {
  const pick = new Set(pageIndexes);
  return {
    ...m,
    pages: m.pages.map((p, i) => {
      if (!pick.has(i)) return p;
      if (!title) return setTitleOnPage(p, undefined, m);
      const text = i === current || !p.title?.text ? title.text : p.title.text;
      return setTitleOnPage(p, { ...title, text }, m);
    }),
  };
}


/**
 * 원고 전체의 페이지 비율 바꾸기 (페이지 만화만). 가로는 그대로, 세로를 새 높이에 맞춰 칸을 늘이거나 줄인다.
 * 직접 그린 선도 같은 비율로 옮기고, 장면·컷 id·제목은 그대로. 장면이 있는 컷은 작은 그림을 다시 그리게 비운다.
 */
export function changePageRatio(m: Manuscript, ratio: [number, number]): Manuscript {
  if (m.format !== 'page') return m;
  const r: [number, number] = [ratio[0], ratio[1]];
  const oldH = pageHeightFor(m.pageRatio), newH = pageHeightFor(r);
  if (oldH === newH) return { ...m, pageRatio: r };
  const mg = m.style.margin;
  const pages = m.pages.map(p => {
    const st = pageStyle(m.style, p), y0 = mg + (st.padTop ?? 0);
    // 안쪽 칸 위쪽(제목 자리 아래)은 그대로 두고, 아래쪽 끝만 새 높이로
    const fy = (y: number) => y0 + ((y - y0) * (newH - mg - y0)) / Math.max(1, oldH - mg - y0);
    let out: Page | null = null;
    if (p.split) out = applySplit(p, mapSplit(p.split, x => x, fy), st, r);
    else {
      const { height, rects } = pageLayout(templateOf(p, m.template), st, r);
      if (rects.length === p.cuts.length) out = { ...p, height, cuts: p.cuts.map((c, i) => ({ ...c, rect: rects[i] })) };
    }
    // 틀로 다시 못 만들면(칸이 너무 작아지는 등) 칸 위치를 그대로 늘인다
    if (!out) {
      out = {
        ...p, height: newH,
        cuts: p.cuts.map(c => {
          const top = fy(c.rect.y), bottom = fy(c.rect.y + c.rect.h);
          return { ...c, rect: { ...c.rect, y: top, h: bottom - top }, ...(c.poly ? { poly: c.poly.map(([x, y]) => [x, fy(y)] as [number, number]) } : {}) };
        }),
      };
    }
    return { ...out, cuts: out.cuts.map(c => (c.scene ? { ...c, thumb: null } : c)) };
  });
  return { ...m, pageRatio: r, pages };
}
