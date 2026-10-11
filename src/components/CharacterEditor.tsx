// 등장인물 A·B 카드: 겉에는 모델 불러오기와 미리보기만, 이름·역할·성별·나이대는 "추가 설정" 안에.
import { useEffect, useState } from 'react';
import type { AgeGroup, Character, Gender, ModelRef } from '../scene/types';
import { AGE_LABEL, GENDER_LABEL } from '../scene/types';
import { sampleAvailable, storeModelFile } from '../storage/db';
import { modelThumbnail } from '../storage/vrmThumb';
import { addCharacter, removeCharacter } from '../scene/manuscript';
import { MAX_IN_CUT } from '../scene/types';

interface Props {
  characters: Character[];
  onChange: (next: Character[]) => void;
}

export function useThumb(ref: ModelRef | null) {
  const [url, setUrl] = useState<string | null>(null);
  const key = ref ? (ref.kind === 'sample' ? 'sample' : ref.id) : '';
  useEffect(() => {
    let alive = true;
    setUrl(null);
    modelThumbnail(ref).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [key]);
  return url;
}

export const modelName = (m: ModelRef | null) => (m ? (m.kind === 'sample' ? '샘플 캐릭터' : m.name) : '');

function CharacterCard({ c, hasSample, onPatch, onRemove }: { c: Character; hasSample: boolean; onPatch: (p: Partial<Character>) => void; onRemove?: () => void }) {
  const thumb = useThumb(c.model);
  const id = `ch-${c.slot}`;
  const summary = [c.role, c.gender ? GENDER_LABEL[c.gender] : '', c.age !== 'adult' ? AGE_LABEL[c.age] : ''].filter(Boolean).join(' · ');
  return (
    <div className="grouped charcard" role="group" aria-label={`등장인물 ${c.slot}`}>
      <div className="charmain">
        <div className="charpic" data-empty={!c.model}>
          {thumb ? <img src={thumb} alt={`${c.name} 모델 미리보기`} /> : <span aria-hidden="true">{c.slot}</span>}
        </div>
        <div className="charinfo">
          <span className="charname">{c.name || c.slot}</span>
          {onRemove && (
            <button type="button" className="charremove" aria-label={`${c.name || c.slot} 삭제`} title="등장인물 삭제" onClick={onRemove}>✕</button>
          )}
          <span className="row-desc">{c.model ? modelName(c.model) : '모델 없음'}{summary ? ` · ${summary}` : ''}</span>
          <span className="charbtns">
            <label className={`btn small${c.model ? '' : ' primary'}`}>
              {c.model ? '모델 바꾸기' : 'VRM 불러오기'}
              <input
                className="vh"
                type="file"
                accept=".vrm"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) onPatch({ model: await storeModelFile(f) });
                }}
              />
            </label>
            {hasSample && c.model?.kind !== 'sample' && (
              <button type="button" className="linkbtn" onClick={() => onPatch({ model: { kind: 'sample' } })}>샘플 쓰기</button>
            )}
            {c.model && (
              <button type="button" className="linkbtn" onClick={() => onPatch({ model: null })}>모델 빼기</button>
            )}
          </span>
        </div>
      </div>
      <details className="more">
        <summary>추가 설정</summary>
        <label className="row">
          <span className="row-label">이름</span>
          <input className="rowin" type="text" value={c.name} placeholder={c.slot} onChange={e => onPatch({ name: e.target.value })} />
        </label>
        <label className="row">
          <span className="row-label">역할</span>
          <input className="rowin" type="text" value={c.role} placeholder="주인공, 조연…" onChange={e => onPatch({ role: e.target.value })} />
        </label>
        <div className="row">
          <span className="row-label" id={`${id}-g`}>성별</span>
          <span className="seg" role="radiogroup" aria-labelledby={`${id}-g`}>
            {(Object.keys(GENDER_LABEL) as Gender[]).map(g => (
              <label key={g} data-on={c.gender === g}>
                <input type="radio" name={`${id}-gender`} checked={c.gender === g} onChange={() => onPatch({ gender: g })} />
                {g === '' ? '미정' : GENDER_LABEL[g]}
              </label>
            ))}
          </span>
        </div>
        <label className="row">
          <span className="row-label">나이대</span>
          <select className="rowin" value={c.age} onChange={e => onPatch({ age: e.target.value as AgeGroup })}>
            {(Object.keys(AGE_LABEL) as AgeGroup[]).map(a => <option key={a} value={a}>{AGE_LABEL[a]}</option>)}
          </select>
        </label>
      </details>
    </div>
  );
}

export function CharacterEditor({ characters, onChange }: Props) {
  const [hasSample, setHasSample] = useState(false);
  useEffect(() => { sampleAvailable().then(setHasSample); }, []);
  const patch = (i: number, p: Partial<Character>) => onChange(characters.map((c, j) => (j === i ? { ...c, ...p } : c)));
  return (
    <div className="chargrid">
      {characters.map((c, i) => (
        <CharacterCard
          key={c.slot}
          c={c}
          hasSample={hasSample}
          onPatch={p => patch(i, p)}
          onRemove={characters.length > 1 ? () => {
            if (!c.model || confirm(`${c.name || c.slot}을(를) 등장인물에서 뺄까요?`)) onChange(removeCharacter(characters, c.slot));
          } : undefined}
        />
      ))}
      <button type="button" className="charadd" onClick={() => onChange(addCharacter(characters))}>
        <span aria-hidden="true">＋</span> 등장인물 추가
        {characters.length >= 3 && <small>컷마다 나올 인물은 컷 편집에서 골라요 (한 컷에 {MAX_IN_CUT}명까지)</small>}
      </button>
    </div>
  );
}
