import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { requireUser } from "@/lib/auth";
import { logout } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:gap-4">
          <Link href="/docs" className="mr-1 font-bold text-ink no-underline sm:mr-2">
            Reportly
          </Link>
          <nav className="flex gap-1">
            <NavLink href="/docs">Documents</NavLink>
            <NavLink href="/tokens">Tokens</NavLink>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-dim sm:block">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="btn">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24">{children}</main>
    </>
  );
}
