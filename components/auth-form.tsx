"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/(auth)/actions";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-16">
      <Link href="/" className="mb-10 font-bold text-ink no-underline">
        Reportly
      </Link>
      <h1 className="mb-6 text-2xl">{isLogin ? "Log in" : "Create an account"}</h1>
      <form action={formAction} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="label">Email</span>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            defaultValue={state.email}
            required
            autoFocus
          />
        </label>
        <label className="grid gap-1.5">
          <span className="label">Password</span>
          <input
            className="field"
            type="password"
            name="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 8}
            required
          />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-no">
            {state.error}
          </p>
        )}
        <button type="submit" className="btn btn-primary mt-2 w-full" disabled={pending}>
          {isLogin ? "Log in" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-dim">
        {isLogin ? "No account? " : "Have an account? "}
        <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "Sign up" : "Log in"}</Link>
      </p>
    </main>
  );
}
