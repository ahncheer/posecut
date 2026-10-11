// 페이지 추가 / 틀 바꾸기 창. 틀을 바꿀 때 사라질 장면 수를 미리 알려준다.
import { useEffect, useRef, useState } from 'react';
import type { FrameStyle, TemplateId } from '../scene/types';
import { TemplatePicker } from './TemplatePicker';

interface Props {
  open: boolean;
  mode: 'add' | 'change';
  pageNumber: number;
  initial: TemplateId;
  style: FrameStyle;
  ratio: [number, number];
  /** 틀 바꾸기에서, 고른 틀이면 사라질 장면 수 */
  lostFor?: (t: TemplateId) => number;
  onClose: () => void;
  onConfirm: (t: TemplateId) => void;
}

export function PageTemplateDialog({ open, mode, pageNumber, initial, style, ratio, lostFor, onClose, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setValue(initial); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, initial]);

  const lost = mode === 'change' && lostFor ? lostFor(value) : 0;
  const same = mode === 'change' && value === initial;

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="ptdTitle">
      <form className="dlg" method="dialog" onSubmit={e => { e.preventDefault(); if (!same) onConfirm(value); }}>
        <h2 className="sect-title" id="ptdTitle">{mode === 'add' ? `${pageNumber}페이지 추가` : `${pageNumber}페이지 컷 틀 바꾸기`}</h2>
        <TemplatePicker name="pageTemplate" format="page" style={style} ratio={ratio} value={value} onChange={setValue} labelledBy="ptdTitle" showDraw={mode === 'add'} />
        {mode === 'add' && value === 'custom' && <p className="sect-note">추가하면 바로 선을 그어 컷을 나누는 창이 열려요. 앞에 직접 그린 페이지가 있으면 그 모양에서 시작해요.</p>}
        {mode === 'change' && (
          <p className="sect-note" role="status" style={lost ? { color: 'var(--danger)' } : undefined}>
            {same ? '지금 틀이에요.' : lost ? `컷이 모자라서 뒤쪽 장면 ${lost}개가 사라져요. 되돌릴 수 없어요.` : '장면은 앞 컷부터 차례로 옮겨져요.'}
          </p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button type="submit" className={`btn ${lost ? 'danger' : 'primary'}`} disabled={same}>
            {mode === 'add' ? '추가' : lost ? `장면 ${lost}개 지우고 바꾸기` : '바꾸기'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
