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
    <div className="flex items-center gap-2">
      <span className="text-xs text-stone-500">Code</span>
      <span className="rounded-md bg-stone-100 px-2 py-1 font-mono text-sm tracking-widest">{code}</span>
      <button type="button" onClick={copy} className="text-xs font-medium text-teal-700 hover:underline">
        {copied ? "Copied" : "Copy invite"}
      </button>
    </div>
  );
}
