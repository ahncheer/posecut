// 화면에 그린 페이지(SVG)를 PNG로 저장. 고화질로 다시 그린 컷 그림(images)을 주면 작은 그림 대신 넣는다.
/**
 * images: 컷 id → 고화질 그림(data URL). 주면 작은 그림 대신 그 그림을 넣는다 (작은 그림이 없던 컷도).
 */
export async function exportSvgAsPng(svg: SVGSVGElement, fileName: string, scale = 3, images: Record<string, string> = {}): Promise<void> {
  downloadBlob(await svgToPngBlob(svg, scale, images), fileName);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** 페이지 SVG → PNG Blob (scale배 크기) */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 3, images: Record<string, string> = {}): Promise<Blob> {
  const vb = svg.viewBox.baseVal;
  // 제목 글자는 웹 글꼴이라 SVG 그림 안에서는 안 보일 수 있어서, 빼고 그린 뒤 캔버스에 같은 글꼴로 다시 쓴다
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const titles = [...svg.querySelectorAll<SVGTextElement>('text.pgtitle-t')].map(t => ({
    text: t.textContent ?? '', x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')),
    size: Number(t.getAttribute('font-size')), font: t.dataset.font || 'Noto Sans KR', fill: t.getAttribute('fill') || '#111',
    anchor: t.getAttribute('text-anchor') || 'start', alpha: Number(t.getAttribute('opacity') ?? 1),
  }));
  clone.querySelectorAll('text.pgtitle-t').forEach(t => t.remove());
  // 화면용 표시(고른 컷 테두리, '장면 만들기' 안내)는 저장 그림에서 뺀다
  clone.querySelectorAll('.selmark, text.hint').forEach(t => t.remove());
  for (const [id, url] of Object.entries(images)) {
    const g = clone.querySelector<SVGGElement>(`g[data-cut="${CSS.escape(id)}"]`);
    if (!g) continue;
    let im = g.querySelector<SVGImageElement>('image[data-cutimg]');
    if (!im) {
      const [x, y, w, h] = (g.dataset.rect ?? '0,0,0,0').split(',').map(Number);
      im = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      im.setAttribute('x', String(x)); im.setAttribute('y', String(y)); im.setAttribute('width', String(w)); im.setAttribute('height', String(h));
      im.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      if (g.dataset.clip) im.setAttribute('clip-path', `url(#${g.dataset.clip})`);
      const fillShape = g.querySelector('path[fill="#F8F7F2"], rect[fill="#F8F7F2"]');
      if (fillShape) fillShape.after(im); else g.prepend(im);
    }
    im.setAttribute('href', url);
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('그림을 만들지 못했어요.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vb.width * scale);
    canvas.height = Math.round(vb.height * scale);
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const t of titles) {
      const css = `${t.size * scale}px "${t.font}", "Noto Sans KR", sans-serif`;
      try { await document.fonts.load(css, t.text); } catch { /* 글꼴을 못 받으면 기본 글꼴로 */ }
      g.save();
      g.font = css; g.fillStyle = t.fill; g.globalAlpha = t.alpha; g.textBaseline = 'middle';
      g.textAlign = t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left';
      g.fillText(t.text, t.x * scale, t.y * scale);
      g.restore();
    }
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('그림을 만들지 못했어요.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
