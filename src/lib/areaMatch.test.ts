import { describe, expect, it } from "vitest";
import { matchArea } from "./areaMatch";

const areas = [
  { id: "hsr", name: "HSR Layout" },
  { id: "kor", name: "Koramangala" },
  { id: "kor5", name: "Koramangala 5th Block" },
];

describe("matchArea", () => {
  it("matches exactly, ignoring case and punctuation", () => {
    expect(matchArea("hsr layout", areas)).toEqual({ areaId: "hsr" });
  });
  it("matches a group area named inside a longer address, preferring the most specific", () => {
    expect(matchArea("HSR Layout Sector 2, Bengaluru", areas)).toEqual({ areaId: "hsr" });
    expect(matchArea("Koramangala 5th Block, Bengaluru", areas)).toEqual({ areaId: "kor5" });
  });
  it("does not match partial words", () => {
    expect(matchArea("HSRLayoutish", areas)).toEqual({ newName: "HSRLayoutish" });
  });
  it("suggests a new area without the trailing city", () => {
    expect(matchArea("Indiranagar, Bengaluru, Karnataka", areas)).toEqual({ newName: "Indiranagar" });
  });
});
