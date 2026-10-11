// 상단 메뉴처럼 보이는 단계 표시: 원고 틀 > 작품 설정. 지난 단계는 눌러서 돌아갈 수 있다.
interface Props {
  steps: string[];
  current: number;
  onGo?: (index: number) => void;
}

export function Stepper({ steps, current, onGo }: Props) {
  return (
    <nav className="stepper" aria-label="새 원고 단계">
      <ol>
        {steps.map((label, i) => {
          const state = i === current ? 'current' : i < current ? 'done' : 'todo';
          const content = (<><span className="stepnum" aria-hidden="true">{i + 1}</span>{label}</>);
          return (
            <li key={label} data-state={state}>
              {state === 'done' && onGo
                ? <button type="button" onClick={() => onGo(i)}>{content}</button>
                : <span aria-current={state === 'current' ? 'step' : undefined}>{content}</span>}
              {i < steps.length - 1 && <span className="stepsep" aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
