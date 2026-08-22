import { forwardRef, useState } from 'react';
import { Eye, EyeSlash, LockSimple } from '@phosphor-icons/react';
import Input from '../Input/index.jsx';

// DESIGN.md "Password Fields": eye / eye-slash reveal toggle — a usability gap neither
// reference mockup had. Leading lock icon is applied consistently so auth forms don't repeat
// the reference mockups' Login-vs-Register icon inconsistency.
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      leadingIcon={LockSimple}
      trailingSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-full p-1.5 text-outline transition-colors hover:bg-surface-container-low hover:text-on-surface"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeSlash size={18} weight="regular" /> : <Eye size={18} weight="regular" />}
        </button>
      }
      {...props}
    />
  );
});

export default PasswordInput;
