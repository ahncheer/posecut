// 원고 하나와 그 작품을 읽고, 바꾸면 바로 저장하는 훅
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Manuscript, Work } from '../scene/types';
import { db, saveManuscript, saveWork } from './db';

export function useManuscript(msId: string | undefined) {
  const data = useLiveQuery(async () => {
    if (!msId) return null;
    const m = await db.manuscripts.get(msId);
    if (!m) return null;
    const w = (await db.works.get(m.workId)) ?? null;
    return { m, w };
  }, [msId]);

  const update = useCallback(async (fn: (m: Manuscript) => Manuscript) => {
    if (!msId) return;
    const cur = await db.manuscripts.get(msId);
    if (cur) await saveManuscript(fn(cur));
  }, [msId]);

  const updateWork = useCallback(async (w: Work) => { await saveWork(w); }, []);

  return {
    loading: data === undefined,
    manuscript: data?.m ?? null,
    work: data?.w ?? null,
    update,
    updateWork,
  };
}
