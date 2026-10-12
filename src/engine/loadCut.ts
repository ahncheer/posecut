// 컷 하나를 엔진에 올리기 (컷 편집 화면과 작은 그림 다시 그리기가 같이 쓴다)
import type { Character, Cut, Manuscript } from '../scene/types';
import { CUT_LETTERS } from '../scene/types';
import { castForCut, findCut } from '../scene/manuscript';
import { cutRatio } from '../scene/layout';
import { loadModelFile } from '../storage/db';
import type { EngineCast, RoughEngine } from './bridge';

export async function loadCutIntoEngine(eng: RoughEngine, m: Manuscript, characters: Character[], cutId: string, override?: Cut, isCancelled: () => boolean = () => false): Promise<boolean> {
  const found0 = findCut(m, cutId);
  if (!found0) return false;
  const cut = override ?? found0.cut;
  // 이 컷에 고른 인물(안 골랐으면 모델이 있는 앞의 2명)을 A, B, C … 자리에
  const chosen = castForCut(characters, cut.cast);
  const files = await Promise.all(chosen.map(c => loadModelFile(c.model)));
  if (isCancelled()) return false;
  const cast: EngineCast[] = chosen.map((c, i) => ({ letter: CUT_LETTERS[i], name: c.name || c.slot, gender: c.gender, age: c.age }));
  const models = Object.fromEntries(chosen.map((_, i) => [CUT_LETTERS[i], files[i] ?? undefined]));
  await eng.load({
    ratio: cutRatio(cut.rect), models, scene: cut.scene, cast, plan: cut.scene ? undefined : cut.plan,
    shape: cut.poly ? cut.poly.map(([x, y]) => [(x - cut.rect.x) / cut.rect.w, (y - cut.rect.y) / cut.rect.h] as [number, number]) : null,
    name: `${m.title}_${found0.pageIndex + 1}페이지_컷${found0.cutIndex + 1}`,
  });
  return !isCancelled();
}
