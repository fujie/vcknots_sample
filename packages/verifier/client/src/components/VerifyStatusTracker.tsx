export type VerifyStatus = 'idle' | 'request_created' | 'presentation_received' | 'verification_completed';

interface VerifyStatusTrackerProps {
  status: VerifyStatus;
}

const STEPS: { key: VerifyStatus; label: string }[] = [
  { key: 'request_created', label: 'Request Created' },
  { key: 'presentation_received', label: 'Presentation Received' },
  { key: 'verification_completed', label: 'Verification Completed' },
];

export function VerifyStatusTracker({ status }: VerifyStatusTrackerProps) {
  if (status === 'idle') return null;

  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div role="status" aria-label="Verify status tracker">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Verification Progress</h3>
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isCompleted ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isCompleted ? '✓' : '○'} {step.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
