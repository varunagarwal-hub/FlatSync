/**
 * Maps the area a listing reader returned ("HSR Layout Sector 2, Bengaluru")
 * onto one of the group's areas ("HSR Layout"), or suggests a new area name.
 */
export function matchArea(
  extracted: string,
  areas: { id: string; name: string }[],
): { areaId: string } | { newName: string } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const text = norm(extracted);
  const exact = areas.find((a) => norm(a.name) === text);
  if (exact) return { areaId: exact.id };
  // Longest group area name that appears as whole words in the extracted text
  const contained = areas
    .filter((a) => norm(a.name) && ` ${text} `.includes(` ${norm(a.name)} `))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (contained) return { areaId: contained.id };
  // New area: keep the locality, drop the trailing city/state ("X, Bengaluru")
  return { newName: extracted.split(",")[0].trim().slice(0, 60) };
}
