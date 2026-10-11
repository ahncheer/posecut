import { describe, expect, it } from 'vitest';
import { parseFile, toFile } from './file-io';
import { DEFAULT_PAGE_RATIO, DEFAULT_STYLE, makePage } from '../scene/layout';
import type { Manuscript, Work } from '../scene/types';

const work: Work = { id: 'w1', title: '카페 너머의 계절', world: '', characters: [], updatedAt: 0 };
const ms: Manuscript = {
  id: 'm1', title: '1화', workId: 'w1', format: 'page', template: 'four', pageRatio: DEFAULT_PAGE_RATIO,
  style: DEFAULT_STYLE, pages: [makePage('page', 'four', DEFAULT_STYLE, DEFAULT_PAGE_RATIO)], createdAt: 0, updatedAt: 0,
};

describe('원고 파일', () => {
  it('내보낸 파일을 다시 읽으면 같은 내용이다', () => {
    const back = parseFile(JSON.stringify(toFile(work, ms)));
    expect(back.manuscript.pages[0].cuts).toHaveLength(4);
    expect(back.work.title).toBe('카페 너머의 계절');
  });

  it('다른 JSON은 알아듣기 쉬운 말로 거절한다', () => {
    expect(() => parseFile('{"hello":1}')).toThrow('러프 도구 원고 파일이 아니에요.');
  });
});
