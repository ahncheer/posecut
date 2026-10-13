// 새 원고: ① 작품 설정(작품 제목·작품 설명·등장인물) → ② 원고 틀 → 만들기. 원고 이름은 그 작품의 n화로 자동
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { HomeLayout } from '../components/HomeLayout';
import { PageView } from '../components/PageView';
import { CharacterEditor } from '../components/CharacterEditor';
import { TemplatePicker } from '../components/TemplatePicker';
import { Stepper } from '../components/Stepper';
import { Info } from '../components/Info';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE, describeTemplate, makePage } from '../scene/layout';
import { applySplit } from '../scene/split';
import { CutDrawDialog } from '../components/CutDrawDialog';
import { newManuscript, newWork, nextEpisodeTitle, nextTempName, resolveTitle } from '../scene/manuscript';
import type { Format, FrameStyle, SplitNode, TemplateId, Work } from '../scene/types';
import { db, sampleAvailable, saveManuscript, saveWork } from '../storage/db';

const clampNum = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(v) || 0));

export function NewManuscriptPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  // ① 작품 설정
  const [draft, setDraft] = useState<Work>(() => newWork());
  const [existingId, setExistingId] = useState<string | null>(null); // null = 새 작품
  // ② 원고 틀
  const [format, setFormat] = useState<Format>('page');
  const [template, setTemplate] = useState<TemplateId>('four');
  const [style, setStyle] = useState<FrameStyle>(DEFAULT_STYLE);
  const [ratio, setRatio] = useState<[number, number]>(DEFAULT_PAGE_RATIO);
  // 직접 그리기: 그린 틀과, 그리기를 시작할 틀(직전에 고른 정해진 틀)
  const [firstSplit, setFirstSplit] = useState<SplitNode | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [baseTpl, setBaseTpl] = useState<TemplateId>('four');

  const works = useLiveQuery(() => db.works.orderBy('updatedAt').reverse().toArray(), []);

  // 샘플 파일이 없으면 A의 기본 모델을 비운다
  useEffect(() => {
    sampleAvailable().then(ok => {
      if (!ok) setDraft(w => ({ ...w, characters: w.characters.map(c => (c.model?.kind === 'sample' ? { ...c, model: null } : c)) }));
    });
  }, []);

  const basePage = useMemo(() => makePage(format, baseTpl, style, ratio), [format, baseTpl, style, ratio]);
  const customPage = useMemo(() => (firstSplit && format === 'page' ? applySplit(makePage(format, 'one', style, ratio), firstSplit, style, ratio) : null), [firstSplit, format, style, ratio]);
  const isCustom = template === 'custom' && format === 'page' && !!customPage;
  const preview = useMemo(() => (isCustom && customPage ? customPage : makePage(format, template === 'custom' ? baseTpl : template, style, ratio)), [isCustom, customPage, format, template, baseTpl, style, ratio]);
  const existing = existingId ? works?.find(w => w.id === existingId) ?? null : null;
  const workHint = nextTempName(works?.map(w => w.title) ?? []);

  async function create() {
    let work: Work;
    if (existing) work = existing;
    else {
      const workTitles = (await db.works.toArray()).map(w => w.title);
      work = { ...draft, title: resolveTitle(draft.title, workTitles) };
      await saveWork(work);
    }
    const inWork = (await db.manuscripts.where('workId').equals(work.id).toArray()).map(x => x.title);
    const useTpl = template === 'custom' && !isCustom ? baseTpl : template;
    const m = newManuscript({ title: nextEpisodeTitle(inWork), work, format, template: useTpl, style, pageRatio: ratio });
    if (isCustom && firstSplit) m.pages[0] = applySplit(m.pages[0], firstSplit, style, ratio) ?? m.pages[0];
    await saveManuscript(m);
    navigate(`/m/${m.id}`);
  }

  return (
    <HomeLayout>
      <div className="np">
        <header className="np-head">
          <h1 className="np-title">새 원고</h1>
          <Stepper steps={['작품 설정', '원고 틀']} current={step - 1} onGo={i => { if (i === 0) setStep(1); }} />
        </header>

        {step === 1 && (
          <div className="np-main">
            <section className="sect" aria-labelledby="sTitle">
              <div className="sect-head">
                <h2 className="sect-title" id="sTitle">작품 제목</h2>
                <Info text={existing ? '이 작품의 다음 화로 만들어져요. 작품 설명과 등장인물을 그대로 이어서 써요.' : `비워 두면 "${workHint}"(으)로 저장돼요. 같은 제목이 있으면 뒤에 숫자가 하나씩 붙어요. 원고는 이 작품의 1화, 2화…로 이름이 붙어요.`} />
                <span className="spacer" />
                {existing === null && (
                  <button
                    type="button"
                    className="linkbtn"
                    disabled={!works?.length}
                    title={works?.length ? '이미 만든 작품의 다음 화로 만들어요' : '아직 만든 작품이 없어요'}
                    onClick={() => works?.[0] && setExistingId(works[0].id)}
                  >
                    기존 작품 불러오기
                  </button>
                )}
                {existing && <button type="button" className="linkbtn" onClick={() => setExistingId(null)}>새 작품으로</button>}
              </div>
              {existing ? (
                    <select className="rowin full field-solo" aria-labelledby="sTitle" value={existing.id} onChange={e => setExistingId(e.target.value)}>
                      {works?.map(w => <option key={w.id} value={w.id}>{w.title || '작품 이름 없음'}</option>)}
                    </select>
                  ) : (
                    <input className="rowin full field-solo" type="text" aria-labelledby="sTitle" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder={workHint} />
                  )}
            </section>

            {!existing && (
              <section className="sect" aria-labelledby="sWork">
                <div className="sect-head">
                  <h2 className="sect-title" id="sWork">작품 설명</h2>
                  <Info text="시대·장소·분위기 등을 자유롭게 적어요. 비워 둬도 되고, 원고 화면의 '작품 설정'에서 나중에 적을 수 있어요." />
                </div>
                <textarea className="rowarea field-solo" rows={3} aria-labelledby="sWork" value={draft.world} onChange={e => setDraft({ ...draft, world: e.target.value })} placeholder="예: 현대 한국, 대학가 골목의 작은 카페. 잔잔한 일상물" />
              </section>
            )}

            {!existing && (
              <section className="sect" aria-labelledby="sCast">
                <div className="sect-head">
                  <h2 className="sect-title" id="sCast">등장인물</h2>
                  <Info text="모델을 바꾸면 그 인물이 나오는 모든 컷에 반영돼요. 추가 설정의 성별·나이대는 포즈 레퍼런스 검색에 쓰여요." />
                </div>
                <CharacterEditor characters={draft.characters} onChange={characters => setDraft({ ...draft, characters })} />
              </section>
            )}

            <div className="np-actions">
              <div className="actions">
                <span className="quick">
                  <button type="button" className="btn" onClick={create}>기본 틀로 바로 만들기</button>
                  <Info text="페이지 만화 9:19, 기본 4컷으로 만들어요. 원고 화면에서 페이지마다 틀을 바꿀 수 있어요." />
                </span>
                <button type="button" className="btn primary" onClick={() => setStep(2)}>다음: 원고 틀</button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="np-body">
            <div className="np-main">
              <section className="sect" aria-labelledby="sFormat">
                <div className="sect-head">
                  <h2 className="sect-title" id="sFormat">형식</h2>
                  <span className="notice-blue" id="formatNote">만든 뒤에는 형식을 바꿀 수 없어요 (페이지 비율은 원고 화면에서 바꿀 수 있어요)</span>
                </div>
                <div className="grouped">
                  <div className="row">
                    <label className="row-choice">
                      <input type="radio" name="format" checked={format === 'page'} onChange={() => setFormat('page')} />
                      <span className="row-text"><span className="row-label">페이지 만화</span><span className="row-desc">비율 고정</span></span>
                    </label>
                    {format === 'page' && (
                      <span className="ratio" role="group" aria-label="페이지 비율 (가로:세로)">
                        {(ratio[0] !== DEFAULT_PAGE_RATIO[0] || ratio[1] !== DEFAULT_PAGE_RATIO[1]) && (
                          <button type="button" className="linkbtn" onClick={() => setRatio(DEFAULT_PAGE_RATIO)}>기본값</button>
                        )}
                        <input className="num" type="number" min={1} max={50} step={0.1} aria-label="가로" value={ratio[0]} onChange={e => setRatio([clampNum(e.target.value, 1, 50), ratio[1]])} />
                        <span className="ratio-sep" aria-hidden="true">:</span>
                        <input className="num" type="number" min={1} max={50} step={0.1} aria-label="세로" value={ratio[1]} onChange={e => setRatio([ratio[0], clampNum(e.target.value, 1, 50)])} />
                      </span>
                    )}
                  </div>
                  <div className="row">
                    <label className="row-choice">
                      <input type="radio" name="format" checked={format === 'webtoon'} onChange={() => setFormat('webtoon')} />
                      <span className="row-text"><span className="row-label">웹툰 세로</span><span className="row-desc">컷이 아래로 계속 이어짐</span></span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="sect" aria-labelledby="sTpl">
                <div className="sect-head">
                  <h2 className="sect-title" id="sTpl">{format === 'page' ? '첫 페이지 컷 틀' : '처음 컷 구성'}</h2>
                  <Info text={format === 'page' ? '페이지를 추가할 때 다른 틀을 고를 수 있고, 원고 화면에서 페이지마다 바꿀 수도 있어요.' : '이 컷 수로 시작하고, 원고 화면에서 컷을 더할 수 있어요.'} />
                </div>
                <TemplatePicker
                  name="template" format={format} style={style} ratio={ratio} value={isCustom ? 'custom' : template === 'custom' ? baseTpl : template}
                  onChange={t => { if (t !== 'custom') { setTemplate(t); setBaseTpl(t); } }}
                  onDraw={() => setDrawOpen(true)}
                  customPage={customPage}
                  labelledBy="sTpl"
                />
                <CutDrawDialog
                  open={drawOpen}
                  page={isCustom && customPage ? customPage : basePage}
                  fallback={baseTpl}
                  style={style}
                  ratio={ratio}
                  title="첫 페이지 컷 직접 그리기"
                  onClose={() => setDrawOpen(false)}
                  onApply={root => { setFirstSplit(root); setTemplate('custom'); setDrawOpen(false); }}
                />
              </section>

              <section className="sect" aria-labelledby="sStyle">
                <div className="sect-head">
                  <h2 className="sect-title" id="sStyle">여백과 테두리</h2>
                  <Info text="테두리 굵기·색은 원고 화면에서도 고칠 수 있어요." />
                </div>
                <div className="grouped">
                  <label className="row"><span className="row-label">컷 사이 여백</span><input className="num" type="number" min={0} max={40} value={style.gutter} onChange={e => setStyle({ ...style, gutter: clampNum(e.target.value, 0, 40) })} /></label>
                  <label className="row"><span className="row-label">바깥 여백</span><input className="num" type="number" min={0} max={60} value={style.margin} onChange={e => setStyle({ ...style, margin: clampNum(e.target.value, 0, 60) })} /></label>
                  <label className="row"><span className="row-label">테두리 굵기</span><input className="num" type="number" min={0} max={10} value={style.border.width} onChange={e => setStyle({ ...style, border: { ...style.border, width: clampNum(e.target.value, 0, 10) } })} /></label>
                </div>
              </section>

              <div className="np-actions">
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setStep(1)}>이전</button>
                  <button type="button" className="btn primary" onClick={create}>만들기</button>
                </div>
              </div>
            </div>

            <aside className="np-side" aria-label="미리보기">
              <h2 className="sect-title">미리보기</h2>
              <div className="preview-card">
                <PageView page={preview} style={style} width={format === 'page' ? 150 : 170} showNumbers={false} label="원고 틀 미리보기" />
              </div>
              <p className="sect-note" style={{ textAlign: 'center' }}>{describeTemplate(format, template, ratio)}</p>
            </aside>
          </div>
        )}
      </div>
    </HomeLayout>
  );
}
