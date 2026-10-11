// 내보내기 창: 지금 페이지 그림(PNG) 또는 원고 파일(JSON)
import { useEffect, useRef, useState } from 'react';

export type ExportKind = 'pagePng' | 'file';

interface Props {
  open: boolean;
  pageNumber: number;
  onClose: () => void;
  onExport: (kind: ExportKind) => void;
}

export function ExportDialog({ open, pageNumber, onClose, onExport }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ExportKind>('pagePng');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="expTitle" className="dlg-narrow">
      <form className="dlg" method="dialog" onSubmit={e => { e.preventDefault(); onExport(kind); }}>
        <h2 className="sect-title" id="expTitle">내보내기</h2>
        <div className="grouped" role="radiogroup" aria-labelledby="expTitle">
          <div className="row">
            <label className="row-choice">
              <input type="radio" name="exportKind" checked={kind === 'pagePng'} onChange={() => setKind('pagePng')} />
              <span className="row-text"><span className="row-label">{pageNumber}페이지 그림 (PNG)</span><span className="row-desc">테두리·여백 포함 · 지금은 미리보기 화질</span></span>
            </label>
          </div>
          <div className="row">
            <label className="row-choice">
              <input type="radio" name="exportKind" checked={kind === 'file'} onChange={() => setKind('file')} />
              <span className="row-text"><span className="row-label">원고 파일 (.json)</span><span className="row-desc">다른 컴퓨터에서 "파일에서 열기"로 이어서 작업 · 모델 파일은 빠져요</span></span>
            </label>
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button type="submit" className="btn primary">내보내기</button>
        </div>
      </form>
    </dialog>
  );
}
