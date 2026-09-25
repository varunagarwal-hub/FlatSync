"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={variant === "primary" ? "btn-primary" : "btn-secondary"}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
        {state.message}
      </p>
    );
  }
  return null;
}
