// 새 원고: 1단계 원고 틀 → 2단계 작품 설정 → 만들기
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { HomeLayout } from '../components/HomeLayout';
import { PageView } from '../components/PageView';
import { CharacterEditor } from '../components/CharacterEditor';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE, TEMPLATES, describeTemplate, makePage } from '../scene/layout';
import { newManuscript, newWork, nextTempName } from '../scene/manuscript';
import type { Format, FrameStyle, TemplateId, Work } from '../scene/types';
import { db, sampleAvailable, saveManuscript, saveWork } from '../storage/db';

const clampNum = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0));

export function NewManuscriptPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [format, setFormat] = useState<Format>('page');
  const [template, setTemplate] = useState<TemplateId>('four');
  const [style, setStyle] = useState<FrameStyle>(DEFAULT_STYLE);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [draft, setDraft] = useState<Work>(() => newWork());
  const [existingId, setExistingId] = useState('');
  const [title, setTitle] = useState('');
  const works = useLiveQuery(() => db.works.orderBy('updatedAt').reverse().toArray(), []);

  // 샘플 파일이 없으면 A의 기본 모델을 비운다
  useEffect(() => {
    sampleAvailable().then(ok => {
      if (!ok) setDraft(w => ({ ...w, characters: w.characters.map(c => (c.model?.kind === 'sample' ? { ...c, model: null } : c)) }));
    });
  }, []);

  const preview = useMemo(() => makePage(format, template, style, DEFAULT_PAGE_RATIO), [format, template, style]);
  const existing = works?.find(w => w.id === existingId) ?? null;
  const autoWorkTitle = nextTempName(works?.map(w => w.title) ?? []);

  /** quick = 작품 설정을 건너뛰고 임시 작품으로 바로 만들기. 제목·설명은 나중에 원고 화면 "작품 설정"에서 */
  async function create(quick = false) {
    let work: Work;
    if (!quick && mode === 'existing' && existing) work = existing;
    else {
      const base = quick ? { ...newWork(), characters: draft.characters } : draft;
      const allTitles = (await db.works.toArray()).map(w => w.title);
      work = { ...base, title: base.title.trim() || nextTempName(allTitles) };
      await saveWork(work);
    }
    const count = (await db.manuscripts.where('workId').equals(work.id).count()) + 1;
    const m = newManuscript({ title: (quick ? '' : title.trim()) || `${count}화`, work, format, template, style, pageRatio: DEFAULT_PAGE_RATIO });
    await saveManuscript(m);
    navigate(`/m/${m.id}`);
  }

  return (
    <HomeLayout>
      <section className="panel">
        <div className="steps" aria-label="단계">
          {step === 1 ? <b>1. 원고 틀</b> : <span>1. 원고 틀</span>}<span aria-hidden="true">›</span>
          {step === 2 ? <b>2. 작품 설정</b> : <span>2. 작품 설정</span>}
        </div>

        {step === 1 && (
          <div className="wizard">
            <div style={{ display: 'grid', gap: 16 }}>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                <legend><h2>형식</h2></legend>
                <div className="choices">
                  <button type="button" className="choice" aria-pressed={format === 'page'} onClick={() => setFormat('page')}>
                    <b>페이지 만화</b><small>정해진 페이지 안에 컷 배치</small>
                  </button>
                  <button type="button" className="choice" aria-pressed={format === 'webtoon'} onClick={() => setFormat('webtoon')}>
                    <b>웹툰 세로</b><small>컷이 아래로 계속 이어짐</small>
                  </button>
                </div>
              </fieldset>
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                <legend><h2>컷 틀</h2></legend>
                <div className="choices">
                  {TEMPLATES.map(t => (
                    <button key={t.id} type="button" className="choice" aria-pressed={template === t.id} onClick={() => setTemplate(t.id)}>
                      <b>{t.label}</b>
                    </button>
                  ))}
                  <button type="button" className="choice" disabled title="다음 단계에서 만들어요">
                    <b>✎ 직접 그리기</b><small>준비 중</small>
                  </button>
                </div>
              </fieldset>
              <div style={{ display: 'grid', gap: 8 }}>
                <h2>여백과 테두리</h2>
                <div className="nums">
                  <label className="field">컷 사이 여백<input type="number" min={0} max={40} value={style.gutter} onChange={e => setStyle({ ...style, gutter: clampNum(e.target.value, 0, 40) })} /></label>
                  <label className="field">바깥 여백<input type="number" min={0} max={60} value={style.margin} onChange={e => setStyle({ ...style, margin: clampNum(e.target.value, 0, 60) })} /></label>
                  <label className="field">테두리 굵기<input type="number" min={0} max={10} value={style.border.width} onChange={e => setStyle({ ...style, border: { ...style.border, width: clampNum(e.target.value, 0, 10) } })} /></label>
                </div>
                <p className="sub">처음 고른 틀은 나중에 바꿀 수 없어요. 테두리 굵기·색은 원고 화면에서도 고칠 수 있어요.</p>
              </div>
              <div className="actions">
                <button type="button" className="btn" onClick={() => create(true)} title="작품 이름은 임시 이름으로 정하고, 제목·설명·등장인물은 나중에 적어요">설정 건너뛰고 바로 만들기</button>
                <button type="button" className="btn primary" onClick={() => setStep(2)}>다음: 작품 설정</button>
              </div>
              <p className="sub" style={{ textAlign: 'right' }}>건너뛰면 작품 이름이 "{autoWorkTitle}"처럼 자동으로 붙어요. 원고 화면의 "작품 설정"에서 언제든 바꿀 수 있어요.</p>
            </div>
            <div className="preview">
              <h3>미리보기</h3>
              <PageView page={preview} style={style} width={format === 'page' ? 180 : 200} showNumbers={false} label="원고 틀 미리보기" />
              <p className="sub">{describeTemplate(format, template, DEFAULT_PAGE_RATIO)}</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'grid', gap: 16 }}>
            <label className="field">원고 제목 (비우면 "n화")<input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="비워 두면 1화, 2화…" /></label>
            <div className="choices">
              <button type="button" className="choice" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>
                <b>새 작품 만들기</b><small>세계관과 등장인물을 새로 입력해요</small>
              </button>
              <button type="button" className="choice" aria-pressed={mode === 'existing'} disabled={!works?.length} onClick={() => { setMode('existing'); if (!existingId && works?.[0]) setExistingId(works[0].id); }}>
                <b>기존 작품 이어서</b><small>{works?.length ? '세계관과 등장인물이 자동으로 채워져요' : '아직 만든 작품이 없어요'}</small>
              </button>
            </div>

            {mode === 'existing' && works && (
              <label className="field">작품
                <select value={existingId} onChange={e => setExistingId(e.target.value)}>
                  {works.map(w => <option key={w.id} value={w.id}>{w.title || '작품 이름 없음'}</option>)}
                </select>
              </label>
            )}

            {mode === 'new' && (
              <>
                <div style={{ display: 'grid', gap: 8 }}>
                  <h2>세계관 <small className="sub">모두 비워도 돼요 · 나중에 적기</small></h2>
                  <label className="field">작품 제목<input type="text" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder={`비워 두면 "${autoWorkTitle}"`} /></label>
                  <label className="field">시대·장소·분위기<textarea rows={2} value={draft.world} onChange={e => setDraft({ ...draft, world: e.target.value })} placeholder="예: 현대 한국, 대학가 골목의 작은 카페. 잔잔하고 따뜻한 일상물" /></label>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <h2>등장인물</h2>
                  <CharacterEditor characters={draft.characters} onChange={characters => setDraft({ ...draft, characters })} />
                </div>
              </>
            )}

            <div className="actions">
              <button type="button" className="btn" onClick={() => setStep(1)}>이전</button>
              <button type="button" className="btn primary" onClick={() => create()} disabled={mode === 'existing' && !existing}>만들기</button>
            </div>
          </div>
        )}
      </section>
    </HomeLayout>
  );
}
