// 내보내기 창: 이 페이지 그림(PNG) · 원고 전체 그림(ZIP) · 원고 파일(JSON)
import { useEffect, useRef, useState } from 'react';

export type ExportKind = 'pagePng' | 'allPng' | 'file';
export interface ExportOptions { width: number; numbers: boolean }

interface Props {
  open: boolean;
  pageNumber: number;
  pageCount: number;
  onClose: () => void;
  onExport: (kind: ExportKind, opt: ExportOptions) => void;
  /** 그리는 중이면 진행 상황 글자 */
  busy?: string;
}

export function ExportDialog({ open, pageNumber, pageCount, onClose, onExport, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ExportKind>('pagePng');
  const [width, setWidth] = useState(1440);
  const [numbers, setNumbers] = useState(true);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const choice = (k: ExportKind, label: string, desc: string) => (
    <div className="row">
      <label className="row-choice">
        <input type="radio" name="exportKind" checked={kind === k} onChange={() => setKind(k)} disabled={!!busy} />
        <span className="row-text"><span className="row-label">{label}</span><span className="row-desc">{desc}</span></span>
      </label>
    </div>
  );
  const png = kind !== 'file';
  return (
    <dialog ref={ref} onClose={onClose} onCancel={e => { if (busy) e.preventDefault(); }} aria-labelledby="expTitle" className="dlg-narrow">
      <form className="dlg" method="dialog" onSubmit={e => { e.preventDefault(); if (!busy) onExport(kind, { width, numbers }); }}>
        <h2 className="sect-title" id="expTitle">내보내기</h2>
        <div className="grouped" role="radiogroup" aria-labelledby="expTitle">
          {choice('pagePng', `${pageNumber}페이지 그림 (PNG)`, '테두리·여백·말풍선 포함 · 컷마다 크게 다시 그려서 합쳐요')}
          {choice('allPng', `원고 전체 그림 (${pageCount}페이지, ZIP)`, '페이지마다 PNG 한 장씩 묶어서 · 컷이 많으면 몇 분 걸려요')}
          {choice('file', '원고 파일 (.rough.json)', '원고 전체(페이지·컷·장면·제목)를 파일 하나로 · "불러오기"나 다른 컴퓨터에서 이어서 작업 · 모델 파일은 빠져요')}
        </div>
        {png && (
          <div className="expopts">
            <label htmlFor="expWidth">크기</label>
            <select id="expWidth" value={width} onChange={e => setWidth(Number(e.target.value))} disabled={!!busy}>
              <option value={1080}>가로 1080px (보통)</option>
              <option value={1440}>가로 1440px (고화질)</option>
              <option value={2160}>가로 2160px (인쇄용 · 오래 걸려요)</option>
            </select>
            <label className="check expnum"><input type="checkbox" checked={numbers} onChange={e => setNumbers(e.target.checked)} disabled={!!busy} />컷 번호 넣기</label>
          </div>
        )}
        <div className="actions">
          {busy && <span className="sub exp-busy" role="status">{busy}</span>}
          <button type="button" className="btn" onClick={onClose} disabled={!!busy}>취소</button>
          <button type="submit" className="btn primary" disabled={!!busy}>{busy ? '만드는 중…' : '내보내기'}</button>
        </div>
      </form>
    </dialog>
  );
}
