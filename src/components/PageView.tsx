// 페이지 한 장을 SVG로 그린다: 컷 테두리, 여백, 컷마다 작은 그림.
import type { FrameStyle, Page } from '../scene/types';
import { PAGE_W } from '../scene/layout';

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
            {sel && d && <path d={d} fill="none" stroke="#2F5FBF" strokeWidth={style.border.width + 7} strokeLinejoin="round" />}
            {d ? <path d={d} fill="#F8F7F2" /> : <rect x={x} y={y} width={w} height={h} fill="#F8F7F2" />}
            {c.thumb && <image href={c.thumb} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={d ? `url(#${clipId})` : undefined} />}
            {!c.thumb && interactive && <text className="hint" x={cx} y={cy + 4} textAnchor="middle">장면 만들기</text>}
            {d
              ? <path d={d} fill="none" stroke={style.border.color} strokeWidth={style.border.width} strokeLinejoin="miter" />
              : <rect x={x} y={y} width={w} height={h} fill="none" stroke={style.border.color} strokeWidth={style.border.width} />}
            {showNumbers && (
              <text x={d ? numX : x + 6} y={d ? numY : y + 14} fontSize="10" fill="#5B5E62">{i + 1}</text>
            )}
            {sel && !d && <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} fill="none" stroke="#2F5FBF" strokeWidth="2.5" rx="2" />}
          </g>
        );
      })}
    </svg>
  );
}
