export type IssueStatus = 'idle' | 'offer_created' | 'token_issued' | 'credential_issued';

interface IssueStatusTrackerProps {
  status: IssueStatus;
}

const STEPS: { key: IssueStatus; label: string }[] = [
  { key: 'offer_created', label: 'Offer Created' },
  { key: 'token_issued', label: 'Token Issued' },
  { key: 'credential_issued', label: 'Credential Issued' },
];

export function IssueStatusTracker({ status }: IssueStatusTrackerProps) {
  if (status === 'idle') return null;

  const currentIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <div role="status" aria-label="Issue status tracker">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Issuance Progress</h3>
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-100 text-gray-400'
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
