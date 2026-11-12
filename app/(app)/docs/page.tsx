import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { RelativeTime } from "@/components/relative-time";
import { requireUser } from "@/lib/auth";
import { listDocuments, listProjects } from "@/lib/documents";
import { deleteDocument } from "../actions";

export const metadata: Metadata = { title: "Documents · Reportly" };

// Shared by the header and every row so the columns line up on desktop.
const COLUMNS = "md:grid md:grid-cols-[minmax(0,1fr)_9rem_4.5rem_7rem_3.5rem_11.5rem] md:gap-4";

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function DocsPage({ searchParams }: PageProps<"/docs">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = param(sp.q);
  const project = param(sp.project);

  const [documents, projects] = await Promise.all([
    listDocuments(user.id, { q: q || undefined, project: project || undefined }),
    listProjects(user.id),
  ]);

  return (
    <>
      <h1 className="text-2xl">Documents</h1>

      {projects.length === 0 ? (
        <p className="mt-6 text-dim">
          No documents yet. Create a <Link href="/tokens">token</Link> and point your agent at the reportly skill.
        </p>
      ) : (
        <>
          <Form action="/docs" className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input
              className="field sm:flex-1"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search title or project"
              aria-label="Search"
            />
            <select className="field sm:w-52" name="project" defaultValue={project} aria-label="Project">
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.project} value={p.project}>
                  {p.project}
                </option>
              ))}
            </select>
            <button type="submit" className="btn min-h-10">
              Search
            </button>
          </Form>

          {documents.length === 0 ? (
            <p className="mt-6 text-dim">No documents match.</p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-[14px] border border-line bg-panel">
              <div className={`label hidden border-b border-line bg-panel-2 px-4 py-2.5 ${COLUMNS}`}>
                <span>Title</span>
                <span>Project</span>
                <span>Status</span>
                <span>Updated</span>
                <span className="text-right">Version</span>
                <span />
              </div>
              <ul>
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 md:items-center ${COLUMNS}`}
                  >
                    <a
                      href={`/d/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full font-medium break-words no-underline hover:underline"
                    >
                      {doc.title}
                    </a>
                    <span className="max-w-full truncate text-sm">{doc.project}</span>
                    <span>
                      <span className={`pill ${doc.status === "live" ? "pill-live" : "pill-done"}`}>{doc.status}</span>
                    </span>
                    <span className="text-sm text-dim">
                      <RelativeTime ms={doc.updatedAt} />
                    </span>
                    <span className="font-mono text-sm text-dim tabular-nums md:text-right">v{doc.version}</span>
                    <span className="ml-auto flex justify-end md:ml-0">
                      <ConfirmButton action={deleteDocument} id={doc.id} label="Delete" confirmLabel="Yes, delete" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}
