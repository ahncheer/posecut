// 직접 그리기: 페이지 위에 선을 그어 컷을 나눈다 (클립 스튜디오의 컷 나누기처럼).
// 칸을 가로질러 끌기 = 나누기 · 선 끌기 = 옮기기 · 선 끝 점 끌기 = 기울이기 · 선 고르고 지우기 = 합치기
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FrameStyle, Page, SplitNode, TemplateId } from '../scene/types';
import { PAGE_W, pageHeightFor } from '../scene/layout';
import { contentBox, customCuts, leafCount, moveLine, removeLine, splitBySegment, splitOfPage, tiltLine, walk, type Pt } from '../scene/split';
import { Info } from './Info';

interface Props {
  open: boolean;
  page: Page;
  fallback: TemplateId;
  style: FrameStyle;
  ratio: [number, number];
  title: string;
  onClose: () => void;
  onApply: (root: SplitNode) => void;
}

type Drag =
  | { kind: 'draw'; from: Pt; to: Pt }
  | { kind: 'move'; path: string; from: Pt; base: SplitNode; normal: Pt }
  | { kind: 'tilt'; path: string; fixed: Pt; base: SplitNode };

const SNAP_DEG = 7;
/** 수평·수직에 가까우면 딱 맞춘다 */
function snap(from: Pt, to: Pt, on: boolean): Pt {
  if (!on) return to;
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const deg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  if (deg < SNAP_DEG || deg > 180 - SNAP_DEG) return [to[0], from[1]];
  if (Math.abs(deg - 90) < SNAP_DEG) return [from[0], to[1]];
  return to;
}

