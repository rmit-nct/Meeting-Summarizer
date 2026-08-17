import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { z } from 'zod';
import Card from '../../components/ui/Card/index.jsx';
import Input from '../../components/ui/Input/index.jsx';
import Button from '../../components/ui/Button/index.jsx';
import { createMeeting } from './newMeeting.service.js';

const schema = z.object({
  title: z.string().min(2, 'Give the meeting a short title'),
  meetingDate: z.string().optional(),
});

// NewMeeting — title + optional date only. Creates a draft and navigates straight to
// /meetings/:id, where Dropzone/Recorder take over. See FRONTEND.md §2.
export default function NewMeeting() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ title: '', meetingDate: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // meetingDate is optional server-side, but the validator requires a
      // real YYYY-MM-DD when the key is present at all — omit it outright
      // rather than send ''.
      const payload = result.data.meetingDate ? result.data : { title: result.data.title };
      const { meeting } = await createMeeting(payload);
      navigate(`/meetings/${meeting.id}`);
    } catch (err) {
      setErrors({ title: [err.message ?? 'Could not create the meeting. Please try again.'] });
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} weight="regular" />
        Back
      </button>

      <h1 className="text-2xl font-semibold text-on-surface">New meeting</h1>
      <p className="mt-1 text-sm text-on-surface-variant">
        Give it a title, then attach a recording on the next screen.
      </p>

      <Card padding="lg" className="mt-6">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <Input
            label="Title"
            placeholder="Weekly sync"
            required
            value={values.title}
            onChange={update('title')}
            error={errors.title?.[0]}
          />
          <Input
            label="Date"
            type="date"
            helperText="Optional — defaults to today."
            value={values.meetingDate}
            onChange={update('meetingDate')}
          />
          <Button type="submit" fullWidth loading={submitting}>
            Create meeting
          </Button>
        </form>
      </Card>
    </div>
  );
}
