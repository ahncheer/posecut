// 컷 틀 고르기: 작은 예시 그림 + 라디오. 새 원고와 원고 화면(페이지 추가·틀 바꾸기)이 같이 쓴다.
import { useMemo } from 'react';
import type { Format, FrameStyle, Page, TemplateId } from '../scene/types';
import { TEMPLATES, makePage } from '../scene/layout';
import { PageView } from './PageView';

interface Props {
  name: string;
  format: Format;
  style: FrameStyle;
  ratio: [number, number];
  value: TemplateId;
  onChange: (t: TemplateId) => void;
  labelledBy?: string;
  /** 직접 그리기 칸 보이기 (페이지 만화만) */
  showDraw?: boolean;
  /** 직접 그리기 칸을 누르면 (그리기 창 열기) */
  onDraw?: () => void;
  /** 직접 그린 틀 미리보기 */
  customPage?: Page | null;
}

export function TemplatePicker({ name, format, style, ratio, value, onChange, labelledBy, showDraw = true, onDraw, customPage }: Props) {
  // 작은 예시에서는 테두리가 안 보일 만큼 얇아지지 않게
  const exampleStyle = useMemo(() => ({ ...style, border: { ...style.border, width: Math.max(7, style.border.width * 3) } }), [style]);
  const examples = useMemo(() => TEMPLATES.map(t => ({ ...t, page: makePage(format, t.id, style, ratio) })), [format, style, ratio]);
  return (
    <div className="tplgrid" role="radiogroup" aria-labelledby={labelledBy}>
      {examples.map(t => (
        <label key={t.id} className="tpl" data-checked={value === t.id}>
          <span className="tplpic" aria-hidden="true">
            <PageView page={t.page} style={exampleStyle} width={format === 'page' ? 36 : 44} showNumbers={false} label="" />
          </span>
          <span className="tplname">
            <input type="radio" name={name} checked={value === t.id} onChange={() => onChange(t.id)} />
            {t.label}
          </span>
        </label>
      ))}
      {showDraw && format === 'page' && (
        <label className="tpl" data-checked={value === 'custom'} onClick={() => onDraw?.()}>
          <span className="tplpic" aria-hidden="true">
            {customPage
              ? <PageView page={customPage} style={exampleStyle} width={36} showNumbers={false} label="" />
              : <span className="tplpic-empty">✎</span>}
          </span>
          <span className="tplname">
            <input type="radio" name={name} checked={value === 'custom'} onChange={() => onChange('custom')} />
            {value === 'custom' ? '직접 그리기 ✎' : '직접 그리기'}
          </span>
        </label>
      )}
    </div>
  );
}
