const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function formatFloor(floor: number): string {
  if (floor === 0) return "Ground floor";
  if (floor < 0) return `Basement ${-floor}`;
  const mod100 = floor % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[floor % 10] ?? "th";
  return `${floor}${suffix} floor`;
}

/** "Asha", "Asha and Bea", "Asha, Bea and Chitra" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
