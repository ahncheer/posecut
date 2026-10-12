// "JSON에서 포즈 가져오기": 파일 고르기 → 인원 확인 → 인물(모델) 짝짓기 → 어디에 넣을지 고르고 적용.
// 컷 편집(이 컷)과 원고 화면(선택한 컷·이 페이지·원고 전체)에서 같이 쓴다.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Character, Manuscript, SlotId } from '../scene/types';
import { MAX_IN_CUT } from '../scene/types';
import {
  applyImport, defaultMapping, duplicateTargets, parsePoseSource, planPairs, sceneCount,
  type ImportScope, type ImportSummary, type PoseSource,
} from '../scene/importPose';
import { modelName } from './CharacterEditor';
import { Info } from './Info';

interface Props {
  open: boolean;
  manuscript: Manuscript;
  characters: Character[];
  /** 고를 수 있는 범위 (컷 편집에서는 ['cut']) */
  scopes: ImportScope[];
  /** 선택한 컷 · 지금 페이지 */
  cutId: string | null;
  pageIndex: number;
  onClose: () => void;
  /** fn: 최신 원고에 가져오기를 적용하는 함수 (저장 직전 원고에 다시 적용) */
  onApply: (fn: (m: Manuscript) => Manuscript, summary: ImportSummary) => void;
}

const SCOPE_LABEL: Record<ImportScope, string> = { cut: '이 컷', page: '이 페이지', all: '원고 전체' };

