type Step = {label: string; index: number};

type FormStepNavProps = {
  steps: Step[];
  current: number;
  onGoTo: (index: number) => void;
};

export default function FormStepNav({steps, current, onGoTo}: FormStepNavProps) {
  return (
    <nav aria-label="Form steps" className="mb-8">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.index} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => done && onGoTo(i)}
                disabled={!done}
                className={[
                  'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-gray-900 text-white'
                    : done
                      ? 'cursor-pointer bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'cursor-default bg-gray-100 text-gray-400',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    active
                      ? 'bg-white text-gray-900'
                      : done
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-300 text-gray-500',
                  ].join(' ')}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < steps.length - 1 && (
                <span className="text-gray-300" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
