"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
  confirmLabel: string;
};

/** Two-step destructive button: the first click asks, the second submits `id` to `action`. */
export function ConfirmButton({ action, id, label, confirmLabel }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="btn" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton>{confirmLabel}</SubmitButton>
      <button type="button" className="btn" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </form>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-danger" disabled={pending} autoFocus>
      {children}
    </button>
  );
}
