/** 짧은 고유 id (저장 파일에서 원고·페이지·컷을 구분) */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 13);
  return Math.random().toString(36).slice(2, 15);
}
