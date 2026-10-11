import { Link } from 'react-router-dom';
import { HomeLayout } from '../components/HomeLayout';

export function HomePage() {
  return (
    <HomeLayout>
      <section className="panel" style={{ maxWidth: 640 }}>
        <h1>3D 캐릭터로 웹툰 러프 만들기</h1>
        <p className="sub">
          VRoid로 만든 캐릭터(VRM)를 불러와 포즈·표정·카메라를 잡고, 컷 틀에 맞춰 러프 원고를 만들어요.
          새 원고에서 컷 틀과 작품(세계관·등장인물)을 정하면 바로 시작할 수 있어요.
        </p>
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <Link to="/new" className="btn primary">+ 새 원고</Link>
        </div>
      </section>
    </HomeLayout>
  );
}
