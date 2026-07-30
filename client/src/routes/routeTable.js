import Landing from '../pages/public/Landing.jsx';
import Login from '../pages/public/Login.jsx';
import Signup from '../pages/public/Signup.jsx';
import AuthCallback from '../pages/public/AuthCallback.jsx';
import MeetingHistory from '../pages/authenticated/MeetingHistory.jsx';
import NewMeeting from '../pages/authenticated/NewMeeting.jsx';
import MeetingDetail from '../pages/authenticated/MeetingDetail.jsx';
import LiveSession from '../pages/authenticated/LiveSession.jsx';
import Settings from '../pages/authenticated/Settings.jsx';

// Centralized URL -> page -> access tier map. See FRONTEND.md §2.
// Add a page here, not as a scattered <Route> in App.jsx.
export const routeTable = [
  { path: '/', Page: Landing, tier: 'public' },
  { path: '/login', Page: Login, tier: 'public' },
  { path: '/signup', Page: Signup, tier: 'public' },
  { path: '/auth/callback', Page: AuthCallback, tier: 'public' },
  { path: '/meetings', Page: MeetingHistory, tier: 'authenticated' },
  { path: '/meetings/new', Page: NewMeeting, tier: 'authenticated' },
  { path: '/meetings/:id', Page: MeetingDetail, tier: 'authenticated' },
  { path: '/live', Page: LiveSession, tier: 'authenticated' },
  { path: '/settings', Page: Settings, tier: 'authenticated' },
];
