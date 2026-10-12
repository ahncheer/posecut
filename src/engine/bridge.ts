// 컷 편집 엔진과의 연결부.
// 지금 엔진은 프로토타입(public/engine/cut-test.html)이고 같은 출처의 iframe 안에서 window.roughEngine 을 연다.
// 엔진을 TypeScript 모듈로 옮기면 이 파일의 인터페이스만 유지하고 안쪽을 바꾼다.
import type { CutPlan, EngineScene } from '../scene/types';

/** 엔진 화면에 보여줄 인물 정보 (A·B 자리 순서) */
export interface EngineCast { letter: string; name: string; gender: string; age: string }

export interface RoughEngine {
  /** models: 자리 글자(A, B, C …)마다 VRM 파일 */
  load(args: { ratio: [number, number]; models: Record<string, File | undefined>; scene: EngineScene | null; cast?: EngineCast[]; name?: string; shape?: [number, number][] | null; plan?: CutPlan }): Promise<{ loaded: string[] }>;
  exportScene(): EngineScene;
  thumbnail(maxWidth?: number): string | null;
  /** 고화질 그림 (컷 가로 widthPx 픽셀, PNG data URL) */
  render?(widthPx: number): Promise<string | null>;
  onChange(cb: () => void): void;
  /** 엔진 안 버튼이 앱에 부탁하는 일. 'cast' = 등장인물 창 열기, 'remove' = 그 자리 인물을 이 컷에서 빼기 */
  onAction?(cb: (a: { type: 'cast' | 'save' | 'preview' | 'import' } | { type: 'remove'; letter: string }) => void): void;
  /** 엔진 위쪽 안내 줄에 한 줄 띄우기 */
  notice?(text: string): void;
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
