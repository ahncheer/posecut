// 페이지 한 장을 SVG로 그린다: 컷 테두리, 여백, 컷마다 작은 그림.
import type { FrameStyle, Page } from '../scene/types';
import { PAGE_W } from '../scene/layout';
import { titleReserve } from '../scene/title';

interface Props {
  page: Page;
  style: FrameStyle;
  /** 화면에 그릴 가로 픽셀 */
  width: number;
  selectedCutId?: string | null;
  onSelect?: (cutId: string) => void;
  onOpen?: (cutId: string) => void;
  /** 컷 번호 앞에 붙는 숫자 (페이지마다 1부터) */
  showNumbers?: boolean;
  label?: string;
}

export function PageView({ page, style, width, selectedCutId, onSelect, onOpen, showNumbers = true, label }: Props) {
  const height = (width * page.height) / PAGE_W;
  const interactive = !!onSelect;
  return (
    <svg className="pagesvg" width={width} height={height} viewBox={`0 0 ${PAGE_W} ${page.height}`} role="img" aria-label={label ?? `페이지, 컷 ${page.cuts.length}개`}>
      <rect x="0" y="0" width={PAGE_W} height={page.height} fill="#FFFFFF" />
      {page.title && <TitleMark page={page} style={style} hint={interactive} />}
      {page.cuts.map((c, i) => {
        const sel = c.id === selectedCutId;
        const { x, y, w, h } = c.rect;
        const d = c.poly ? `M${c.poly.map(pt => pt.join(' ')).join('L')}Z` : null;
        const clipId = `clip-${page.id}-${c.id}`;
        // 컷 번호는 컷 안쪽 왼쪽 위 꼭짓점 근처에
        const corner = c.poly ? c.poly.reduce((a, b) => (b[0] + b[1] < a[0] + a[1] ? b : a)) : [x, y];
        const cx = c.poly ? c.poly.reduce((a, b) => a + b[0], 0) / c.poly.length : x + w / 2;
        const cy = c.poly ? c.poly.reduce((a, b) => a + b[1], 0) / c.poly.length : y + h / 2;
        const numX = corner[0] + (cx - corner[0]) * 0.18 + 2, numY = corner[1] + (cy - corner[1]) * 0.18 + 10;
        return (
          <g
            key={c.id}
            data-cut={c.id}
            data-rect={`${x},${y},${w},${h}`}
            data-clip={d ? clipId : undefined}
            className={interactive ? 'cutbox' : undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'button' : undefined}
            aria-label={interactive ? `컷 ${i + 1}${c.scene ? '' : ', 비어 있음'}` : undefined}
            aria-pressed={interactive ? sel : undefined}
            onClick={onSelect ? () => onSelect(c.id) : undefined}
            onDoubleClick={onOpen ? () => onOpen(c.id) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter') (onOpen ?? onSelect)?.(c.id); if (e.key === ' ') { e.preventDefault(); onSelect?.(c.id); } } : undefined}
          >
            {d && <clipPath id={clipId}><path d={d} /></clipPath>}
            {sel && d && <path className="selmark" d={d} fill="none" stroke="#2F5FBF" strokeWidth={style.border.width + 7} strokeLinejoin="round" />}
            {d ? <path d={d} fill="#F8F7F2" /> : <rect x={x} y={y} width={w} height={h} fill="#F8F7F2" />}
            {c.thumb && <image data-cutimg={c.id} href={c.thumb} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={d ? `url(#${clipId})` : undefined} />}
            {!c.thumb && interactive && <text className="hint" x={cx} y={cy + 4} textAnchor="middle">장면 만들기</text>}
            {d
              ? <path d={d} fill="none" stroke={style.border.color} strokeWidth={style.border.width} strokeLinejoin="miter" />
              : <rect x={x} y={y} width={w} height={h} fill="none" stroke={style.border.color} strokeWidth={style.border.width} />}
            {showNumbers && (
              <text x={d ? numX : x + 6} y={d ? numY : y + 14} fontSize="10" fill="#5B5E62">{i + 1}</text>
            )}
            {sel && !d && <rect className="selmark" x={x - 3} y={y - 3} width={w + 6} height={h + 6} fill="none" stroke="#2F5FBF" strokeWidth="2.5" rx="2" />}
          </g>
        );
      })}
      {page.title?.pos === 'in-cut' && <TitleMark page={page} style={style} hint={interactive} overlay />}
    </svg>
  );
}

/**
 * 페이지 제목. 글자는 class="pgtitle-t" <text>로 그려서, PNG로 저장할 때 같은 글꼴로 다시 그린다 (exportPage).
 * in-cut(첫 컷 안)은 컷 그림 위에 겹쳐야 해서 overlay일 때만 그린다.
 */
function TitleMark({ page, style, hint, overlay = false }: { page: Page; style: FrameStyle; hint: boolean; overlay?: boolean }) {
  const t = page.title!;
  if ((t.pos === 'in-cut') !== overlay) return null;
  const text = t.text.trim();
  if (!text && !hint) return null;
  const shown = text || '제목';
  const m = style.margin, r = titleReserve(t);
  const font = `'${t.font}', 'Noto Sans KR', sans-serif`;
  const common = { className: 'pgtitle-t', fontFamily: font, fontSize: t.size, fill: t.color, opacity: text ? 1 : 0.3, 'data-font': t.font } as const;
  if (t.pos === 'side') {
    const x = PAGE_W - m - r.right / 2, chars = [...shown], step = t.size * 1.08;
    return (
      <g aria-label={`제목 ${text}`}>
        {chars.map((ch, i) => (
          <text key={i} {...common} x={x} y={m + t.size * 0.5 + i * step} textAnchor="middle" dominantBaseline="central">{ch === ' ' ? '\u00a0' : ch}</text>
        ))}
      </g>
    );
  }
  if (t.pos === 'in-cut') {
    const c = page.cuts[0];
    if (!c) return null;
    const x = c.rect.x + 18, y = c.rect.y + 6, h = t.size * 1.45, w = Math.min(c.rect.w - 24, shown.length * t.size * 0.95 + t.size * 0.9);
    return (
      <g aria-label={`제목 ${text}`}>
        <rect x={x} y={y} width={w} height={h} rx={3} fill="#FFFFFF" stroke={style.border.color} strokeWidth={Math.max(1, style.border.width * 0.75)} opacity={text ? 1 : 0.6} />
        <text {...common} x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central">{shown}</text>
      </g>
    );
  }
  const band = t.pos === 'band';
  const top = m, h = r.top - style.gutter / 2;
  const x = t.pos === 'top-left' ? m + 4 : t.pos === 'top-right' ? PAGE_W - m - 4 : PAGE_W / 2;
  const anchor = t.pos === 'top-left' ? 'start' : t.pos === 'top-right' ? 'end' : 'middle';
  return (
    <g aria-label={`제목 ${text}`}>
      {band && <rect x={m} y={top} width={PAGE_W - 2 * m} height={h} fill={t.color} opacity={text ? 1 : 0.35} />}
      <text {...common} fill={band ? '#FFFFFF' : t.color} x={x} y={top + h / 2} textAnchor={anchor} dominantBaseline="central">{shown}</text>
    </g>
  );
}
