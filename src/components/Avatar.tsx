import type { MemberColor } from "@/lib/memberColors";

export function Avatar({
  name,
  color,
  size = 36,
  overlap = false,
}: {
  name: string;
  color: MemberColor;
  size?: number;
  overlap?: boolean;
}) {
  return (
    <span
      title={name}
      aria-label={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-edge font-bold"
      style={{
        width: size,
        height: size,
        background: color.bg,
        color: color.fg,
        fontSize: Math.round(size * 0.4),
        marginLeft: overlap ? -Math.round(size * 0.28) : 0,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ people, size = 36 }: { people: { id: string; name: string; color: MemberColor }[]; size?: number }) {
  return (
    <span className="inline-flex items-center">
      {people.map((p, i) => (
        <Avatar key={p.id} name={p.name} color={p.color} size={size} overlap={i > 0} />
      ))}
    </span>
  );
}