export function ImportPoseDialog({ open, manuscript: m, characters, scopes, cutId, pageIndex, onClose, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<PoseSource | null>(null);
  const [err, setErr] = useState('');
  const [mapping, setMapping] = useState<Record<string, SlotId | ''>>({});
  const [scope, setScope] = useState<ImportScope>(scopes[0]);
  const [srcCut, setSrcCut] = useState<[number, number]>([0, 0]);
  const [srcPage, setSrcPage] = useState(0);
  const [skipFilled, setSkipFilled] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setSrc(null); setErr(''); setScope(scopes[0]); setSkipFilled(false); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, scopes]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      const s = parsePoseSource(await f.text(), f.name);
      if (!sceneCount(s)) throw new Error('이 파일에는 자세가 저장된 컷이 없어요.');
      setSrc(s); setErr('');
      setMapping(defaultMapping(s, characters));
      // 가져올 컷·페이지 기본값: 같은 자리 → 없으면 장면이 있는 첫 컷
      const here = cutId ? m.pages.flatMap((p, pi) => p.cuts.map((c, ci) => (c.id === cutId ? [pi, ci] as [number, number] : null))).find(Boolean) : null;
      const firstFilled = s.pages.flatMap((p, pi) => p.map((c, ci) => (c.scene || c.panel ? [pi, ci] as [number, number] : null))).find(Boolean) ?? [0, 0];
      setSrcCut(here && (s.pages[here[0]]?.[here[1]]?.scene || s.pages[here[0]]?.[here[1]]?.panel) ? here : firstFilled);
      setSrcPage(s.pages[pageIndex] ? pageIndex : 0);
      if (s.kind === 'scene') setScope(scopes.includes('cut') ? 'cut' : scopes[0]);
    } catch (e) {
      setSrc(null); setErr(e instanceof Error ? e.message : '파일을 읽지 못했어요.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const allowed = src?.kind === 'scene' ? scopes.filter(s => s === 'cut') : scopes;
  const pairs = useMemo(() => (src ? planPairs(m, src, { scope, targetCutId: cutId ?? undefined, targetPage: pageIndex, srcCut, srcPage, skipFilled }) : []),
    [m, src, scope, cutId, pageIndex, srcCut, srcPage, skipFilled]);
  const dupes = duplicateTargets(mapping);
  const preview = useMemo(() => (src ? applyImport(m, pairs, mapping, skipFilled, characters).summary : null), [m, src, pairs, mapping, skipFilled, characters]);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const canApply = !!src && !dupes.length && mappedCount > 0 && !!preview?.applied && (scope !== 'cut' || !!cutId);
  const withModel = characters.filter(c => c.model);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="impTitle">
      <form className="dlg importdlg" method="dialog" onSubmit={e => { if (!canApply || !src) { e.preventDefault(); return; } const r = applyImport(m, pairs, mapping, skipFilled, characters); const pp = pairs, mp = mapping, sk = skipFilled; onApply(x => applyImport(x, pp, mp, sk, characters).manuscript, r.summary); }}>
        <div className="dlg-head">
          <h2 id="impTitle">JSON에서 포즈 가져오기</h2>
          <Info text="러프 도구에서 저장한 장면 파일(.json, 컷 편집 → 내보내기)·원고 파일(.rough.json, 원고 → 내보내기)·그림 콘티(.json)에서 자세·표정·카메라를 가져와요. 파일 속 인물을 지금 작품의 인물(모델)에 짝지어 넣어요." />
          <span className="spacer" />
          <button type="button" className="btn small ghost" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <section className="impstep">
          <h3><span className="stepno">1</span>파일 고르기</h3>
          <div className="btnrow">
            <button type="button" className="btn small" autoFocus onClick={() => fileRef.current?.click()}>{src ? '다른 파일 고르기' : 'JSON 파일 고르기'}</button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="vh" onChange={e => void pick(e.target.files?.[0])} />
            {src && <span className="sub">{src.title}</span>}
          </div>
          {err && <p className="sect-note" role="alert" style={{ color: 'var(--danger)' }}>{err}</p>}
          {src && (
            <p className="impcount" role="status">
              <b>인물 {src.people.length}명</b> · 자세가 있는 컷 {sceneCount(src)}개{src.kind !== 'scene' ? ` · ${src.pages.length}페이지` : ''}{src.kind === 'storyboard' ? ' · 그림 콘티' : ''}
              {src.people.length > MAX_IN_CUT && <span className="warn"> · 한 컷에는 {MAX_IN_CUT}명까지만 들어가요</span>}
            </p>
          )}
        </section>

        {src && (
          <section className="impstep">
            <h3><span className="stepno">2</span>인물·모델 짝짓기</h3>
            <p className="sect-note">파일 속 인물마다 이 작품에서 그 자세를 받을 인물을 골라 주세요. 모델이 있는 인물만 고를 수 있어요.</p>
            <div className="impmap">
              {src.people.map(p => (
                <label key={p.key} className="impmaprow" data-dupe={!!mapping[p.key] && dupes.includes(mapping[p.key] as SlotId)}>
                  <span className="impfrom"><b>{p.label}</b>{p.model && <span className="row-desc">{p.model}</span>}</span>
                  <span aria-hidden="true" className="imparrow">→</span>
                  <select value={mapping[p.key] ?? ''} onChange={e => setMapping(v => ({ ...v, [p.key]: e.target.value }))}>
                    <option value="">가져오지 않음</option>
                    {characters.map(c => (
                      <option key={c.slot} value={c.slot} disabled={!c.model}>{c.name || c.slot} · {c.model ? modelName(c.model) : '모델 없음'}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {!withModel.length && <p className="sect-note warn">이 작품에 모델이 있는 인물이 없어요. 작품 설정에서 모델을 먼저 넣어 주세요.</p>}
            {!!dupes.length && <p className="sect-note warn">한 인물에 두 명 이상을 짝지었어요. 한 명씩만 골라 주세요.</p>}
          </section>
        )}

        {src && (
          <section className="impstep">
            <h3><span className="stepno">3</span>어디에 넣을까요</h3>
            <div className="chips" role="radiogroup" aria-label="넣을 범위">
              {scopes.map(s => (
                <button key={s} type="button" role="radio" className="chip" aria-checked={scope === s} disabled={!allowed.includes(s)} onClick={() => setScope(s)}>{SCOPE_LABEL[s]}</button>
              ))}
            </div>
            {src.kind === 'scene' && scopes.length > 1 && <p className="sect-note">장면 파일은 컷 하나 분량이라 "이 컷"에만 넣을 수 있어요. 페이지·원고 전체는 원고 파일(.rough.json)로 가져와 주세요.</p>}
            {src.kind === 'storyboard' && <p className="sect-note">그림 콘티예요. 컷마다 포즈·방향·샷·말풍선·기호를 콘티대로 새로 놓아요 (지금 장면은 바뀌어요). 컷 칸 모양까지 그림처럼 만들려면 원고 화면의 "그림으로 콘티"를 쓰세요.</p>}
            {scope === 'cut' && src.kind !== 'scene' && (
              <label className="impsel">가져올 컷
                <select value={srcCut.join(',')} onChange={e => setSrcCut(e.target.value.split(',').map(Number) as [number, number])}>
                  {src.pages.flatMap((p, pi) => p.map((c, ci) => (c.scene || c.panel) && (
                    <option key={`${pi},${ci}`} value={`${pi},${ci}`}>{pi + 1}페이지 컷 {ci + 1} · {c.people.length}명</option>
                  )))}
                </select>
              </label>
            )}
            {scope === 'page' && (
              <label className="impsel">가져올 페이지
                <select value={srcPage} onChange={e => setSrcPage(Number(e.target.value))}>
                  {src.pages.map((p, pi) => <option key={pi} value={pi}>{pi + 1}페이지 · 자세 {p.filter(c => c.scene || c.panel).length}컷</option>)}
                </select>
              </label>
            )}
            <p className="sect-note">
              {scope === 'cut' && (cutId ? '고른 컷 하나에 넣어요.' : '원고에서 컷을 먼저 골라 주세요.')}
              {scope === 'page' && `파일의 ${srcPage + 1}페이지 컷들을 지금 ${pageIndex + 1}페이지 컷에 순서대로 넣어요.`}
              {scope === 'all' && '파일의 페이지·컷 순서 그대로 원고 전체에 넣어요. 컷 수가 다르면 남는 컷은 그대로 둬요.'}
            </p>
            <label className="check"><input type="checkbox" checked={skipFilled} onChange={e => setSkipFilled(e.target.checked)} />이미 장면이 있는 컷은 건너뛰기</label>
            {preview && (
              <p className="impcount" role="status">
                컷 {preview.applied}개에 넣어요
                {preview.replaced > 0 && <span className="warn"> · 그중 {preview.replaced}개는 지금 장면을 덮어써요</span>}
                {preview.skipped > 0 && ` · ${preview.skipped}개 건너뜀`}
                {preview.empty > 0 && ` · 짝지은 인물이 없는 컷 ${preview.empty}개`}
              </p>
            )}
          </section>
        )}

        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button type="submit" className="btn primary" disabled={!canApply}>가져오기</button>
        </div>
      </form>
    </dialog>
  );
}
