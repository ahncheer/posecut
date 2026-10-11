// 등장인물 A·B: 이름, 역할, 성별·나이대(레퍼런스 검색어에 쓰임), 모델.
import { useEffect, useState } from 'react';
import type { AgeGroup, Character, Gender } from '../scene/types';
import { AGE_LABEL, GENDER_LABEL } from '../scene/types';
import { sampleAvailable, storeModelFile } from '../storage/db';

interface Props {
  characters: Character[];
  onChange: (next: Character[]) => void;
}

export function CharacterEditor({ characters, onChange }: Props) {
  const [hasSample, setHasSample] = useState<boolean | null>(null);
  useEffect(() => { sampleAvailable().then(setHasSample); }, []);

  const patch = (i: number, p: Partial<Character>) => onChange(characters.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {characters.map((c, i) => (
        <div className="charrow" key={c.slot}>
          <span className="avatar" aria-hidden="true">{c.slot}</span>
          <label className="field">이름<input type="text" value={c.name} onChange={e => patch(i, { name: e.target.value })} /></label>
          <label className="field">역할<input type="text" value={c.role} placeholder="주인공, 조연…" onChange={e => patch(i, { role: e.target.value })} /></label>
          <label className="field">성별
            <select value={c.gender} onChange={e => patch(i, { gender: e.target.value as Gender })}>
              {(Object.keys(GENDER_LABEL) as Gender[]).map(g => <option key={g} value={g}>{GENDER_LABEL[g]}</option>)}
            </select>
          </label>
          <label className="field">나이대
            <select value={c.age} onChange={e => patch(i, { age: e.target.value as AgeGroup })}>
              {(Object.keys(AGE_LABEL) as AgeGroup[]).map(a => <option key={a} value={a}>{AGE_LABEL[a]}</option>)}
            </select>
          </label>
          <div className="model">
            <span>모델: <b>{c.model ? (c.model.kind === 'sample' ? '샘플 캐릭터' : c.model.name) : '없음'}</b></span>
            <label className="btn small">
              VRM 파일로 {c.model ? '교체' : '추가'}
              <input
                className="vh"
                type="file"
                accept=".vrm"
                onChange={async e => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) patch(i, { model: await storeModelFile(f) });
                }}
              />
            </label>
            {hasSample && c.model?.kind !== 'sample' && (
              <button type="button" className="btn small ghost" onClick={() => patch(i, { model: { kind: 'sample' } })}>샘플 캐릭터에서 고르기</button>
            )}
            {c.slot === 'B' && c.model && (
              <button type="button" className="btn small ghost" onClick={() => patch(i, { model: null })}>B 빼기</button>
            )}
          </div>
        </div>
      ))}
      <p className="sub">모델을 바꾸면 그 인물이 나오는 모든 컷에 반영돼요. 성별·나이대는 비슷한 포즈 레퍼런스를 찾을 때 검색어에 쓰여요.</p>
      {hasSample === false && <p className="sub">샘플 캐릭터 파일이 없어서 VRM 파일로만 넣을 수 있어요.</p>}
    </div>
  );
}
