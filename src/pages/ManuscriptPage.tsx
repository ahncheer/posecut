// 원고 화면: 페이지 목록, 페이지와 컷, 선택한 컷 패널, 원고 설정
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar';
import { PageView } from '../components/PageView';
import { WorkDialog } from '../components/WorkDialog';
import { exportSvgAsPng } from '../components/exportPage';
import { useManuscript } from '../storage/useManuscript';
import { addPage, clearCut, findCut, pasteScene, previousCut, removePage } from '../scene/manuscript';
import { cutRatio } from '../scene/layout';
import { copyScene, readClip } from '../storage/clipboard';
import { downloadJSON, toFile } from '../storage/file-io';
import { deleteManuscript } from '../storage/db';

export function ManuscriptPage() {
  const { msId } = useParams();
  const navigate = useNavigate();
  const { loading, manuscript: m, work, update, updateWork } = useManuscript(msId);
  const [pageIndex, setPageIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const [note, setNote] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (m && pageIndex >= m.pages.length) setPageIndex(m.pages.length - 1); }, [m, pageIndex]);

  if (loading) return <><TopBar /><p className="sub" style={{ padding: 16 }}>불러오는 중…</p></>;
  if (!m) return <><TopBar /><div style={{ padding: 16 }} className="panel"><p>원고를 찾을 수 없어요.</p><Link to="/" className="btn">내 원고로</Link></div></>;

  const page = m.pages[Math.min(pageIndex, m.pages.length - 1)];
  const found = selected ? findCut(m, selected) : null;
  const sel = found?.cut ?? null;
  const ratio = sel ? cutRatio(sel.rect) : null;
  const openCut = (id: string) => navigate(`/m/${m.id}/cut/${id}`);
  const say = (t: string) => setNote(t);

  return (
    <>
      <TopBar>
        <Link to="/" className="btn small ghost">← 내 원고</Link>
        <TitleInput value={m.title} onSave={title => update(x => ({ ...x, title }))} />
        <span className="sub">{work?.title || '작품 이름 없음'} · 자동 저장됨</span>
        <button type="button" className="btn small" onClick={() => setWorkOpen(true)} disabled={!work}>작품 설정</button>
        <button type="button" className="btn small" onClick={() => work && downloadJSON(`${m.title || '원고'}.rough.json`, toFile(work, m))}>원고 파일로 저장</button>
        <button
          type="button"
          className="btn small"
          onClick={async () => {
            const svg = canvasRef.current?.querySelector('svg');
            if (svg) await exportSvgAsPng(svg, `${m.title || '원고'}_${pageIndex + 1}페이지.png`);
          }}
        >
          페이지 PNG (미리보기 화질)
        </button>
      </TopBar>

      <div className="msview">
        <aside className="pagelist" aria-label="페이지">
          <h2>{m.format === 'page' ? '페이지' : '웹툰'}</h2>
          {m.pages.map((p, i) => (
            <button key={p.id} type="button" className="pagethumb" aria-current={i === pageIndex} onClick={() => { setPageIndex(i); setSelected(null); }}>
              <PageView page={p} style={m.style} width={90} showNumbers={false} label={`${i + 1}페이지 미리보기`} />
              <span>{i + 1}</span>
            </button>
          ))}
          <button type="button" className="btn small" onClick={() => update(addPage)}>
            {m.format === 'page' ? '+ 같은 틀 페이지' : '+ 컷 추가'}
          </button>
          {m.format === 'page' && m.pages.length > 1 && (
            <button
              type="button"
              className="btn small ghost danger"
              onClick={() => { if (confirm(`${pageIndex + 1}페이지를 지울까요? 안의 장면도 함께 지워져요.`)) update(x => removePage(x, pageIndex)); }}
            >
              이 페이지 지우기
            </button>
          )}
        </aside>

        <section className="canvaswrap" ref={canvasRef} aria-label="페이지">
          <PageView
            page={page}
            style={m.style}
            width={m.format === 'page' ? 360 : 420}
            selectedCutId={selected}
            onSelect={setSelected}
            onOpen={openCut}
            label={`${pageIndex + 1}페이지, 컷 ${page.cuts.length}개`}
          />
          <p className="sub" style={{ marginTop: 8 }}>컷을 누르면 선택, 두 번 누르면 장면 편집으로 들어가요.</p>
        </section>

        <aside style={{ display: 'grid', gap: 12 }}>
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
                  <button type="button" className="btn small ghost danger" disabled={!sel.scene} onClick={() => { if (confirm('이 컷의 장면을 비울까요?')) update(x => clearCut(x, sel.id)); }}>비우기</button>
                </div>
              </>
            ) : (
              <>
                <h2>컷</h2>
                <p className="sub">페이지에서 컷을 골라 주세요.</p>
              </>
            )}
            {note && <p className="sub" role="status">{note}</p>}
          </section>

          <section className="panel" aria-label="등장인물">
            <div style={{ display: 'flex', alignItems: 'center' }}><h2 style={{ flex: 1 }}>등장인물</h2><button type="button" className="btn small ghost" onClick={() => setWorkOpen(true)}>수정</button></div>
            {work?.characters.map(c => (
              <div key={c.slot} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="avatar" aria-hidden="true">{c.slot}</span>
                <span>{c.name}<br /><small className="sub">{c.model ? (c.model.kind === 'sample' ? '샘플 캐릭터' : c.model.name) : '모델 없음'}{c.role ? ` · ${c.role}` : ''}</small></span>
              </div>
            ))}
          </section>

          <section className="panel" aria-label="원고 설정">
            <h2>원고 설정</h2>
            <dl className="stat">
              <dt>형식</dt><dd>{m.format === 'page' ? `페이지 만화 · ${m.pageRatio[0]}:${m.pageRatio[1]}` : '웹툰 세로'}</dd>
              <dt>컷 사이 여백</dt><dd>{m.style.gutter}</dd>
              <dt>바깥 여백</dt><dd>{m.style.margin}</dd>
            </dl>
            <div className="nums" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">테두리 굵기
                <input type="number" min={0} max={10} value={m.style.border.width} onChange={e => update(x => ({ ...x, style: { ...x.style, border: { ...x.style.border, width: Math.min(10, Math.max(0, Number(e.target.value) || 0)) } } }))} />
              </label>
              <label className="field">테두리 색
                <input type="color" value={m.style.border.color} onChange={e => update(x => ({ ...x, style: { ...x.style, border: { ...x.style.border, color: e.target.value } } }))} style={{ width: '100%', height: 36, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)' }} />
              </label>
            </div>
            <button
              type="button"
              className="btn small ghost danger"
              onClick={async () => { if (confirm('이 원고를 지울까요? 되돌릴 수 없어요.')) { await deleteManuscript(m.id); navigate('/'); } }}
            >
              원고 지우기
            </button>
          </section>
        </aside>
      </div>

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
