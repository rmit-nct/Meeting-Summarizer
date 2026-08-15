import { WarningOctagon } from '@phosphor-icons/react';
import Button from '../../ui/Button/index.jsx';

export default function FailureNotice({ message, onRetry, retrying }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-(--radius-card) border border-error/30 bg-error-container/25 p-8 text-center">
      <WarningOctagon size={32} weight="regular" className="text-error" />
      <div>
        <p className="text-sm font-medium text-on-error-container">Summarization failed</p>
        <p className="mt-1 max-w-sm text-sm text-on-error-container/80">{message}</p>
      </div>
      <Button variant="danger" onClick={onRetry} loading={retrying}>
        Try again
      </Button>
    </div>
  );
}
