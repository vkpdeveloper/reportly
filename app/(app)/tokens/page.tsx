import type { Metadata } from "next";
import { ConfirmButton } from "@/components/confirm-button";
import { CreateToken } from "@/components/create-token";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createToken, revokeToken } from "../actions";

export const metadata: Metadata = { title: "Tokens · Reportly" };

// Shared by the header and every row so the columns line up on desktop.
const COLUMNS = "md:grid md:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem_11.5rem] md:gap-4";

type TokenRow = { id: string; name: string; last4: string; created_at: number; last_used_at: number | null };

export default async function TokensPage() {
  const user = await requireUser();
  const { results: tokens } = await db()
    .prepare("SELECT id, name, last4, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC")
    .bind(user.id)
    .all<TokenRow>();

  return (
    <>
      <h1 className="text-2xl">Tokens</h1>
      <CreateToken action={createToken} />

      {tokens.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-[14px] border border-line bg-panel">
          <div className={`label hidden border-b border-line bg-panel-2 px-4 py-2.5 ${COLUMNS}`}>
            <span>Name</span>
            <span>Token</span>
            <span>Created</span>
            <span>Last used</span>
            <span />
          </div>
          <ul>
            {tokens.map((token) => (
              <li
                key={token.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 md:items-center ${COLUMNS}`}
              >
                <span className="w-full font-medium break-words text-ink">{token.name}</span>
                <span className="font-mono text-sm text-read">rpt_...{token.last4}</span>
                <span className="text-sm text-dim">
                  <span className="md:hidden">Created </span>
                  <RelativeTime ms={token.created_at} />
                </span>
                <span className="text-sm text-dim">
                  {token.last_used_at === null ? (
                    "Never used"
                  ) : (
                    <>
                      <span className="md:hidden">Used </span>
                      <RelativeTime ms={token.last_used_at} />
                    </>
                  )}
                </span>
                <span className="ml-auto flex justify-end md:ml-0">
                  <ConfirmButton action={revokeToken} id={token.id} label="Revoke" confirmLabel="Yes, revoke" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
