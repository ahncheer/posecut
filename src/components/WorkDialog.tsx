// 원고 화면에서 여는 작품 설정 (세계관·등장인물 수정)
import { useEffect, useRef, useState } from 'react';
import type { Work } from '../scene/types';
import { CharacterEditor } from './CharacterEditor';

interface Props {
  work: Work;
  open: boolean;
  onClose: () => void;
  onSave: (w: Work) => void;
}

export function WorkDialog({ work, open, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(work);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setDraft(work); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, work]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="workDlgTitle">
      <form className="dlg" method="dialog" onSubmit={() => onSave(draft)}>
        <h2 id="workDlgTitle">작품 설정</h2>
        <label className="field">작품 제목<input type="text" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="field">시대·장소·분위기<textarea rows={2} value={draft.world} onChange={e => setDraft({ ...draft, world: e.target.value })} /></label>
        <h3>등장인물</h3>
        <CharacterEditor characters={draft.characters} onChange={characters => setDraft({ ...draft, characters })} />
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button type="submit" className="btn primary">저장</button>
        </div>
      </form>
    </dialog>
  );
}
