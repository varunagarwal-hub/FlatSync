"use client";

import { useState } from "react";

export function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const link = `${window.location.origin}/?join=${code}`;
    try {
      await navigator.clipboard.writeText(`Join our flat hunt on FlatSync with code ${code}: ${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the code is on screen anyway.
    }
  }

  return (
    <div className="flex items-center overflow-hidden rounded-full border-2 border-edge bg-paper shadow-[3px_3px_0_var(--shadow)]">
      <span className="px-3 py-2 font-mono text-sm font-bold tracking-[0.2em]" aria-label={`Group code ${code}`}>
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className="min-h-10 border-l-2 border-edge bg-sun px-3 text-xs font-bold text-night hover:brightness-95 focus-visible:ring-4 focus-visible:ring-violet/40 focus-visible:outline-none"
      >
        {copied ? "Copied!" : "Copy invite"}
      </button>
    </div>
  );
}
