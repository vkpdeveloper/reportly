import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { login } from "../actions";

export const metadata: Metadata = { title: "Log in · Reportly" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/docs");
  return <AuthForm mode="login" action={login} />;
}
