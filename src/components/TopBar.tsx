import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * 모든 화면 맨 위 줄. 오른쪽에는 나중에 승인·한도(크레딧)가 들어갈 빈 자리가 있고,
 * right에 준 버튼(예: 내보내기)은 그 오른쪽 끝에 놓인다.
 */
export function TopBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="topbar">
      <Link to="/" className="brand">러프 도구</Link>
      {children}
      <span className="spacer" />
      <span className="later-slot" aria-hidden="true" title="나중에 승인·한도(크레딧)가 들어갈 자리" />
      {right}
    </header>
  );
}
