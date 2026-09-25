"use client";

import { startTransition, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";

/**
 * Like useActionState, but for forms with controlled inputs. Passing an action
 * to <form action> makes React reset the form after it runs, which unchecks
 * controlled radios and checkboxes in the DOM while their state still says
 * checked -- so the next submit silently sends them as blank. Submitting via
 * onSubmit + startTransition skips that reset.
 */
export function useControlledFormAction(fn: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(fn, undefined);
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Include the clicked button's name/value (e.g. intent=submit).
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }
  return { state, pending, onSubmit };
}

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  name,
  value,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
  /** Pass when the form submits via onSubmit, where useFormStatus can't see it. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
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
      <p role="alert" className="rounded-lg bg-bad px-3 py-2 text-sm text-bad-fg">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-lg bg-get px-3 py-2 text-sm text-get-fg">
        {state.message}
      </p>
    );
  }
  return null;
}
