"use client";

import { useState } from "react";

export interface Extracted {
  area: string | null;
  rent: number | null;
  floor: number | null;
  lift: boolean | null;
  parking: boolean | null;
  bathrooms: number | null;
  pets_allowed: boolean | null;
}

/** Downscale a screenshot to at most 1600px and re-encode as JPEG, so uploads stay small. */
async function toJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't open that image"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Paste listing text or upload a screenshot; the server asks Gemini to pull
 * out the details. Only this text/image is sent, never anyone's constraints.
 */
export function PasteListing({ groupId, onExtracted }: { groupId: string; onExtracted: (d: Extracted) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function extract() {
    setError(null);
    setDone(false);
    if (!text.trim() && !file) {
      setError("Paste the listing text or choose a screenshot first.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { groupId };
      if (file) payload.image = { mimeType: "image/jpeg", data: await toJpegBase64(file) };
      else payload.text = text;
      const res = await fetch("/api/extract-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; data?: Extracted; error?: string } | null;
      if (!body?.ok || !body.data) {
        setError(body?.error ?? "Couldn't read that listing. Please fill in the details below.");
        return;
      }
      onExtracted(body.data);
      setDone(true);
    } catch {
      setError("Couldn't reach the listing reader. Please fill in the details below.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        Paste listing (fill the form from text or a screenshot)
      </button>
    );
  }

  return (
    <section className="card space-y-3 border-teal-200">
      <div>
        <h2 className="font-semibold">Paste listing</h2>
        <p className="hint">
          Paste the listing text or upload a screenshot. We'll fill in the form for you to check. Only what you paste here
          is sent to Google Gemini.
        </p>
      </div>
      <textarea
        id="pasteText"
        className="input"
        rows={5}
        maxLength={20000}
        placeholder="e.g. 2BHK in HSR Layout Sector 2, ₹42,000/month, 3rd floor, lift, covered parking, 2 bathrooms…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!!file}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="btn-secondary cursor-pointer">
          {file ? "Change screenshot" : "Upload screenshot"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <span className="flex items-center gap-2 text-stone-600">
            {file.name}
            <button type="button" className="text-xs text-teal-700 hover:underline" onClick={() => setFile(null)}>
              Remove
            </button>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={extract} disabled={busy}>
          {busy ? "Reading listing…" : "Fill form from listing"}
        </button>
        <button type="button" className="text-sm text-stone-500 hover:underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Filled in below. Check every field before adding. Must-have facts are marked “From listing – not confirmed” and
          count as Not sure until someone confirms them.
        </p>
      )}
    </section>
  );
}
