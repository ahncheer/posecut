// 내보내기 창: 지금 페이지 그림(PNG) 또는 원고 파일(JSON)
import { useEffect, useRef, useState } from 'react';

export type ExportKind = 'pagePng' | 'file';

interface Props {
  open: boolean;
  pageNumber: number;
  onClose: () => void;
  /** width: 페이지 그림 가로 픽셀 */
  onExport: (kind: ExportKind, width: number) => void;
  /** 고화질로 그리는 중이면 진행 상황 글자 */
  busy?: string;
}

export function ExportDialog({ open, pageNumber, onClose, onExport, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ExportKind>('pagePng');
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="expTitle" className="dlg-narrow">
      <form className="dlg" method="dialog" onSubmit={e => { e.preventDefault(); if (!busy) onExport(kind, width); }}>
        <h2 className="sect-title" id="expTitle">내보내기</h2>
        <div className="grouped" role="radiogroup" aria-labelledby="expTitle">
          <div className="row">
            <label className="row-choice">
              <input type="radio" name="exportKind" checked={kind === 'pagePng'} onChange={() => setKind('pagePng')} />
              <span className="row-text"><span className="row-label">{pageNumber}페이지 그림 (PNG)</span><span className="row-desc">테두리·여백·말풍선 포함 · 컷마다 크게 다시 그려서 합쳐요</span></span>
            </label>
          </div>
          {kind === 'pagePng' && (
            <div className="row">
              <label className="row-choice" htmlFor="expWidth">
                <span className="row-text"><span className="row-label">크기</span><span className="row-desc">가로 픽셀 · 클수록 오래 걸려요</span></span>
              </label>
              <select id="expWidth" value={width} onChange={e => setWidth(Number(e.target.value))}>
                <option value={1080}>1080px (보통)</option>
                <option value={1440}>1440px (고화질)</option>
                <option value={2160}>2160px (인쇄용)</option>
              </select>
            </div>
          )}
          <div className="row">
            <label className="row-choice">
              <input type="radio" name="exportKind" checked={kind === 'file'} onChange={() => setKind('file')} />
              <span className="row-text"><span className="row-label">원고 파일 (.json)</span><span className="row-desc">다른 컴퓨터에서 "파일에서 열기"로 이어서 작업 · 모델 파일은 빠져요</span></span>
            </label>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          {busy && <span className="sub" role="status">{busy}</span>}
          <button type="submit" className="btn primary" disabled={!!busy}>{busy ? '그리는 중…' : '내보내기'}</button>
        </div>
      </form>
    </dialog>
  );
}
