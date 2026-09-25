/** One colour per person, by join order, used for their avatar, breakdown row and map circle. */
export interface MemberColor {
  bg: string;
  /** text colour that reads on `bg` */
  fg: string;
}

export const MEMBER_COLORS: MemberColor[] = [
  { bg: "#FF5A36", fg: "#1B1740" }, // coral
  { bg: "#6C4CF1", fg: "#FFFFFF" }, // violet
  { bg: "#19B38A", fg: "#1B1740" }, // mint
  { bg: "#FFC226", fg: "#1B1740" }, // sunflower
  { bg: "#3BA4F5", fg: "#1B1740" }, // sky
  { bg: "#F26CB4", fg: "#1B1740" }, // pink
];

export function memberColor(index: number): MemberColor {
  return MEMBER_COLORS[((index % MEMBER_COLORS.length) + MEMBER_COLORS.length) % MEMBER_COLORS.length];
}

/** memberId -> colour, from members in join order. */
export function colorMap(memberIds: string[]): Record<string, MemberColor> {
  return Object.fromEntries(memberIds.map((id, i) => [id, memberColor(i)]));
}
