export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 6;
export const DEFAULT_GROUP_SIZE = 3;

export const NICE_TO_HAVES = [
  { key: "furnished", label: "Furnished" },
  { key: "balcony", label: "Balcony" },
  { key: "power_backup", label: "Power backup" },
  { key: "near_metro", label: "Near metro" },
  { key: "gated_society", label: "Gated society" },
  { key: "ac", label: "AC" },
  { key: "washing_machine", label: "Washing machine" },
  { key: "gym", label: "Gym" },
] as const;

export type NiceToHaveKey = (typeof NICE_TO_HAVES)[number]["key"];

export const NICE_TO_HAVE_KEYS: readonly string[] = NICE_TO_HAVES.map((n) => n.key);

export function niceToHaveLabel(key: string): string {
  return NICE_TO_HAVES.find((n) => n.key === key)?.label ?? key;
}

/** Yes/No must-haves: member flag -> listing field. Bathrooms are handled separately. */
export const BOOLEAN_MUST_HAVES = [
  { need: "needs_lift", field: "lift", label: "Lift" },
  { need: "needs_parking", field: "parking", label: "Parking" },
  { need: "needs_pet_friendly", field: "pet_friendly", label: "Pet-friendly" },
] as const;
