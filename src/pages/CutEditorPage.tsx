// 컷 편집: 엔진을 띄우고, 컷 비율·모델·저장된 장면을 넘기고, 바뀌면 자동 저장한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useManuscript } from '../storage/useManuscript';
import { findCut, neighbourCutId, updateCut } from '../scene/manuscript';
import { cutRatio } from '../scene/layout';
import { ENGINE_URL, type RoughEngine, waitForEngine } from '../engine/bridge';
import { loadModelFile } from '../storage/db';

type Status = '불러오는 중…' | '자동 저장됨' | '저장 중…' | string;

export function CutEditorPage() {
  const { msId, cutId } = useParams();
  const navigate = useNavigate();
  const { loading, manuscript: m, work, update } = useManuscript(msId);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const engineRef = useRef<RoughEngine | null>(null);
  const saveTimer = useRef(0);
  const [status, setStatus] = useState<Status>('불러오는 중…');
  const [missing, setMissing] = useState(false);

  /** 엔진에서 지금 장면과 작은 그림을 꺼내 저장. 엔진이 이미 사라졌으면 장면만(또는 아무것도) 저장하지 않는다. */
  const persist = useCallback(async (id: string) => {
    const eng = engineRef.current;
    if (!eng) return;
    let scene;
    try { scene = eng.exportScene(); } catch { return; }
    let thumb: string | null | undefined;
    try { thumb = eng.thumbnail(360); } catch { thumb = undefined; } // 화면에서 빠진 뒤엔 그림을 못 그리므로 이전 그림 유지
    await update(x => updateCut(x, id, thumb === undefined ? { scene } : { scene, thumb }));
  }, [update]);

  const save = useCallback(async () => {
    if (!cutId) return;
    setStatus('저장 중…');
    await persist(cutId);
    setStatus('자동 저장됨');
  }, [cutId, persist]);

  // 최신 원고·작품은 ref로 읽는다 (저장할 때마다 원고가 바뀌어도 엔진을 다시 띄우지 않도록)
  const latest = useRef({ m, work });
  latest.current = { m, work };
  const ready = !!m && !!work;
  const modelKey = JSON.stringify(work?.characters.map(c => c.model) ?? []);

  // 엔진 준비 → 모델·장면 넣기. 컷이나 모델이 바뀌면 다시 불러온다 (iframe도 key로 새로 뜬다).
  useEffect(() => {
    const { m: ms, work: w } = latest.current;
    if (!ready || !ms || !w || !cutId) return;
    const found = findCut(ms, cutId);
    const frame = frameRef.current;
    if (!found || !frame) return;
    engineRef.current = null;
    setStatus('불러오는 중…');
    let cancelled = false;
    (async () => {
      try {
        const eng = await waitForEngine(frame);
        const [A, B] = await Promise.all(w.characters.map(c => loadModelFile(c.model)));
        if (cancelled) return;
        setMissing(!A);
        await eng.load({ ratio: cutRatio(found.cut.rect), models: { A: A ?? undefined, B: B ?? undefined }, scene: found.cut.scene });
        if (cancelled) return;
        engineRef.current = eng;
        eng.onChange(() => {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(save, 600);
        });
        setStatus(found.cut.scene ? '자동 저장됨' : '새 장면 · 바꾸면 자동 저장돼요');
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : '불러오지 못했어요.');
      }
    })();
    return () => { cancelled = true; };
  }, [ready, cutId, modelKey, save]);

  // 브라우저 뒤로 가기 등으로 나갈 때의 마지막 저장 (버튼으로 나갈 때는 leave()가 먼저 저장한다)
  useEffect(() => () => {
    window.clearTimeout(saveTimer.current);
    if (cutId) void persist(cutId);
    engineRef.current = null;
  }, [cutId, persist]);

  /** 저장을 마친 뒤 다른 화면으로 */
  const leave = async (to: string) => {
    window.clearTimeout(saveTimer.current);
    if (cutId) await persist(cutId);
    engineRef.current = null;
    navigate(to);
  };

  if (loading) return <><TopBar /><p className="sub" style={{ padding: 16 }}>불러오는 중…</p></>;
  const found = m && cutId ? findCut(m, cutId) : null;
  if (!m || !found) return <><TopBar /><div className="panel" style={{ margin: 16 }}><p>컷을 찾을 수 없어요.</p><Link to="/" className="btn">내 원고로</Link></div></>;

  const prev = neighbourCutId(m, found.cut.id, -1);
  const next = neighbourCutId(m, found.cut.id, 1);
  const go = (id: string | null) => { if (id) void leave(`/m/${m.id}/cut/${id}`); };

  return (
    <div className="editor">
      <div>
        <TopBar>
          <a href={`#/m/${m.id}`} className="btn small ghost" onClick={e => { e.preventDefault(); void leave(`/m/${m.id}`); }}>← 원고로</a>
          <b>{found.pageIndex + 1}페이지 · 컷 {found.cutIndex + 1}</b>
          <button type="button" className="btn small" disabled={!prev} onClick={() => go(prev)}>‹ 이전 컷</button>
          <button type="button" className="btn small" disabled={!next} onClick={() => go(next)}>다음 컷 ›</button>
          <span className="sub" role="status">{status}</span>
        </TopBar>
        {missing && (
          <div className="notice" role="alert">
            A의 모델이 없어요. 원고 화면의 "작품 설정"에서 VRM 파일을 넣어 주세요.
            <Link to={`/m/${m.id}`} className="btn small">원고 화면으로</Link>
          </div>
        )}
      </div>
      <iframe key={`${found.cut.id}/${modelKey}`} ref={frameRef} src={ENGINE_URL} title="컷 편집" />
    </div>
  );
}
