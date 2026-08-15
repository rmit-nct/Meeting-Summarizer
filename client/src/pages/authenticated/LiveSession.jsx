import { Broadcast } from '@phosphor-icons/react';
import EmptyState from '../../components/ui/EmptyState/index.jsx';
import Button from '../../components/ui/Button/index.jsx';

// LiveSession is marked (stretch) in FRONTEND.md §2 — the live transcript feed + rolling
// summary (LiveSessionPanel) isn't built yet. This is an honest placeholder rather than a
// fabricated live demo.
export default function LiveSession() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16">
      <EmptyState
        icon={Broadcast}
        title="Live sessions are coming soon"
        description="Real-time transcription and rolling summaries during a live meeting are on the roadmap as a stretch feature."
        action={<Button to="/meetings" variant="outline">Back to meetings</Button>}
        className="w-full"
      />
    </div>
  );
}
