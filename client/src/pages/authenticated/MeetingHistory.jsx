import { useEffect, useState } from 'react';
import { Clock, ListChecks, CheckCircle, Plus } from '@phosphor-icons/react';
import Card from '../../components/ui/Card/index.jsx';
import Button from '../../components/ui/Button/index.jsx';
import MeetingList from '../../components/MeetingList/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { fetchAllMeetings } from './meetingHistory.service.js';

// MeetingHistory — the authenticated home / "dashboard". Stat tiles are computed from every
// meeting the user has (no separate stats endpoint documented in ENDPOINTS.md, so this page
// walks the paginated list itself — see meetingHistory.service.js); the row list itself is
// delegated entirely to <MeetingList/> per FRONTEND.md §3, which fetches independently.
export default function MeetingHistory() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAllMeetings({ signal: controller.signal })
      .then(setMeetings)
      .catch((err) => {
        if (err.name !== 'AbortError') setMeetings([]);
      });
    return () => controller.abort();
  }, []);

  const totalHours = meetings.reduce((sum, m) => sum + (m.durationSeconds ?? 0), 0) / 3600;
  const actionItemsOpen = meetings.reduce((sum, m) => sum + (m.actionItemCount ?? 0), 0);
  const completedCount = meetings.filter((m) => m.status === 'completed').length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface sm:text-3xl">
            Welcome back{user?.name ? `, ${user.name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Here&apos;s an overview of your recent meeting activity.
          </p>
        </div>
        <Button to="/meetings/new" leadingIcon={Plus}>New meeting</Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile icon={Clock} label="Total hours recorded" value={totalHours.toFixed(1)} />
        <StatTile icon={ListChecks} label="Action items open" value={String(actionItemsOpen)} />
        <StatTile icon={CheckCircle} label="Meetings completed" value={String(completedCount)} />
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-medium text-on-surface">Your meetings</h2>
        <MeetingList />
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value }) {
  return (
    <Card padding="md" className="flex items-center justify-between">
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="mt-1 font-mono text-3xl font-semibold text-on-surface">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/25 text-primary">
        <Icon size={20} weight="regular" />
      </div>
    </Card>
  );
}
