// 컷 편집: 엔진을 띄우고, 컷 비율·모델·저장된 장면을 넘기고, 바뀌면 자동 저장한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { useManuscript } from '../storage/useManuscript';
import { castForCut, findCut, neighbourCutId, remapSceneSlots, updateCut } from '../scene/manuscript';
import { cutRatio } from '../scene/layout';
import { ENGINE_URL, type EngineCast, type RoughEngine, waitForEngine } from '../engine/bridge';
import { loadModelFile } from '../storage/db';
import { CastDialog } from '../components/CastDialog';
import { PreviewDialog } from '../components/PreviewDialog';
import { ImportPoseDialog } from '../components/ImportPoseDialog';
import type { Character, Cut, SlotId } from '../scene/types';
import { CUT_LETTERS } from '../scene/types';

type Status = '불러오는 중…' | '자동 저장됨' | '저장 중…' | string;

export function CutEditorPage() {
  const { msId, cutId } = useParams();
  const navigate = useNavigate();
  const { loading, manuscript: m, work, update, updateWork } = useManuscript(msId);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const engineRef = useRef<RoughEngine | null>(null);
  const saveTimer = useRef(0);
  const [status, setStatus] = useState<Status>('불러오는 중…');
  const [castOpen, setCastOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  /** 가져오기 등으로 저장된 장면이 바뀌면 엔진을 다시 띄운다 */
  const [reload, setReload] = useState(0);
  /** 가져오기 직후엔 저장소 읽기가 늦을 수 있어서, 막 넣은 컷 내용을 엔진에 바로 넘긴다 */
  const overrideCut = useRef<{ id: string; cut: Cut } | null>(null);
  const removeRef = useRef<(index: number) => void>(() => {});
  const actionRef = useRef<(type: 'save' | 'preview') => void>(() => {});
  const [preview, setPreview] = useState<{ big: string | null } | null>(null);

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
  const cutNow = m && cutId ? findCut(m, cutId) : null;
  const castNow: Character[] = work && cutNow ? castForCut(work.characters, cutNow.cut.cast) : [];
  // 이 컷에 나오는 인물(자리·모델·이름·성별·나이)이 바뀌면 엔진을 다시 띄운다
  const liveKey = JSON.stringify(castNow.map(c => [c.slot, c.model, c.name, c.gender, c.age]));
  // 등장인물 창에서 작품·컷을 차례로 고치는 동안에는 엔진을 다시 띄우지 않고, 다 고친 뒤 한 번만 띄운다
  const [applying, setApplying] = useState(false);
  const frozenKey = useRef(liveKey);
  if (!applying) frozenKey.current = liveKey;
  const modelKey = frozenKey.current;

  // 엔진 준비 → 모델·장면 넣기. 컷이나 모델이 바뀌면 다시 불러온다 (iframe도 key로 새로 뜬다).
  useEffect(() => {
    const { m: ms, work: w } = latest.current;
    if (!ready || !ms || !w || !cutId) return;
    const found0 = findCut(ms, cutId);
    const frame = frameRef.current;
    if (!found0 || !frame) return;
    const ov = overrideCut.current;
    overrideCut.current = null;
    const found = ov && ov.id === cutId ? { ...found0, cut: ov.cut } : found0;
    engineRef.current = null;
    setStatus('불러오는 중…');
    let cancelled = false;
    (async () => {
      try {
        const eng = await waitForEngine(frame);
        // 이 컷에 고른 인물(안 골랐으면 모델이 있는 앞의 2명)을 A, B, C … 자리에
        const chosen = castForCut(w.characters, found.cut.cast);
        const files = await Promise.all(chosen.map(c => loadModelFile(c.model)));
        if (cancelled) return;
        const cast: EngineCast[] = chosen.map((c, i) => ({ letter: CUT_LETTERS[i], name: c.name || c.slot, gender: c.gender, age: c.age }));
        const models = Object.fromEntries(chosen.map((_, i) => [CUT_LETTERS[i], files[i] ?? undefined]));
        await eng.load({
          ratio: cutRatio(found.cut.rect), models, scene: found.cut.scene, cast,
          shape: found.cut.poly ? found.cut.poly.map(([x, y]) => [(x - found.cut.rect.x) / found.cut.rect.w, (y - found.cut.rect.y) / found.cut.rect.h] as [number, number]) : null,
          name: `${ms.title}_${found.pageIndex + 1}페이지_컷${found.cutIndex + 1}`,
        });
        if (cancelled) return;
        engineRef.current = eng;
        eng.onAction?.(a => {
          if (a.type === 'cast') setCastOpen(true);
          else if (a.type === 'import') setImportOpen(true);
          else if (a.type === 'save' || a.type === 'preview') actionRef.current(a.type);
          else if (a.type === 'remove') removeRef.current(CUT_LETTERS.indexOf(a.letter as typeof CUT_LETTERS[number]));
        });
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
  }, [ready, cutId, modelKey, reload, save]);

  // 컷 편집 화면에서 Ctrl+S: 브라우저의 '페이지 저장' 대신 이 컷을 저장 (엔진 안에서 누르면 엔진이 처리)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); actionRef.current('save'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  /** 등장인물 창에서 적용: 지금 장면을 먼저 저장하고, 작품 등장인물·이 컷의 인물을 바꾼다 (엔진은 다시 뜬다) */
  const applyCast = async (next: { characters: Character[]; cast: SlotId[] }) => {
    setCastOpen(false);
    setApplying(true);
    try {
      window.clearTimeout(saveTimer.current);
      await persist(found.cut.id);
      engineRef.current = null;
      if (work && JSON.stringify(next.characters) !== JSON.stringify(work.characters)) await updateWork({ ...work, characters: next.characters, updatedAt: Date.now() });
      const oldCast = castNow.map(c => c.slot);
      await update(x => {
        const cur = findCut(x, found.cut.id);
        return updateCut(x, found.cut.id, { cast: next.cast, scene: remapSceneSlots(cur?.cut.scene ?? null, oldCast, next.cast) });
      });
    } finally {
      setApplying(false);
    }
  };
  // 엔진의 저장 단추(Ctrl+S) · 페이지·컷 미리보기
  actionRef.current = async (type) => {
    window.clearTimeout(saveTimer.current);
    await save();
    if (type === 'save') {
      const t = new Date();
      engineRef.current?.notice?.(`저장했어요 · ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
    } else {
      let big: string | null = null;
      try { big = engineRef.current?.thumbnail(1000) ?? null; } catch { big = null; }
      setPreview({ big });
    }
  };
  // 엔진의 ✕ 버튼: 그 자리 인물을 이 컷에서만 뺀다
  removeRef.current = (index: number) => {
    if (!work || index < 0) return;
    const who = castNow[index];
    if (!who) return;
    void applyCast({ characters: work.characters, cast: castNow.map(c => c.slot).filter((_, i) => i !== index) });
  };

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
      </div>
      <iframe key={`${found.cut.id}/${modelKey}/${reload}`} ref={frameRef} src={ENGINE_URL} title="컷 편집" />
      {preview && (
        <PreviewDialog
          open
          page={m.pages[found.pageIndex]}
          pageNumber={found.pageIndex + 1}
          cut={found.cut}
          cutNumber={found.cutIndex + 1}
          style={m.style}
          big={preview.big}
          onClose={() => setPreview(null)}
        />
      )}
      {work && (
        <ImportPoseDialog
          open={importOpen}
          manuscript={m}
          characters={work.characters}
          scopes={['cut']}
          cutId={found.cut.id}
          pageIndex={found.pageIndex}
          onClose={() => setImportOpen(false)}
          onApply={async fn => {
            setImportOpen(false);
            setApplying(true);
            try {
              window.clearTimeout(saveTimer.current);
              engineRef.current = null; // 덮어쓸 장면이라 지금 장면은 저장하지 않음
              const cur = latest.current.m;
              const nextCut = cur ? findCut(fn(cur), found.cut.id)?.cut : null;
              await update(fn);
              if (nextCut) overrideCut.current = { id: found.cut.id, cut: nextCut };
              setReload(r => r + 1);
            } finally {
              setApplying(false);
            }
          }}
        />
      )}
      {work && (
        <CastDialog
          open={castOpen}
          characters={work.characters}
          cast={castNow.map(c => c.slot)}
          onClose={() => setCastOpen(false)}
          onSave={next => void applyCast(next)}
        />
      )}
    </div>
  );
}
