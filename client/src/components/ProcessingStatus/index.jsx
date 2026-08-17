import Card from '../ui/Card/index.jsx';
import StatusStepper from './sub-components/StatusStepper.jsx';
import FailureNotice from './sub-components/FailureNotice.jsx';
import { useProcessingStatus } from './useProcessingStatus.hook.js';

// ProcessingStatus — the pipeline stepper. Renders from `status`, never from "did a request
// come back yet", so the socket and polling-fallback transports stay indistinguishable to the
// user (FRONTEND.md §5). `onStatusChange` lets MeetingDetail's own hook mirror the live status
// without owning the socket subscription itself.
export default function ProcessingStatus({ meetingId, status, errorMessage, onStatusChange }) {
  if (status === 'failed') {
    return <FailedState meetingId={meetingId} initialStatus={status} errorMessage={errorMessage} onStatusChange={onStatusChange} />;
  }

  return <InProgress meetingId={meetingId} status={status} onStatusChange={onStatusChange} />;
}

function FailedState({ meetingId, initialStatus, errorMessage, onStatusChange }) {
  const { retry, retrying } = useProcessingStatus(meetingId, initialStatus, { onStatusChange });
  return (
    <FailureNotice
      message={errorMessage ?? 'Something went wrong while summarizing this meeting.'}
      onRetry={retry}
      retrying={retrying}
    />
  );
}

function InProgress({ meetingId, status, onStatusChange }) {
  const { step, steps, currentIndex, timedOut, retry, retrying } = useProcessingStatus(meetingId, status, { onStatusChange });

  if (timedOut) {
    return (
      <FailureNotice
        message="This is taking longer than expected. You can try again or check back shortly."
        onRetry={retry}
        retrying={retrying}
      />
    );
  }

  return (
    <Card padding="lg" className="flex flex-col items-center gap-8 text-center">
      <div className="w-full max-w-md">
        <StatusStepper steps={steps} currentIndex={currentIndex} />
      </div>
      <div>
        <p className="text-sm font-medium text-on-surface">{step}…</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          This usually takes a couple of minutes. Feel free to leave this page — we&apos;ll keep working.
        </p>
      </div>
    </Card>
  );
}
