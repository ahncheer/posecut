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
            <rect x={x} y={y} width={w} height={h} fill="#F8F7F2" />
            {c.thumb && <image href={c.thumb} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />}
            {!c.thumb && interactive && <text className="hint" x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle">장면 만들기</text>}
            <rect x={x} y={y} width={w} height={h} fill="none" stroke={style.border.color} strokeWidth={style.border.width} />
            {showNumbers && (
              <text x={x + 6} y={y + 14} fontSize="10" fill="#5B5E62">{i + 1}</text>
            )}
            {sel && <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} fill="none" stroke="#2F5FBF" strokeWidth="2.5" rx="2" />}
          </g>
        );
      })}
    </svg>
  );
}
