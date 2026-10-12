// 원고 페이지를 고화질 PNG로: 컷마다 보이지 않는 엔진으로 크게 다시 그린 뒤, 페이지 SVG(PageView)에 끼워 합친다.
// 한 페이지 내보내기와 원고 전체(ZIP) 내보내기가 같이 쓴다.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Character, Manuscript } from '../scene/types';
import { PAGE_W } from '../scene/layout';
import { withHiddenEngine } from '../engine/hiddenEngine';
import { loadCutIntoEngine } from '../engine/loadCut';
import { PageView } from './PageView';
import { svgToPngBlob } from './exportPage';

/** 한 페이지 → PNG Blob. width = 페이지 가로 픽셀, numbers = 컷 번호 넣기. progress(그린 컷 수, 전체 컷 수) */
export async function renderPagePng(m: Manuscript, characters: Character[], pageIndex: number, opt: { width: number; numbers: boolean }, progress?: (done: number, total: number) => void): Promise<Blob> {
  const { width, numbers } = opt;
  const page = m.pages[pageIndex];
  const scale = width / PAGE_W, images: Record<string, string> = {};
  const targets = page.cuts.filter(c => c.scene || c.plan);
  for (const [i, c] of targets.entries()) {
    progress?.(i, targets.length);
    try {
      const url = await withHiddenEngine(async eng => {
        if (!(await loadCutIntoEngine(eng, m, characters, c.id))) return null;
        await new Promise(r => setTimeout(r, 150)); // 머리카락·옷 흔들림이 자리 잡게
        return eng.render ? eng.render(Math.round(c.rect.w * scale)) : eng.thumbnail(Math.round(c.rect.w * scale));
      });
      if (url) images[c.id] = url;
    } catch { /* 그 컷은 작은 그림으로 */ }
  }
  progress?.(targets.length, targets.length);
  // 화면에 없는 페이지도 그릴 수 있게 보이지 않는 곳에 PageView를 잠깐 그린다
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(PageView, { page, style: m.style, width: PAGE_W, showNumbers: numbers, label: `${pageIndex + 1}페이지` })));
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('페이지를 그리지 못했어요.');
    return await svgToPngBlob(svg, scale, images);
  } finally {
    root.unmount();
    host.remove();
  }
}
