import { useState } from 'react';
import { User, Envelope, SignOut } from '@phosphor-icons/react';
import Card from '../../components/ui/Card/index.jsx';
import Input from '../../components/ui/Input/index.jsx';
import Button from '../../components/ui/Button/index.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useUiStore } from '../../stores/ui.store.js';

export default function Settings() {
  const { user, signOut } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    // Real: await http.patch(ENDPOINTS.users.me(), { displayName }) — see docs ENDPOINTS.md §1.
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    pushToast({ tone: 'success', message: 'Profile updated.' });
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold text-on-surface">Settings</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Manage your profile and account.</p>

      <Card padding="lg" className="mt-6">
        <h2 className="text-base font-medium text-on-surface">Profile</h2>
        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-5">
          <Input
            label="Display name"
            leadingIcon={User}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input label="Email" leadingIcon={Envelope} value={user?.email ?? ''} disabled />
          <div>
            <Button type="submit" loading={saving}>Save changes</Button>
          </div>
        </form>
      </Card>

      <Card padding="lg" className="mt-6">
        <h2 className="text-base font-medium text-on-surface">Account</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Sign out of NCT Meeting Summarizer on this device.</p>
        <Button variant="danger" leadingIcon={SignOut} onClick={() => signOut()} className="mt-4">
          Sign out
        </Button>
      </Card>
    </div>
  );
}
