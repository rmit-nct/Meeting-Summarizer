import { CheckCircle, CircleNotch, Circle } from '@phosphor-icons/react';

const LABELS = {
  uploaded: 'Queued',
  transcribing: 'Transcribing',
  summarizing: 'Summarizing',
  completed: 'Done',
};

export default function StatusStepper({ steps, currentIndex }) {
  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
        const isLast = i === steps.length - 1;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <StepIcon state={state} />
              <span
                className={[
                  'text-xs font-medium',
                  state === 'pending' ? 'text-outline' : 'text-on-surface',
                ].join(' ')}
              >
                {LABELS[step] ?? step}
              </span>
            </div>
            {!isLast && (
              <div
                className={[
                  'mx-2 h-px flex-1',
                  i < currentIndex ? 'bg-primary' : 'bg-outline-variant',
                ].join(' ')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepIcon({ state }) {
  if (state === 'done') return <CheckCircle size={24} weight="fill" className="text-primary" />;
  if (state === 'active') return <CircleNotch size={24} weight="bold" className="animate-spin text-primary" />;
  return <Circle size={24} weight="regular" className="text-outline-variant" />;
}
