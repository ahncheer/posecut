// ⓘ 아이콘: 마우스를 올리거나 키보드로 고르면 설명이 보인다 (휴대폰은 누르면 보임)
export function Info({ text }: { text: string }) {
  return (
    <span className="info" tabIndex={0} role="note" aria-label={text}>
      <span aria-hidden="true">i</span>
      <span className="info-tip" aria-hidden="true">{text}</span>
    </span>
  );
}
