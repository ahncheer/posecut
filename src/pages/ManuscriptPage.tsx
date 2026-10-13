// 원고 화면: 페이지 목록, 페이지와 컷, 선택한 컷 패널, 원고 설정
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { PageView } from '../components/PageView';
import { WorkDialog } from '../components/WorkDialog';
import { useManuscript } from '../storage/useManuscript';
import { addPage, changePageTemplate, clearCut, findCut, pasteScene, previousCut, removePage, scenesLostByTemplate, swapCuts, movePage } from '../scene/manuscript';
import { PageTemplateDialog } from '../components/PageTemplateDialog';
import { TemplatePicker } from '../components/TemplatePicker';
import type { FrameStyle, Page, PageTitle, TemplateId, TitlePos } from '../scene/types';
import { applyTitle, changePageRatio, DEFAULT_TITLE, pageStyle, TITLE_FONTS, TITLE_POS, TITLE_SIZES } from '../scene/title';
import { Info } from '../components/Info';
import { ImportPoseDialog } from '../components/ImportPoseDialog';
import { ThumbBaker } from '../components/ThumbBaker';
import { StoryboardDialog } from '../components/StoryboardDialog';
import { updateCut } from '../scene/manuscript';
import { DEFAULT_PAGE_RATIO, templateLabel, templateOf } from '../scene/layout';
import { applySplit } from '../scene/split';
import { CutDrawDialog } from '../components/CutDrawDialog';
import { cutRatio } from '../scene/layout';
import { copyScene, readClip } from '../storage/clipboard';
import { downloadJSON, toReadableFile } from '../storage/file-io';
import { deleteManuscript } from '../storage/db';
import { ExportDialog, type ExportKind, type ExportOptions } from '../components/ExportDialog';
import { renderPagePng } from '../components/pageExport';
import { downloadBlob } from '../components/exportPage';
import { makeZip } from '../storage/zip';

