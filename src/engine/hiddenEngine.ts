// 화면에 안 보이는 컷 편집 엔진을 잠깐 띄워 일을 시키고 닫는다 (고화질 내보내기·콘티 장면 만들기용).
// 화면 밖(.thumbbaker)에 두지만 크기는 있어야 WebGL이 그림을 그린다.
import { ENGINE_URL, type RoughEngine, waitForEngine } from './bridge';

export async function withHiddenEngine<T>(fn: (eng: RoughEngine) => Promise<T>): Promise<T> {
  const frame = document.createElement('iframe');
  frame.src = ENGINE_URL;
  frame.className = 'thumbbaker';
  frame.title = '그림 그리는 중';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  document.body.appendChild(frame);
  try {
    const eng = await waitForEngine(frame);
    return await fn(eng);
  } finally {
    frame.remove();
  }
}
