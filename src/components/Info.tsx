// ⓘ 아이콘: 마우스를 올리거나 키보드로 고르면 설명이 보인다 (휴대폰은 누르면 보임)
// 설명 풍선은 화면 기준(fixed)으로 띄워서, 스크롤되는 패널 안에서도 잘리지 않고 화면 밖으로 나가지 않게 한다.
import { useRef } from 'react';

const GAP = 8, EDGE = 8;

export function Info({ text }: { text: string }) {
  const tipRef = useRef<HTMLSpanElement>(null);
  const place = (el: HTMLElement) => {
    const tip = tipRef.current;
    if (!tip) return;
    tip.classList.add('placed');
    const r = el.getBoundingClientRect();
    const w = Math.min(260, window.innerWidth - EDGE * 2);
    tip.style.maxWidth = `${w}px`;
    const tw = Math.min(w, tip.offsetWidth || w), th = tip.offsetHeight;
    const left = Math.max(EDGE, Math.min(window.innerWidth - tw - EDGE, r.left + r.width / 2 - tw / 2));
    const above = r.top - th - GAP;
    const top = above >= EDGE ? above : r.bottom + GAP;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  return (
    <span className="info" tabIndex={0} role="note" aria-label={text}
      onMouseEnter={e => place(e.currentTarget)} onFocus={e => place(e.currentTarget)}>
      <span aria-hidden="true">i</span>
      <span ref={tipRef} className="info-tip" aria-hidden="true">{text}</span>
    </span>
  );
}