export function ManuscriptPage() {
  const { msId } = useParams();
  /** 컷 편집에서 돌아올 때 ?cut=… : 그 컷이 있는 페이지를 보여주고 그 컷을 고른다 */
  const [search] = useSearchParams();
  const backCut = search.get('cut');
  const shownBack = useRef<string | null>(null);
  const pendingSel = useRef<string | null>(null);
  const navigate = useNavigate();
  const { loading, manuscript: m, work, update, updateWork } = useManuscript(msId);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const [tplDialog, setTplDialog] = useState<'add' | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState('');
  const [sbOpen, setSbOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  /** 컷 바꾸기: 먼저 고른 컷 id (다른 컷을 누르면 맞바꿈) */
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  /** 방금 맞바꾼 두 컷 (되돌리기용) */
  const [lastSwap, setLastSwap] = useState<[string, string] | null>(null);
  /** 페이지 끌어 옮기기: 끄는 페이지 번호와 놓을 자리 */
  const [dragPage, setDragPage] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  /** 장면은 있는데 작은 그림이 없는 컷(가져오기 직후 등)을 보이지 않는 엔진으로 차례로 그린다 */
  const [bakeQueue, setBakeQueue] = useState<string[]>([]);
  const tried = useRef(new Set<string>());
  /** 페이지를 추가한 뒤 저장이 반영되면 그 페이지로 이동 */
  const [jumpTo, setJumpTo] = useState<number | null>(null);
  const [note, setNote] = useState('');
  /** 직접 그리기 창을 연 페이지 번호(0부터) */
  const [drawFor, setDrawFor] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!m || !backCut || shownBack.current === backCut) return;
    shownBack.current = backCut;
    const f = findCut(m, backCut);
    if (f) { pendingSel.current = backCut; setPageIndex(f.pageIndex); setSelected(backCut); }
  }, [m, backCut]);
  useEffect(() => {
    if (!m) return;
    if (jumpTo !== null) {
      if (m.pages.length > jumpTo) { setPageIndex(jumpTo); setJumpTo(null); }
      return;
    }
    if (pageIndex >= m.pages.length) setPageIndex(m.pages.length - 1);
  }, [m, pageIndex, jumpTo]);
  // 기본으로 지금 페이지의 첫 컷을 고른 상태 (고른 컷이 이 페이지에 없으면 첫 컷으로)
  useEffect(() => {
    const pg = m?.pages[Math.min(pageIndex, m.pages.length - 1)];
    // 컷 편집에서 돌아와 그 컷의 페이지로 넘어가는 중이면 기다린다
    if (pendingSel.current) { if (pg?.cuts.some(c => c.id === pendingSel.current)) pendingSel.current = null; else return; }
    if (pg && !pg.cuts.some(c => c.id === selected)) setSelected(pg.cuts[0]?.id ?? null);
  }, [m, pageIndex, selected]);

  useEffect(() => {
    if (!m || bakeQueue.length) return;
    // 같은 컷이라도 장면이 바뀌면(불러오기 등) 다시 그린다
    const key = (c: { id: string; scene: unknown; plan?: unknown }) => `${c.id}:${c.scene ? JSON.stringify(c.scene).length : 0}:${c.plan ? 1 : 0}`;
    const cuts = m.pages.flatMap(p => p.cuts).filter(c => (c.scene || c.plan) && !c.thumb && !tried.current.has(key(c)));
    if (cuts.length) { cuts.forEach(c => tried.current.add(key(c))); setBakeQueue(cuts.map(c => c.id)); }
  }, [m, bakeQueue.length]);
  // 지금 페이지가 왼쪽 목록에서 보이도록 (목록이 길어 스크롤될 때)
  useEffect(() => {
    document.querySelector('.pagethumb[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [pageIndex, m?.pages.length]);
  useEffect(() => {
    if (!swapFrom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSwapFrom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swapFrom]);

  if (loading) return <><TopBar /><p className="sub" style={{ padding: 16 }}>불러오는 중…</p></>;
  if (!m) return <><TopBar /><div style={{ padding: 16 }} className="panel"><p>원고를 찾을 수 없어요.</p><Link to="/" className="btn">내 원고로</Link></div></>;

  const page = m.pages[Math.min(pageIndex, m.pages.length - 1)];
  const found = selected ? findCut(m, selected) : null;
  const sel = found?.cut ?? null;
  const ratio = sel ? cutRatio(sel.rect) : null;
  const openCut = (id: string) => navigate(`/m/${m.id}/cut/${id}`);
  const say = (t: string) => { setNote(t); setLastSwap(null); };
  const cutName = (id: string) => { const f = findCut(m, id); return f ? `${f.pageIndex + 1}페이지 컷 ${f.cutIndex + 1}` : ''; };
  const doSwap = async (a: string, b: string) => {
    setSwapFrom(null);
    if (a === b) { say('같은 컷이라 바꾸지 않았어요.'); return; }
    await update(x => swapCuts(x, a, b));
    setSelected(b);
    say(`${cutName(a)}와(과) ${cutName(b)}의 장면을 맞바꿨어요.`);
    setLastSwap([a, b]);
  };
  const reorder = async (from: number, to: number) => {
    if (from === to) return;
    await update(x => movePage(x, from, to));
    setJumpTo(to);
    say(`${from + 1}페이지를 ${to + 1}번째로 옮겼어요.`);
  };
  const pickCut = (id: string) => { if (swapFrom) void doSwap(swapFrom, id); else setSelected(id); };

  return (
    <>
      <TopBar right={<>
        <button type="button" className="btn" onClick={() => setImportOpen(true)} disabled={!work} title="장면·원고·그림 콘티 JSON을 이 원고에 불러와요">불러오기</button>
        <button type="button" className="btn primary" onClick={() => setExportOpen(true)}>내보내기</button>
      </>}>
        <Link to="/" className="btn small ghost">← 내 원고</Link>
        <TitleInput value={m.title} onSave={title => update(x => ({ ...x, title }))} />
        <span className="sub">{work?.title || '작품 이름 없음'} · 자동 저장됨</span>
      </TopBar>

      <div className="msview">
        <aside className="pagelist" aria-label="페이지">
          <div className="pagetools">
            <h2>{m.format === 'page' ? `페이지 (${m.pages.length})` : '웹툰'}</h2>
            {m.format === 'page'
              ? <button type="button" className="btn small" onClick={() => setTplDialog('add')}>+ 페이지 추가</button>
              : <button type="button" className="btn small" onClick={() => update(x => addPage(x))}>+ 컷 추가</button>}
            {m.format === 'page' && <button type="button" className="btn small" onClick={() => setSbOpen(true)} disabled={!work}>그림으로 콘티</button>}
            {m.format === 'page' && m.pages.length > 1 && (
              <div className="pagemove" role="group" aria-label="페이지 순서">
                <button type="button" className="btn small" disabled={pageIndex === 0} onClick={() => void reorder(pageIndex, pageIndex - 1)} aria-label={`${pageIndex + 1}페이지를 앞으로`}>↑ 앞으로</button>
                <button type="button" className="btn small" disabled={pageIndex >= m.pages.length - 1} onClick={() => void reorder(pageIndex, pageIndex + 1)} aria-label={`${pageIndex + 1}페이지를 뒤로`}>↓ 뒤로</button>
              </div>
            )}
            {m.format === 'page' && m.pages.length > 1 && (
              <button
                type="button"
                className="btn small ghost danger"
                onClick={() => { if (confirm(`${pageIndex + 1}페이지를 지울까요? 안의 장면도 함께 지워져요.`)) update(x => removePage(x, pageIndex)); }}
              >
                이 페이지 지우기
              </button>
            )}
          </div>
          {m.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="pagethumb"
              aria-current={i === pageIndex}
              draggable={m.format === 'page' && m.pages.length > 1}
              data-drop={dropAt === i && dragPage !== null && dragPage !== i ? (dragPage < i ? 'after' : 'before') : undefined}
              title={m.format === 'page' && m.pages.length > 1 ? '끌어서 순서를 바꿀 수 있어요' : undefined}
              onClick={() => { setPageIndex(i); if (!swapFrom) setSelected(null); }}
              onDragStart={e => { setDragPage(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
              onDragOver={e => { if (dragPage === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropAt !== i) setDropAt(i); }}
              onDragLeave={() => { if (dropAt === i) setDropAt(null); }}
              onDrop={e => { e.preventDefault(); if (dragPage !== null) void reorder(dragPage, i); setDragPage(null); setDropAt(null); }}
              onDragEnd={() => { setDragPage(null); setDropAt(null); }}
            >
              <PageView page={p} style={m.style} width={90} showNumbers={false} label={`${i + 1}페이지 미리보기`} />
              <span>{i + 1}</span>
            </button>
          ))}
        </aside>

        <section className="canvaswrap" ref={canvasRef} aria-label="페이지">
          <PageView
            page={page}
            style={m.style}
            width={m.format === 'page' ? 360 : 420}
            selectedCutId={swapFrom ?? selected}
            onSelect={pickCut}
            onOpen={openCut}
            label={`${pageIndex + 1}페이지, 컷 ${page.cuts.length}개`}
          />
          {swapFrom
            ? <p className="swapbar" role="status"><span><b>{cutName(swapFrom)}</b>와(과) 바꿀 컷을 눌러 주세요. 다른 페이지의 컷도 돼요.</span><button type="button" className="btn small" onClick={() => setSwapFrom(null)}>취소 (Esc)</button></p>
            : <p className="sub" style={{ marginTop: 8 }}>컷을 누르면 선택, 두 번 누르면 장면 편집으로 들어가요.</p>}
          {bakeQueue.length > 0 && <p className="sub" role="status">장면 그림을 그리는 중… ({bakeQueue.length}컷)</p>}
        </section>

        <aside className="msside">
          <section className="panel" aria-label="선택한 컷">
            {sel && found ? (
              <>
                <h2>{found.pageIndex + 1}페이지 · 컷 {found.cutIndex + 1}</h2>
                <p className="sub">비율 {ratio?.[0]}:{ratio?.[1]} · {sel.scene ? '장면 있음' : '비어 있음'}</p>
                <button type="button" className="btn primary" onClick={() => openCut(sel.id)}>{sel.scene ? '장면 편집' : '장면 만들기'}</button>
                <div className="btnrow">
                  <button type="button" className="btn small" disabled={!sel.scene} onClick={() => { if (sel.scene && copyScene({ scene: sel.scene, thumb: sel.thumb, from: `${found.pageIndex + 1}페이지 컷 ${found.cutIndex + 1}`, at: Date.now() })) say('장면을 복사했어요.'); }}>복사</button>
                  <button type="button" className="btn small" onClick={() => { const c = readClip(); if (!c) { say('복사한 장면이 없어요.'); return; } update(x => pasteScene(x, sel.id, c.scene, c.thumb)); say(`${c.from}의 장면을 붙여넣었어요.`); }}>붙여넣기</button>
                  <button type="button" className="btn small" onClick={() => { const prev = previousCut(m, sel.id); if (!prev?.scene) { say('앞 컷에 장면이 없어요.'); return; } update(x => pasteScene(x, sel.id, prev.scene, prev.thumb)); say('앞 컷에서 장면을 가져왔어요.'); }}>이전 컷에서 가져오기</button>
                  <button type="button" className="btn small" aria-pressed={swapFrom === sel.id} onClick={() => { setSwapFrom(swapFrom === sel.id ? null : sel.id); say(''); }}>{swapFrom === sel.id ? '바꾸기 취소' : '다른 컷과 바꾸기'}</button>
                  <button type="button" className="btn small ghost danger" disabled={!sel.scene} onClick={() => { if (confirm('이 컷의 장면을 비울까요?')) update(x => clearCut(x, sel.id)); }}>비우기</button>
                </div>
              </>
            ) : (
              <>
                <h2>컷</h2>
                <p className="sub">페이지에서 컷을 골라 주세요.</p>
              </>
            )}
            {note && <p className="sub" role="status">{note}{lastSwap && <> <button type="button" className="linkbtn" onClick={() => { const [a, b] = lastSwap; void update(x => swapCuts(x, a, b)); setSelected(a); setLastSwap(null); say('맞바꾼 것을 되돌렸어요.'); }}>되돌리기</button></>}</p>}
          </section>

          <details className="panel fold" aria-label="작품 설정">
            <summary><h2>작품 설정</h2><span className="fold-sum">{work?.title || '작품 이름 없음'} · 등장인물 {work?.characters.length ?? 0}명</span></summary>
            <dl className="stat">
              <dt>작품 제목</dt><dd>{work?.title || '없음'}</dd>
              <dt>작품 설명</dt><dd className="clamp">{work?.world || '없음'}</dd>
              <dt>등장인물</dt><dd>{work?.characters.map(c => `${c.name || c.slot}${c.model ? '' : '(모델 없음)'}`).join(', ')}</dd>
            </dl>
            <div className="btnrow">
              <button type="button" className="btn small" onClick={() => setWorkOpen(true)} disabled={!work}>작품 설정 고치기</button>
              <button
                type="button"
                className="btn small ghost danger"
                onClick={async () => { if (confirm(`이 원고(${m.title})를 지울까요? 되돌릴 수 없어요.`)) { await deleteManuscript(m.id); navigate('/'); } }}
              >
                이 원고({m.title}) 지우기
              </button>
            </div>
          </details>

          <details className="panel fold" aria-label="틀 변경">
            <summary><h2>틀 변경 · 제목</h2><span className="fold-sum">{m.format === 'page' ? `${pageIndex + 1}페이지 · ${templateLabel(templateOf(page, m.template))}${page.title ? ' · 제목 있음' : ''}` : '웹툰 세로'}</span></summary>
            {m.format === 'page' ? (
              <TemplateChanger
                key={`${page.id}/${templateOf(page, m.template)}`}
                pageNumber={pageIndex + 1}
                current={templateOf(page, m.template)}
                style={m.style}
                ratio={m.pageRatio}
                lostFor={t => scenesLostByTemplate(m, pageIndex, t)}
                onApply={async t => {
                  await update(x => changePageTemplate(x, pageIndex, t).manuscript);
                  setSelected(null);
                  say(`${pageIndex + 1}페이지 틀을 "${templateLabel(t)}"(으)로 바꿨어요.`);
                }}
                customPage={page.split ? page : null}
                onDraw={() => setDrawFor(pageIndex)}
              />
            ) : (
              <p className="sub">웹툰은 틀 대신 왼쪽 "+ 컷 추가"로 아래에 컷을 더해요.</p>
            )}
            {m.format === 'page' && (
              <TitleEditor
                key={`${page.id}/${JSON.stringify(page.title ?? null)}`}
                pageIndex={pageIndex}
                pageCount={m.pages.length}
                title={page.title}
                onApply={async (title, pages) => {
                  await update(x => applyTitle(x, pages, pageIndex, title));
                  const where = pages.length === m.pages.length && pages.length > 1 ? '모든 페이지' : pages.map(i => i + 1).join(', ') + '페이지';
                  say(title ? `${where}에 제목을 넣었어요.` : `${where}에서 제목을 뺐어요.`);
                }}
              />
            )}
          </details>

          {m.format === 'page' && (
            <details className="panel fold" aria-label="페이지 비율">
              <summary><h2>페이지 비율</h2><span className="fold-sum">{fmtRatio(m.pageRatio)}</span></summary>
              <RatioChanger
                key={m.pageRatio.join(':')}
                current={m.pageRatio}
                pageCount={m.pages.length}
                onApply={async r => {
                  await update(x => changePageRatio(x, r));
                  say(`페이지 비율을 ${fmtRatio(r)}(으)로 바꿨어요. 컷 그림은 차례로 다시 그려져요.`);
                }}
              />
            </details>
          )}
        </aside>
      </div>

      {m.format === 'page' && (
        <PageTemplateDialog
          open={tplDialog !== null}
          mode="add"
          pageNumber={m.pages.length + 1}
          initial={templateOf(m.pages[m.pages.length - 1], m.template)}
          style={m.style}
          ratio={m.pageRatio}
          lostFor={t => scenesLostByTemplate(m, pageIndex, t)}
          onClose={() => setTplDialog(null)}
          onConfirm={async t => {
            setJumpTo(m.pages.length);
            await update(x => addPage(x, t));
            say(t === 'custom' ? `${m.pages.length + 1}페이지를 추가했어요. 선을 그어 컷을 나눠 보세요.` : `${m.pages.length + 1}페이지를 "${templateLabel(t)}" 틀로 추가했어요.`);
            setSelected(null);
            setTplDialog(null);
            if (t === 'custom') setDrawFor(m.pages.length);
          }}
        />
      )}
      {m.format === 'page' && drawFor !== null && m.pages[drawFor] && (
        <CutDrawDialog
          open
          page={m.pages[drawFor]}
          fallback={m.template}
          style={pageStyle(m.style, m.pages[drawFor])}
          ratio={m.pageRatio}
          title={`${drawFor + 1}페이지 컷 직접 그리기`}
          onClose={() => setDrawFor(null)}
          onApply={async root => {
            const i = drawFor;
            await update(x => ({ ...x, pages: x.pages.map((p, j) => (j === i ? applySplit(p, root, pageStyle(x.style, p), x.pageRatio) ?? p : p)) }));
            setDrawFor(null);
            setSelected(null);
            say(`${i + 1}페이지 컷을 직접 그린 틀로 바꿨어요.`);
          }}
        />
      )}
      <ExportDialog
        open={exportOpen}
        pageNumber={pageIndex + 1}
        onClose={() => setExportOpen(false)}
        busy={exportBusy}
        pageCount={m.pages.length}
        onExport={async (kind: ExportKind, opt: ExportOptions) => {
          const base = `${work?.title || '작품'}_${m.title || '원고'}`;
          if (kind === 'file') { if (work) downloadJSON(`${base}.rough.json`, toReadableFile(work, m)); }
          else if (work) {
            // 컷마다 보이지 않는 엔진으로 크게 다시 그려서 합친다 (원고 화면의 작은 그림은 가로 360px라 흐림)
            const which = kind === 'pagePng' ? [pageIndex] : m.pages.map((_, i) => i);
            const files: [string, Uint8Array][] = [];
            try {
              for (const [n, i] of which.entries()) {
                const blob = await renderPagePng(m, work.characters, i, opt, (done, total) =>
                  setExportBusy(`${which.length > 1 ? `${n + 1}/${which.length}페이지 · ` : ''}고화질로 그리는 중… ${Math.min(done + 1, total)}/${total}컷`));
                if (kind === 'pagePng') downloadBlob(blob, `${base}_${i + 1}페이지.png`);
                else files.push([`${String(i + 1).padStart(2, '0')}페이지.png`, new Uint8Array(await blob.arrayBuffer())]);
              }
              if (kind === 'allPng') { setExportBusy('ZIP으로 묶는 중…'); downloadBlob(makeZip(files), `${base}_전체.zip`); }
              say(kind === 'allPng' ? `원고 전체 ${which.length}페이지를 ZIP으로 내보냈어요.` : `${pageIndex + 1}페이지를 그림으로 내보냈어요.`);
            } catch (e) {
              say(e instanceof Error ? e.message : '그림을 만들지 못했어요.');
            } finally { setExportBusy(''); }
          }
          setExportOpen(false);
        }}
      />
      {work && (
        <ImportPoseDialog
          open={importOpen}
          manuscript={m}
          characters={work.characters}
          scopes={['cut', 'page', 'all', 'whole']}
          cutId={sel ? sel.id : null}
          pageIndex={pageIndex}
          onClose={() => setImportOpen(false)}
          onApply={async (fn, sum) => {
            setImportOpen(false);
            await update(fn);
            setSelected(null);
            say(`컷 ${sum.applied}개에 불러왔어요${sum.replaced ? ` (장면 ${sum.replaced}개 바뀜)` : ''}. 그림은 곧 새로 그려져요.`);
          }}
        />
      )}
      {work && bakeQueue.length > 0 && (
        <ThumbBaker
          manuscript={m}
          characters={work.characters}
          queue={bakeQueue}
          onThumb={async (id, thumb, scene) => { if (thumb || scene) await update(x => updateCut(x, id, scene ? { scene, ...(thumb ? { thumb } : {}) } : { thumb })); }}
          onFinish={() => setBakeQueue([])}
        />
      )}
      {work && (
        <StoryboardDialog
          open={sbOpen}
          manuscript={m}
          characters={work.characters}
          pageIndex={pageIndex}
          onClose={() => setSbOpen(false)}
          onApply={async (fn, first, summary) => {
            setSbOpen(false);
            await update(fn);
            setJumpTo(first);
            setSelected(null);
            say(summary);
          }}
        />
      )}
      {work && <WorkDialog work={work} open={workOpen} onClose={() => setWorkOpen(false)} onSave={w => { updateWork(w); setWorkOpen(false); }} />}
    </>
  );
}

/** 입력하는 동안은 화면에만, 칸을 벗어나거나 Enter를 누르면 저장 */
function TitleInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => { if (text.trim() !== value) onSave(text.trim()); };
  return (
    <>
      <label className="vh" htmlFor="msTitle">원고 제목</label>
      <input id="msTitle" type="text" value={text} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={{ maxWidth: 220 }} />
    </>
  );
}

/** 오른쪽 "틀 변경": 지금 페이지의 틀을 골라 적용. 사라질 장면이 있으면 미리 알려준다 */
function TemplateChanger({ pageNumber, current, style, ratio, lostFor, onApply, onDraw, customPage }: {
  pageNumber: number; current: TemplateId; style: FrameStyle; ratio: [number, number];
  lostFor: (t: TemplateId) => number; onApply: (t: TemplateId) => void;
  onDraw: () => void; customPage: Page | null;
}) {
  const [value, setValue] = useState(current);
  const same = value === current;
  const lost = same ? 0 : lostFor(value);
  return (
    <div className="tplchange">
      <TemplatePicker name="pageTemplateSide" format="page" style={style} ratio={ratio} value={value} onChange={t => { if (t !== 'custom') setValue(t); }} onDraw={onDraw} customPage={customPage} />
      <p className="sect-note" role="status" style={lost ? { color: 'var(--danger)' } : undefined}>
        {same ? (current === 'custom' ? `${pageNumber}페이지는 직접 그린 틀이에요. "직접 그리기"를 누르면 선을 고칠 수 있어요.` : `${pageNumber}페이지의 지금 틀이에요.`) : lost ? `컷이 모자라서 뒤쪽 장면 ${lost}개가 사라져요.` : '장면은 앞 컷부터 차례로 옮겨져요.'}
      </p>
      <button
        type="button"
        className={`btn small ${lost ? 'danger' : 'primary'}`}
        disabled={same}
        onClick={() => { if (!lost || confirm(`장면 ${lost}개가 사라져요. 바꿀까요?`)) onApply(value); }}
      >
        {lost ? `장면 ${lost}개 지우고 ${pageNumber}페이지에 적용` : `${pageNumber}페이지에 적용`}
      </button>
    </div>
  );
}

const fmtRatio = (r: [number, number]) => `${+r[0].toFixed(2)}:${+r[1].toFixed(2)}`;
const RATIO_PRESETS: { r: [number, number]; label: string }[] = [
  { r: DEFAULT_PAGE_RATIO, label: '기본' },
  { r: [4, 5], label: '인스타' },
  { r: [1, 3], label: '세로 4컷' },
  { r: [1, 1], label: '정사각형' },
  { r: [3, 4], label: '3:4' },
  { r: [5, 7], label: '종이책' },
  { r: [9, 16], label: '스토리' },
];

/** 오른쪽 "페이지 비율": 원고 전체 페이지의 가로:세로를 바꾼다. 칸은 새 높이에 맞춰 늘고 장면은 그대로 */
function RatioChanger({ current, pageCount, onApply }: { current: [number, number]; pageCount: number; onApply: (r: [number, number]) => void }) {
  const [r, setR] = useState<[number, number]>(current);
  const num = (v: string) => Math.min(50, Math.max(1, Number(v) || 1));
  const eq = (a: [number, number], b: [number, number]) => Math.abs(a[0] / a[1] - b[0] / b[1]) < 1e-6;
  const same = eq(r, current);
  return (
    <div className="ratiochange">
      <div className="chips" role="radiogroup" aria-label="자주 쓰는 비율">
        {RATIO_PRESETS.map(p => (
          <button key={p.label} type="button" role="radio" className="chip" aria-checked={eq(r, p.r)} onClick={() => setR(p.r)}>
            {p.label}{p.label.includes(':') ? '' : ` ${fmtRatio(p.r)}`}
          </button>
        ))}
      </div>
      <span className="ratio" role="group" aria-label="페이지 비율 (가로:세로)">
        <input className="num" type="number" min={1} max={50} step={0.1} aria-label="가로" value={r[0]} onChange={e => setR([num(e.target.value), r[1]])} />
        <span className="ratio-sep" aria-hidden="true">:</span>
        <input className="num" type="number" min={1} max={50} step={0.1} aria-label="세로" value={r[1]} onChange={e => setR([r[0], num(e.target.value)])} />
      </span>
      <p className="sect-note">모든 페이지({pageCount})에 적용돼요. 가로는 그대로, 칸이 새 높이에 맞춰 늘거나 줄고 장면·제목은 그대로 남아요. 컷 그림은 새 비율로 다시 그려져요.</p>
      <button type="button" className="btn small primary" disabled={same} onClick={() => onApply(r)}>
        {same ? '지금 비율이에요' : `${fmtRatio(r)}(으)로 바꾸기`}
      </button>
    </div>
  );
}

/** 틀 변경 아래 "제목 넣기": 위치·글꼴·크기를 고르고 이 페이지/모든 페이지/고른 페이지에 적용 */
function TitleEditor({ pageIndex, pageCount, title, onApply }: {
  pageIndex: number; pageCount: number; title: PageTitle | undefined;
  onApply: (title: PageTitle | null, pages: number[]) => void;
}) {
  const [on, setOn] = useState(!!title);
  const [t, setT] = useState<PageTitle>(title ?? DEFAULT_TITLE);
  const [scope, setScope] = useState<'this' | 'all' | 'pick'>('this');
  const [picked, setPicked] = useState<number[]>([pageIndex]);
  const set = (patch: Partial<PageTitle>) => setT(v => ({ ...v, ...patch }));
  const pages = scope === 'this' ? [pageIndex] : scope === 'all' ? Array.from({ length: pageCount }, (_, i) => i) : picked;
  const target = scope === 'all' ? '모든 페이지' : pages.length ? `${pages.map(i => i + 1).join(', ')}페이지` : '페이지를 골라 주세요';
  const reserves = on && t.pos !== 'in-cut';
  const changed = on !== !!title || (on && JSON.stringify(t) !== JSON.stringify(title)) || scope !== 'this';
  return (
    <div className="titleedit">
      <label className="check">
        <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} />
        제목 넣기 <Info text="페이지 위(또는 오른쪽)에 제목을 써요. 제목 자리만큼 컷이 조금 줄어들고, 장면은 그대로 남아요." />
      </label>
      {on && (
        <div className="titlefields">
          <label>제목
            <input type="text" value={t.text} maxLength={40} placeholder="예: 오늘의 간식" onChange={e => set({ text: e.target.value })} />
          </label>
          <label>위치
            <select value={t.pos} onChange={e => set({ pos: e.target.value as TitlePos })}>
              {TITLE_POS.map(([k, n, d]) => <option key={k} value={k} title={d}>{n}</option>)}
            </select>
          </label>
          <label>글꼴
            <select value={t.font} onChange={e => set({ font: e.target.value })} style={{ fontFamily: `'${t.font}'` }}>
              {TITLE_FONTS.map(([f, n]) => <option key={f} value={f} style={{ fontFamily: `'${f}'` }}>{n}</option>)}
            </select>
          </label>
          <label>크기
            <select value={t.size} onChange={e => set({ size: Number(e.target.value) })}>
              {TITLE_SIZES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <label>{t.pos === 'band' ? '띠 색' : '글자 색'}
            <input type="color" value={t.color} onChange={e => set({ color: e.target.value })} />
          </label>
          <p className="sect-note">{TITLE_POS.find(x => x[0] === t.pos)?.[2]}</p>
        </div>
      )}
      <label className="titlescope">적용할 페이지
        <select value={scope} onChange={e => { const v = e.target.value as typeof scope; setScope(v); if (v === 'pick' && !picked.length) setPicked([pageIndex]); }}>
          <option value="this">이 페이지만</option>
          <option value="all">모든 페이지</option>
          <option value="pick">페이지 고르기</option>
        </select>
      </label>
      {scope === 'pick' && (
        <div className="chips" role="group" aria-label="제목을 넣을 페이지">
          {Array.from({ length: pageCount }, (_, i) => (
            <button key={i} type="button" className="chip" aria-pressed={picked.includes(i)} onClick={() => setPicked(v => (v.includes(i) ? v.filter(x => x !== i) : [...v, i].sort((a, b) => a - b)))}>{i + 1}</button>
          ))}
        </div>
      )}
      {on && scope !== 'this' && <p className="sect-note">다른 페이지에 이미 쓴 제목 글자는 그대로 두고, 위치·글꼴·크기·색만 맞춰요. 제목 글자가 없는 페이지에는 같은 제목이 들어가요.</p>}
      {reserves && !title && <p className="sect-note">제목 자리만큼 컷 높이가 조금 줄어요.</p>}
      <button type="button" className="btn small primary" disabled={!changed || !pages.length} onClick={() => onApply(on ? { ...t, text: t.text.trim() } : null, pages)}>
        {on ? `${target}에 적용` : `${target}에서 제목 빼기`}
      </button>
    </div>
  );
}
