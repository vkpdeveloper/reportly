import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { register } from "../actions";

export const metadata: Metadata = { title: "Sign up · Reportly" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/docs");
  return <AuthForm mode="register" action={register} />;
}
