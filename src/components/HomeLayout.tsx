// 내 원고 목록(왼쪽) + 본문. 첫 화면과 새 원고 화면이 같이 쓴다.
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../storage/db';
import { importManuscriptFile } from '../storage/file-io';
import { TopBar } from './TopBar';

const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};

export function HomeLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const list = useLiveQuery(async () => {
    const ms = await db.manuscripts.orderBy('updatedAt').reverse().toArray();
    const works = new Map((await db.works.toArray()).map(w => [w.id, w]));
    return ms.map(m => ({ m, work: works.get(m.workId) }));
  }, []);

  return (
    <>
      <TopBar />
      <div className="home">
        <aside className="panel" aria-label="내 원고">
          <h2>내 원고</h2>
          <Link to="/new" className="btn primary">+ 새 원고</Link>
          <div className="mslist">
            {list === undefined && <p className="sub">불러오는 중…</p>}
            {list?.length === 0 && <p className="sub">아직 원고가 없어요.</p>}
            {list?.map(({ m, work }) => (
              <Link key={m.id} to={`/m/${m.id}`} className="msitem">
                <b>{m.title || '제목 없음'}</b>
                <small>
                  {work?.title || '작품 이름 없음'} · {m.format === 'page' ? '페이지' : '웹툰'} {m.pages.reduce((n, p) => n + p.cuts.length, 0)}컷 · {ago(m.updatedAt)}
                </small>
              </Link>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>파일에서 열기</button>
          <input
            ref={fileRef}
            className="vh"
            type="file"
            accept=".json,application/json"
            aria-label="원고 파일 고르기"
            onChange={async e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try { setError(''); navigate(`/m/${await importManuscriptFile(f)}`); }
              catch (err) { setError(err instanceof Error ? err.message : '파일을 열지 못했어요.'); }
            }}
          />
          {error && <p className="sub" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          <p className="sub">원고는 이 컴퓨터의 브라우저에 저장돼요. 다른 컴퓨터로 옮길 땐 원고 화면의 "원고 파일로 저장"을 쓰세요.</p>
        </aside>
        <main>{children}</main>
      </div>
    </>
  );
}
