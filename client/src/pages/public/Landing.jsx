import { CheckCircle, Waveform, FileText, UsersThree } from '@phosphor-icons/react';
import Logo from '../../components/ui/Logo/index.jsx';
import Button from '../../components/ui/Button/index.jsx';

const HIGHLIGHTS = [
  { icon: Waveform, text: 'Upload or record a meeting straight from the browser' },
  { icon: FileText, text: 'Bullets, action items, and topic tags in minutes' },
  { icon: UsersThree, text: 'Speakers attributed automatically, editable when they are not' },
];

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <Button to="/login" variant="ghost" size="sm">Log in</Button>
          <Button to="/signup" size="sm">Sign up</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-6 text-center sm:px-10">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-on-surface sm:text-5xl">
          Meetings in, clear summaries out.
        </h1>
        <p className="mt-4 max-w-md text-base text-on-surface-variant">
          Upload a recording and get a structured summary with action items and speakers,
          ready to share in minutes.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button to="/signup" size="lg">Get started</Button>
          <Button to="/login" variant="outline" size="lg">I have an account</Button>
        </div>

        <ul className="mt-16 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-(--radius-card) border border-outline-variant/50 bg-surface-container-lowest p-5"
            >
              <Icon size={20} weight="regular" className="mt-0.5 shrink-0 text-primary" />
              <span className="text-sm text-on-surface-variant">{text}</span>
            </li>
          ))}
        </ul>
      </main>

      <footer className="flex items-center justify-center gap-2 border-t border-outline-variant/50 py-6 text-xs text-outline">
        <CheckCircle size={14} weight="regular" />
        NCT Meeting Summarizer
      </footer>
    </div>
  );
}
