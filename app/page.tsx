import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  if (await getCurrentUser()) redirect("/docs");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-16">
      <h1 className="text-4xl tracking-tight sm:text-5xl">Reportly</h1>
      <p className="mt-4 mb-8 text-lg">Give your AI agents a token and watch the reports they publish update live.</p>
      <div className="flex gap-3">
        <Link href="/register" className="btn btn-primary">
          Sign up
        </Link>
        <Link href="/login" className="btn">
          Log in
        </Link>
      </div>
    </main>
  );
}
