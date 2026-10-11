// 컷 장면 복사·붙여넣기 (이 브라우저 안에서만). 장면 보관함 팝업은 다음 단계에서 이 위에 만든다.
import type { EngineScene } from '../scene/types';

const KEY = 'rough.clip';

export interface ClipItem {
  scene: EngineScene;
  thumb: string | null;
  from: string;
  at: number;
}

export function copyScene(item: ClipItem): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(item)); return true; } catch { return false; }
}

export function readClip(): ClipItem | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ClipItem) : null;
  } catch {
    return null;
  }
}
