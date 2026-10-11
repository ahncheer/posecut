// 컷 편집의 "페이지·컷 미리보기": 지금 컷이 페이지 안에서 어떻게 보이는지 + 컷만 크게
import { useEffect, useRef } from 'react';
import type { Cut, FrameStyle, Page } from '../scene/types';
import { PageView } from './PageView';

interface Props {
  open: boolean;
  page: Page;
  pageNumber: number;
  cut: Cut;
  cutNumber: number;
  style: FrameStyle;
  /** 컷만 크게 그린 그림 (data URL) */
  big: string | null;
  onClose: () => void;
}

export function PreviewDialog({ open, page, pageNumber, cut, cutNumber, style, big, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const { w, h } = cut.rect;
  const shape = cut.poly ? cut.poly.map(([x, y]) => `${((x - cut.rect.x) / w) * 100}% ${((y - cut.rect.y) / h) * 100}%`).join(', ') : null;
  return (
    <dialog ref={ref} className="previewdlg" onClose={onClose} aria-labelledby="pvTitle" onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="pvTitle">미리보기</h2>
          <span className="sub">{pageNumber}페이지 · 컷 {cutNumber}</span>
          <span className="spacer" />
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="pv">
          <figure className="pv-page">
            <PageView page={page} style={style} width={300} selectedCutId={cut.id} label={`${pageNumber}페이지 미리보기`} />
            <figcaption>페이지</figcaption>
          </figure>
          <figure className="pv-cut">
            <div className="pv-cutbox" style={{ aspectRatio: `${w} / ${h}` }}>
              {big ? <img src={big} alt={`컷 ${cutNumber}`} style={shape ? { clipPath: `polygon(${shape})` } : undefined} /> : <p className="sub">인물을 넣으면 컷 그림이 보여요.</p>}
            </div>
            <figcaption>컷 {cutNumber}</figcaption>
          </figure>
        </div>
      </div>
    </dialog>
  );
}
