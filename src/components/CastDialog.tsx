// 컷 편집에서 여는 "이 컷의 등장인물": 작품 등장인물 중 이 컷에 나올 사람을 고르고(최대 2명),
// 필요하면 그 자리에서 작품 등장인물을 추가·수정(모델·이름 등)한다.
import { useEffect, useRef, useState } from 'react';
import type { Character, SlotId } from '../scene/types';
import { CUT_LETTERS, MAX_IN_CUT } from '../scene/types';
import { CharacterEditor, modelName, useThumb } from './CharacterEditor';
import { Info } from './Info';

interface Props {
  open: boolean;
  characters: Character[];
  /** 지금 이 컷에 나오는 인물 */
  cast: SlotId[];
  onClose: () => void;
  onSave: (next: { characters: Character[]; cast: SlotId[] }) => void;
}

function CastRow({ c, order, disabled, onToggle }: { c: Character; order: number; disabled: boolean; onToggle: () => void }) {
  const checked = order >= 0;
  const thumb = useThumb(c.model);
  return (
    <label className="castpick" data-on={checked} data-off={disabled && !checked}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} />
      <span className="charpic small" data-empty={!c.model}>
        {thumb ? <img src={thumb} alt="" /> : <span aria-hidden="true">{c.slot}</span>}
      </span>
      <span className="castpick-text">
        <b>{order >= 0 && <span className="castorder">{CUT_LETTERS[order]}</span>}{c.name || c.slot}</b>
        <span className="row-desc">{c.model ? modelName(c.model) : '모델이 없어서 넣을 수 없어요 · 아래에서 모델을 넣어 주세요'}</span>
      </span>
    </label>
  );
}

export function CastDialog({ open, characters, cast, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [chars, setChars] = useState(characters);
  const [picked, setPicked] = useState<SlotId[]>(cast);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setChars(characters); setPicked(cast); setEditOpen(false); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, characters, cast]);

  // 작품 등장인물을 고치다 사람이 빠지거나 모델이 빠지면 고른 목록에서도 뺀다
  const valid = picked.filter(s => chars.some(c => c.slot === s && c.model));
  const full = valid.length >= MAX_IN_CUT;
  const toggle = (s: SlotId) => setPicked(valid.includes(s) ? valid.filter(x => x !== s) : [...valid, s]);
  const changed = JSON.stringify(valid) !== JSON.stringify(cast) || JSON.stringify(chars) !== JSON.stringify(characters);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="castDlgTitle">
      <form className="dlg" method="dialog" onSubmit={() => onSave({ characters: chars, cast: valid })}>
        <div className="dlg-head">
          <h2 id="castDlgTitle">이 컷의 등장인물</h2>
          <Info text={`한 컷에는 ${MAX_IN_CUT}명까지 나올 수 있어요. 고른 순서대로 A·B·C… 자리에 들어가요. 빼도 다른 컷에는 영향이 없어요. 인물이 많을수록 화면이 느려질 수 있어요.`} />
          <span className="spacer" />
          <span className="sub">{valid.length}/{MAX_IN_CUT}명</span>
        </div>
        <div className="castlist">
          {chars.map(c => (
            <CastRow key={c.slot} c={c} order={valid.indexOf(c.slot)} disabled={!c.model || (full && !valid.includes(c.slot))} onToggle={() => toggle(c.slot)} />
          ))}
        </div>
        <details className="fold castedit" open={editOpen} onToggle={e => setEditOpen((e.target as HTMLDetailsElement).open)}>
          <summary><h3>작품 등장인물 추가·수정</h3><span className="fold-sum">모델·이름·성별 바꾸기, 새 인물 추가</span></summary>
          <CharacterEditor characters={chars} onChange={setChars} />
          <p className="sub">여기서 고친 내용은 이 작품의 모든 화(원고)에 적용돼요.</p>
        </details>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button type="submit" className="btn primary" disabled={!changed}>적용</button>
        </div>
      </form>
    </dialog>
  );
}
