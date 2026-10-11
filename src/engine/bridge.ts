// 컷 편집 엔진과의 연결부.
// 지금 엔진은 프로토타입(public/engine/cut-test.html)이고 같은 출처의 iframe 안에서 window.roughEngine 을 연다.
// 엔진을 TypeScript 모듈로 옮기면 이 파일의 인터페이스만 유지하고 안쪽을 바꾼다.
import type { EngineScene } from '../scene/types';

export interface RoughEngine {
  load(args: { ratio: [number, number]; models: { A?: File; B?: File }; scene: EngineScene | null }): Promise<{ loaded: string[] }>;
  exportScene(): EngineScene;
  thumbnail(maxWidth?: number): string | null;
  onChange(cb: () => void): void;
}

export const ENGINE_URL = `${import.meta.env.BASE_URL}engine/cut-test.html?embed`;

/** iframe 안 엔진이 준비될 때까지 기다린다 */
export function waitForEngine(frame: HTMLIFrameElement, timeoutMs = 30000): Promise<RoughEngine> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const eng = (frame.contentWindow as (Window & { roughEngine?: RoughEngine }) | null)?.roughEngine;
      if (eng) { resolve(eng); return; }
      if (Date.now() - started > timeoutMs) { reject(new Error('컷 편집 화면을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.')); return; }
      setTimeout(tick, 100);
    };
    tick();
  });
}