export function CutDrawDialog({ open, page, fallback, style, ratio, title, onClose, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const height = pageHeightFor(ratio);
  const [root, setRoot] = useState<SplitNode>(() => splitOfPage(page, fallback, style, ratio));
  const [history, setHistory] = useState<SplitNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  const [msg, setMsg] = useState('');
  const start = useRef<SplitNode | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const r = splitOfPage(page, fallback, style, ratio);
      setRoot(r); start.current = r; setHistory([]); setSelected(null); setDrag(null);
      setMsg('칸을 가로질러 끌면 선이 그어지며 나뉘어요.');
      d.showModal();
      svgRef.current?.focus({ preventScroll: true }); // 첫 칸(ⓘ)에 초점이 가서 설명이 저절로 뜨지 않게
    }
    if (!open && d.open) d.close();
  }, [open, page, fallback, style, ratio]);

  const cuts = useMemo(() => customCuts(root, height, style) ?? [], [root, height, style]);
  const { lines } = useMemo(() => walk(root, contentBox(height, style)), [root, height, style]);
  const scenes = useMemo(() => new Map(page.cuts.map(c => [c.id, c])), [page]);

  const commit = (next: SplitNode) => { setHistory(h => [...h.slice(-49), root]); setRoot(next); };
  const undo = () => setHistory(h => { if (!h.length) return h; setRoot(h[h.length - 1]); setSelected(null); return h.slice(0, -1); });

  const toPage = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const deleteLine = (path: string) => {
    const r = removeLine(root, path);
    if ('error' in r) { setMsg(r.error); return; }
    const gone = scenes.get(r.removed);
    if (gone?.scene && !confirm('합치면 한쪽 컷의 장면이 사라져요. 합칠까요?')) return;
    commit(r.root); setSelected(null); setMsg('선을 지워 두 칸을 합쳤어요.');
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); deleteLine(selected); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const t = e.target as Element;
    const p = toPage(e);
    const linePath = t.getAttribute('data-line');
    const end = t.getAttribute('data-end');
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    if (end !== null && selected !== null) {
      const seg = lines.find(l => l.path === selected);
      if (!seg) return;
      setDrag({ kind: 'tilt', path: selected, fixed: end === '0' ? seg.b : seg.a, base: root });
      return;
    }
    if (linePath !== null) {
      const seg = lines.find(l => l.path === linePath)!;
      const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], L = Math.hypot(dx, dy) || 1;
      setSelected(linePath);
      setDrag({ kind: 'move', path: linePath, from: p, base: root, normal: [-dy / L, dx / L] });
      setMsg('선을 끌어 옮기고, 끝의 점을 끌면 기울어져요. Delete 키나 "선 지우기"로 합쳐요.');
      return;
    }
    setSelected(null);
    setDrag({ kind: 'draw', from: p, to: p });
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toPage(e);
    if (drag.kind === 'draw') setDrag({ ...drag, to: snap(drag.from, p, snapOn) });
    else if (drag.kind === 'move') {
      const k = (p[0] - drag.from[0]) * drag.normal[0] + (p[1] - drag.from[1]) * drag.normal[1];
      const next = moveLine(drag.base, height, style, drag.path, drag.normal[0] * k, drag.normal[1] * k);
      if (next) setRoot(next);
    } else {
      const next = tiltLine(drag.base, height, style, drag.path, drag.fixed, snap(drag.fixed, p, snapOn));
      if (next) setRoot(next);
    }
  };
  const onUp = () => {
    if (!drag) return;
    if (drag.kind === 'draw') {
      const len = Math.hypot(drag.to[0] - drag.from[0], drag.to[1] - drag.from[1]);
      if (len >= 12) {
        const r = splitBySegment(root, height, style, drag.from, drag.to);
        if (r.split) { commit(r.root); setMsg(`칸 ${r.split}개를 나눴어요. 컷 ${leafCount(r.root)}개.`); }
        else setMsg('여기서는 나눌 수 없어요. 칸을 가로지르게 끌거나, 칸이 너무 작아지지 않게 해 주세요.');
      }
    } else if (drag.base !== root) {
      setHistory(h => [...h.slice(-49), drag.base]);
    }
    setDrag(null);
  };

  const segSel = selected !== null ? lines.find(l => l.path === selected) : null;
  const vbPad = 6;

  return (
    <dialog ref={ref} className="drawdlg" onClose={onClose} aria-labelledby="drawTitle">
      <div className="draw">
        <div className="draw-stage">
          <svg
            ref={svgRef}
            tabIndex={-1}
            className="draw-svg"
            viewBox={`${-vbPad} ${-vbPad} ${PAGE_W + vbPad * 2} ${height + vbPad * 2}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            role="application"
            aria-label="컷 나누기 판. 칸을 가로질러 끌면 선이 그어져요."
          >
            <rect x={0} y={0} width={PAGE_W} height={height} fill="#FFFFFF" stroke="#C9C8C1" strokeWidth="0.6" />
            {cuts.map((c, i) => {
              const d = `M${c.poly.map(p => p.join(' ')).join('L')}Z`;
              const thumb = scenes.get(c.id)?.thumb;
              const cx = c.poly.reduce((a, p) => a + p[0], 0) / c.poly.length, cy = c.poly.reduce((a, p) => a + p[1], 0) / c.poly.length;
              return (
                <g key={c.id} pointerEvents="none">
                  <clipPath id={`dclip-${c.id}`}><path d={d} /></clipPath>
                  <path d={d} fill="#F8F7F2" />
                  {thumb && <image href={thumb} x={c.rect.x} y={c.rect.y} width={c.rect.w} height={c.rect.h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#dclip-${c.id})`} opacity="0.85" />}
                  <path d={d} fill="none" stroke={style.border.color} strokeWidth={style.border.width} />
                  <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#9A9B97">{i + 1}</text>
                </g>
              );
            })}
            {lines.map(l => {
              const on = l.path === selected || l.path === hover;
              return (
                <g key={l.path}>
                  <line x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke={l.path === selected ? '#D2541F' : '#2F5FBF'} strokeWidth={on ? 2.2 : 1} strokeDasharray={on ? undefined : '4 3'} opacity={on ? 1 : 0.55} pointerEvents="none" />
                  <line
                    data-line={l.path}
                    x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]}
                    stroke="transparent" strokeWidth={Math.max(12, style.gutter + 6)}
                    style={{ cursor: Math.abs(l.a[0] - l.b[0]) < 0.5 ? 'ew-resize' : Math.abs(l.a[1] - l.b[1]) < 0.5 ? 'ns-resize' : 'move' }}
                    onPointerEnter={() => setHover(l.path)}
                    onPointerLeave={() => setHover(h => (h === l.path ? null : h))}
                  />
                </g>
              );
            })}
            {segSel && [segSel.a, segSel.b].map((p, i) => (
              <circle key={i} data-end={i} cx={p[0]} cy={p[1]} r={6} fill="#FFFFFF" stroke="#D2541F" strokeWidth="2" style={{ cursor: 'grab' }} />
            ))}
            {drag?.kind === 'draw' && Math.hypot(drag.to[0] - drag.from[0], drag.to[1] - drag.from[1]) > 2 && (
              <line x1={drag.from[0]} y1={drag.from[1]} x2={drag.to[0]} y2={drag.to[1]} stroke="#D2541F" strokeWidth="1.6" strokeDasharray="5 3" pointerEvents="none" />
            )}
          </svg>
        </div>
        <div className="draw-side">
          <div className="dlg-head">
            <h2 id="drawTitle">{title}</h2>
            <Info text="칸을 가로질러 끌면 선이 그어지며 칸이 나뉘어요(지나간 칸 모두). 점선을 끌면 선이 옮겨지고, 선을 누르면 양 끝에 점이 생겨 끌어서 기울일 수 있어요. 선을 고르고 Delete 키나 '선 지우기'를 누르면 두 칸이 합쳐져요. 장면은 칸을 따라 그대로 남아요." />
          </div>
          <p className="sub draw-count">컷 {cuts.length}개</p>
          <label className="check-row">
            <input type="checkbox" checked={snapOn} onChange={e => setSnapOn(e.target.checked)} />
            수평·수직에 맞추기
            <Info text={`끄면 비스듬한 선(사선 컷)을 자유롭게 그을 수 있어요. 켜 두면 수평·수직에서 ${SNAP_DEG}° 안쪽은 딱 맞춰져요.`} />
          </label>
          <div className="draw-tools">
            <button type="button" className="btn small" onClick={undo} disabled={!history.length}>↶ 되돌리기</button>
            <button type="button" className="btn small" disabled={selected === null} onClick={() => selected !== null && deleteLine(selected)}>선 지우기 (합치기)</button>
            <button
              type="button"
              className="btn small"
              disabled={leafCount(root) === 1}
              onClick={() => {
                const lostScenes = page.cuts.filter(c => c.scene && c.id !== cuts[0]?.id).length;
                if (lostScenes && !confirm(`한 칸으로 비우면 장면 ${lostScenes}개가 사라져요. 비울까요?`)) return;
                commit({ cut: cuts[0]?.id ?? 'x' }); setSelected(null); setMsg('한 칸으로 비웠어요. 다시 선을 그어 나눠 보세요.');
              }}
            >
              한 칸으로 비우기
            </button>
          </div>
          <p className="sub draw-msg" role="status">{msg}</p>
          <span className="spacer" />
          <div className="actions">
            <button type="button" className="btn" onClick={onClose}>취소</button>
            <button type="button" className="btn primary" disabled={root === start.current} onClick={() => onApply(root)}>적용</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
