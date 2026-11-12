"use client";

import { useActionState } from "react";
import type { CreateTokenState } from "@/app/(app)/actions";
import { CopyButton } from "./copy-button";

type Props = {
  action: (prev: CreateTokenState, formData: FormData) => Promise<CreateTokenState>;
};

export function CreateToken({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const snippet = state.token ? `export REPORTLY_URL=${state.origin}\nexport REPORTLY_TOKEN=${state.token}` : "";

  return (
    <div className="mt-6 grid gap-4">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="field sm:max-w-sm"
          name="name"
          placeholder="Token name"
          aria-label="Token name"
          maxLength={64}
          required
        />
        <button type="submit" className="btn btn-primary min-h-10" disabled={pending}>
          Create token
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm text-no">
          {state.error}
        </p>
      )}
      {state.token && (
        <div className="grid gap-3 rounded-[14px] border border-line bg-panel p-4">
          <p className="text-sm text-warn">Copy this token now. It will not be shown again.</p>
          <div className="flex items-center gap-2 rounded-[10px] border border-line bg-bg py-1.5 pr-1.5 pl-3">
            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap text-ink">
              {state.token}
            </code>
            <CopyButton text={state.token} />
          </div>
          <div className="flex items-start gap-2 rounded-[10px] border border-line bg-bg py-1.5 pr-1.5 pl-3">
            <pre className="min-w-0 flex-1 overflow-x-auto py-1.5 font-mono text-sm text-read">{snippet}</pre>
            <CopyButton text={snippet} />
          </div>
        </div>
      )}
    </div>
  );
}
