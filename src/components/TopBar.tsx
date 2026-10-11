import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** 모든 화면 맨 위 줄. 오른쪽 끝은 나중에 승인·한도 버튼이 들어갈 빈 자리. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">러프 도구</Link>
      {children}
      <span className="spacer" />
      <span className="later-slot" aria-hidden="true" title="나중에 승인·한도 버튼이 들어갈 자리" />
    </header>
  );
}
