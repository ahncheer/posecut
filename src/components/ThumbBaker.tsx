// 보이지 않는 컷 편집 화면을 하나 띄워서, 장면은 있는데 작은 그림이 없는 컷들의 그림을 차례로 그린다
// (JSON에서 포즈를 가져온 뒤 원고 화면에 바로 그림이 보이게).
import { useEffect, useRef, useState } from 'react';
import type { Character, Manuscript } from '../scene/types';
import { ENGINE_URL, waitForEngine } from '../engine/bridge';
import { loadCutIntoEngine } from '../engine/loadCut';

interface Props {
  manuscript: Manuscript;
  characters: Character[];
  /** 그릴 컷 id 목록 (앞에서부터) */
  queue: string[];
  onThumb: (cutId: string, thumb: string | null) => Promise<void> | void;
  onFinish: () => void;
}

export function ThumbBaker({ manuscript, characters, queue, onThumb, onFinish }: Props) {
  const [i, setI] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ manuscript, characters, onThumb, onFinish });
  latest.current = { manuscript, characters, onThumb, onFinish };
  const id = queue[i];

  useEffect(() => {
    if (!id) { latest.current.onFinish(); return; }
    let cancelled = false;
    const frame = frameRef.current;
    (async () => {
      let thumb: string | null = null;
      try {
        if (!frame) return;
        const eng = await waitForEngine(frame);
        const { manuscript: m, characters: ch } = latest.current;
        if (await loadCutIntoEngine(eng, m, ch, id, undefined, () => cancelled)) {
          await new Promise(r => setTimeout(r, 120)); // 머리카락·옷 흔들림이 자리 잡게
          thumb = eng.thumbnail(360);
        }
      } catch { thumb = null; }
      if (cancelled) return;
      await latest.current.onThumb(id, thumb);
      if (!cancelled) setI(n => n + 1);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!id) return null;
  return (
    <iframe
      key={id}
      ref={frameRef}
      src={ENGINE_URL}
      title="작은 그림 그리는 중"
      aria-hidden="true"
      tabIndex={-1}
      className="thumbbaker"
    />
  );
}
