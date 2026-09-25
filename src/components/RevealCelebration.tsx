"use client";

import { useEffect, useState } from "react";
import { joinNames } from "@/lib/format";
import type { MemberColor } from "@/lib/memberColors";

/**
 * The "answers unlocked" moment, shown once per person per group after the
 * last member submits. Dismissing it (or jumping to the options) hides it on
 * this device.
 */
export function RevealCelebration({
  groupId,
  people,
  optionCount,
}: {
  groupId: string;
  people: { name: string; color: MemberColor }[];
  optionCount: number;
}) {
  const key = `flatsync:revealed-seen:${groupId}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(key) !== "1");
    } catch {
      setShow(true);
    }
  }, [key]);

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // storage blocked: it just shows again next time
    }
    setShow(false);
  }

  if (!show) return null;

  // Circles arranged evenly around the middle, so they all overlap there.
  const n = Math.max(people.length, 1);
  const r = n <= 3 ? 76 : n <= 4 ? 66 : 58;
  const spread = n === 1 ? 0 : n <= 3 ? 44 : 50;
  const circles = people.map((p, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const cx = 150 + spread * Math.cos(a);
    const cy = 128 + spread * Math.sin(a);
    const lx = 150 + (spread + r * 0.62) * Math.cos(a);
    const ly = 128 + (spread + r * 0.62) * Math.sin(a) + 5;
    return { ...p, cx, cy, lx, ly };
  });

  return (
    <section
      aria-labelledby="reveal-title"
      className="relative overflow-hidden rounded-[26px] border-2 border-edge bg-violet p-6 text-white shadow-[6px_6px_0_var(--shadow)] sm:p-8 dark:shadow-[6px_6px_0_#000]"
    >
      <div className="grid items-center gap-6 sm:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <p className="text-xs font-bold tracking-[0.12em] text-white/85 uppercase">Everyone's in</p>
          <h2 id="reveal-title" className="text-4xl leading-[0.98] font-extrabold sm:text-5xl">
            Answers unlocked!
          </h2>
          <p className="max-w-md text-base text-white/90">
            {joinNames(people.map((p) => p.name))} have all submitted. Now you can see each other's answers, where your
            circles overlap, and {optionCount === 0 ? "which listings fit" : `${optionCount} option${optionCount === 1 ? "" : "s"} to talk about`}.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="#options" onClick={dismiss} className="btn-sun text-base">
              {optionCount === 0 ? "See where things stand" : `See your ${optionCount} option${optionCount === 1 ? "" : "s"}`}
            </a>
            <button type="button" onClick={dismiss} className="text-sm font-bold text-white/90 underline underline-offset-2">
              Dismiss
            </button>
          </div>
        </div>
        <svg viewBox="0 0 300 256" className="mx-auto w-full max-w-[300px]" role="img" aria-label="Everyone's circles overlapping in the middle">
          {circles.map((c, i) => (
            <circle
              key={c.name}
              className={`pop-in pop-in-${Math.min(i + 1, 6)}`}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              cx={c.cx}
              cy={c.cy}
              r={r}
              fill={c.color.bg}
              fillOpacity={0.88}
              stroke="#1B1740"
              strokeWidth={3}
            />
          ))}
          <circle cx={150} cy={128} r={27} fill="#FFFFFF" stroke="#1B1740" strokeWidth={3} />
          <text x={150} y={133} textAnchor="middle" fontWeight={800} fontSize={15} fill="#1B1740" style={{ fontFamily: "var(--font-display)" }}>
            All {people.length}
          </text>
          {circles.map((c) => (
            <text key={`l-${c.name}`} x={c.lx} y={c.ly} textAnchor="middle" fontWeight={700} fontSize={13} fill={c.color.fg}>
              {c.name.length > 10 ? `${c.name.slice(0, 9)}…` : c.name}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}
