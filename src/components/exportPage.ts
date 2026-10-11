// 화면에 그린 페이지(SVG)를 PNG로 저장. 컷 그림은 원고 화면용 작은 그림이라 "미리보기 화질"이다.
export async function exportSvgAsPng(svg: SVGSVGElement, fileName: string, scale = 3): Promise<void> {
  const vb = svg.viewBox.baseVal;
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('그림을 만들지 못했어요.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vb.width * scale);
    canvas.height = Math.round(vb.height * scale);
    const g = canvas.getContext('2d')!;
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('그림을 만들지 못했어요.');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
