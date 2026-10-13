// "그림으로 콘티 만들기": 만화 페이지 그림 → (AI) 콘티 JSON → 인물 짝짓기 → 원고 페이지로.
// 1) 그림 고르기  2) Gemini로 분석하거나, 요청문을 복사해 다른 AI에 물어보고 답(JSON)을 붙여넣기  3) 확인·짝짓기 후 넣기
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Character, Manuscript, SlotId } from '../scene/types';
import { STORYBOARD_PROMPT, applyStoryboard, defaultCharMapping, pageFromStoryboard, parseStoryboard, type Storyboard } from '../scene/storyboard';
import { geminiImageJSON, hasGeminiKey, saveGeminiKey, shrinkImage } from '../ai/gemini';
import { downloadJSON } from '../storage/file-io';
import { modelName } from './CharacterEditor';
import { Info } from './Info';

interface Props {
  open: boolean;
  manuscript: Manuscript;
  characters: Character[];
  pageIndex: number;
  onClose: () => void;
  /** fn: 최신 원고에 콘티를 넣는 함수, firstPage: 넣은 첫 페이지 번호(0부터) */
  onApply: (fn: (m: Manuscript) => Manuscript, firstPage: number, summary: string) => void;
}

export function StoryboardDialog({ open, manuscript: m, characters, pageIndex, onClose, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [imgName, setImgName] = useState('');
  const [text, setText] = useState('');
  const [sb, setSb] = useState<Storyboard | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyIn, setKeyIn] = useState('');
  const [hasKey, setHasKey] = useState(hasGeminiKey());
  const [mapping, setMapping] = useState<Record<string, SlotId | ''>>({});
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setErr(''); setHasKey(hasGeminiKey()); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  const read = (t: string) => {
    try { const s = parseStoryboard(t); setSb(s); setErr(''); setMapping(defaultCharMapping(s, characters)); }
    catch (e) { setSb(null); setErr(e instanceof Error ? e.message : '콘티를 읽지 못했어요.'); }
  };
  const pickImage = async (f?: File) => {
    if (!f) return;
    try { setImg(await shrinkImage(f)); setImgName(f.name); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : '그림을 열지 못했어요.'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const analyze = async () => {
    if (!img) return;
    setBusy(true); setErr('');
    try { const t = await geminiImageJSON(STORYBOARD_PROMPT, img); setText(t); read(t); }
    catch (e) { setErr(e instanceof Error ? e.message : 'AI 분석에 실패했어요.'); }
    finally { setBusy(false); }
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(STORYBOARD_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr('복사하지 못했어요. 아래 "요청문 보기"에서 직접 복사해 주세요.'); }
  };

  const panels = sb ? sb.pages.reduce((n, p) => n + p.panels.length, 0) : 0;
  const bubbles = sb ? sb.pages.reduce((n, p) => n + p.panels.reduce((k, q) => k + (q.bubbles?.length ?? 0) + (q.marks?.length ?? 0), 0), 0) : 0;
  const mapped = Object.values(mapping).filter(Boolean);
  const dupes = mapped.filter((v, i) => mapped.indexOf(v) !== i);
  const replaceFilled = useMemo(() => (sb && mode === 'replace' ? m.pages.slice(pageIndex, pageIndex + sb.pages.length).reduce((n, p) => n + p.cuts.filter(c => c.scene).length, 0) : 0), [sb, mode, m, pageIndex]);
  const canApply = !!sb && !dupes.length && m.format === 'page';

  const apply = () => {
    if (!sb) return;
    if (replaceFilled && !confirm(`지금 있는 장면 ${replaceFilled}개가 콘티로 바뀌어요. 계속할까요?`)) return;
    const first = mode === 'append' ? m.pages.length : pageIndex;
    const sbx = sb, mp = mapping, md = mode, at = pageIndex;
    onApply(x => applyStoryboard(x, sbx.pages.map(p => pageFromStoryboard(p, x, mp, characters, undefined, sbx.look)), md, at), first,
      `콘티 ${sbx.pages.length}페이지(컷 ${panels}개)를 ${md === 'append' ? '뒤에 새 페이지로' : `${at + 1}페이지부터`} 넣었어요. 장면은 자동으로 만들어져요.`);
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="sbTitle" className="sbdlg">
      <div className="dlg">
        <div className="dlg-head">
          <h2 id="sbTitle">그림으로 콘티 만들기</h2>
          <Info text="만화 페이지 그림을 넣으면 컷 칸·인물 위치·포즈·말풍선 글자·만화 기호를 뽑은 콘티(JSON)로 원고 페이지를 만들어요. 3D 장면은 이 콘티대로 자동으로 놓이고, 그다음 컷 편집에서 다듬으면 돼요." />
          <span className="spacer" />
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="sbgrid">
          <div className="sbleft">
            <div className="sbimg" data-empty={!img}>
              {img ? <img src={img} alt={`넣은 그림 ${imgName}`} /> : <span>만화 페이지 그림을 골라 주세요</span>}
              {img && sb && sb.pages[0] && sb.pages[0].panels.map((p, i) => (
                <span key={i} className="sbbox" style={{ left: `${p.box[0] * 100}%`, top: `${p.box[1] * 100}%`, width: `${p.box[2] * 100}%`, height: `${p.box[3] * 100}%` }}><b>{i + 1}</b></span>
              ))}
            </div>
            <div className="btnrow">
              <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>{img ? '다른 그림' : '그림 고르기'}</button>
              <input ref={fileRef} type="file" accept="image/*" className="vh" onChange={e => void pickImage(e.target.files?.[0])} />
            </div>
          </div>
          <div className="sbright">
            <section className="impstep">
              <h3><span className="stepno">1</span>콘티(JSON) 만들기</h3>
              <div className="sbways">
                <div className="sbway">
                  <b>Gemini로 바로 분석</b>
                  <span className="sub">한 장에 약 3~6원 · 키는 이 브라우저에만 저장</span>
                  {hasKey
                    ? <button type="button" className="btn small primary" disabled={!img || busy} onClick={() => void analyze()}>{busy ? '분석하는 중…' : '그림 분석하기'}</button>
                    : (
                      <div className="sbkey">
                        <input type="password" autoComplete="off" placeholder="Gemini API 키 (AIza…)" value={keyIn} onChange={e => setKeyIn(e.target.value)} aria-label="Gemini API 키" />
                        <button type="button" className="btn small" disabled={!keyIn.trim()} onClick={() => { saveGeminiKey(keyIn); setKeyIn(''); setHasKey(true); }}>저장</button>
                      </div>
                    )}
                </div>
                <div className="sbway">
                  <b>다른 AI에 물어보기</b>
                  <span className="sub">요청문을 복사해 그림과 함께 Claude·ChatGPT 등에 보내고, 답을 아래에 붙여넣어요</span>
                  <button type="button" className="btn small" onClick={() => void copyPrompt()}>{copied ? '복사했어요' : 'AI에게 줄 요청문 복사'}</button>
                </div>
              </div>
              <details className="sbprompt"><summary>요청문 보기</summary><pre>{STORYBOARD_PROMPT}</pre></details>
              <label className="vh" htmlFor="sbText">콘티 JSON</label>
              <textarea id="sbText" className="sbtext" rows={5} placeholder='AI가 준 JSON을 여기에 붙여넣기 ({ "kind": "rough-storyboard", … })' value={text} onChange={e => setText(e.target.value)} />
              <div className="btnrow">
                <button type="button" className="btn small" disabled={!text.trim()} onClick={() => read(text)}>붙여넣은 콘티 읽기</button>
                <button type="button" className="btn small ghost" onClick={() => jsonRef.current?.click()}>콘티 파일 열기</button>
                <input ref={jsonRef} type="file" accept=".json,application/json" className="vh" onChange={async e => { const f = e.target.files?.[0]; if (f) { const t = await f.text(); setText(t); read(t); } e.target.value = ''; }} />
                {sb && <button type="button" className="btn small ghost" onClick={() => downloadJSON(`${(imgName || '콘티').replace(/\.[^.]+$/, '')}_콘티.json`, sb)}>콘티 JSON 저장</button>}
              </div>
              {err && <p className="sect-note warn" role="alert">{err}</p>}
              {sb && <p className="impcount" role="status"><b>{sb.pages.length}페이지 · 컷 {panels}개</b> · 인물 {sb.characters.length}명 · 말풍선·기호 {bubbles}개</p>}
            </section>
            {sb && (
              <section className="impstep">
                <h3><span className="stepno">2</span>인물·모델 짝짓기</h3>
                <div className="impmap">
                  {sb.characters.map(c => (
                    <label key={c.id} className="impmaprow" data-dupe={!!mapping[c.id] && dupes.includes(mapping[c.id] as SlotId)}>
                      <span className="impfrom"><b>{c.name}</b>{c.desc && <span className="row-desc">{c.desc}</span>}</span>
                      <span aria-hidden="true" className="imparrow">→</span>
                      <select value={mapping[c.id] ?? ''} onChange={e => setMapping(v => ({ ...v, [c.id]: e.target.value }))}>
                        <option value="">넣지 않음</option>
                        {characters.map(ch => <option key={ch.slot} value={ch.slot} disabled={!ch.model}>{ch.name || ch.slot} · {ch.model ? modelName(ch.model) : '모델 없음'}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {!!dupes.length && <p className="sect-note warn">한 인물에 두 명 이상을 짝지었어요.</p>}
              </section>
            )}
            {sb && (
              <section className="impstep">
                <h3><span className="stepno">3</span>어디에 넣을까요</h3>
                <div className="chips" role="radiogroup" aria-label="넣을 곳">
                  <button type="button" role="radio" className="chip" aria-checked={mode === 'append'} onClick={() => setMode('append')}>뒤에 새 페이지로</button>
                  <button type="button" role="radio" className="chip" aria-checked={mode === 'replace'} onClick={() => setMode('replace')}>{pageIndex + 1}페이지부터 바꾸기</button>
                </div>
                {replaceFilled > 0 && <p className="sect-note warn">지금 있는 장면 {replaceFilled}개가 바뀌어요.</p>}
                {m.format !== 'page' && <p className="sect-note warn">웹툰 원고에는 아직 넣을 수 없어요. 페이지 만화 원고에서 써 주세요.</p>}
              </section>
            )}
          </div>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>닫기</button>
          <button type="button" className="btn primary" disabled={!canApply} onClick={apply}>원고에 넣기</button>
        </div>
      </div>
    </dialog>
  );
}
