import { describe, expect, it } from "vitest";
import { rozwinDostepnosc } from "./submitApplication";

describe("rozwinDostepnosc", () => {
  it("generuje okna tylko dla wybranych dni tygodnia, w przyszłości", () => {
    const okna = rozwinDostepnosc([0, 2], "08:00", "12:00", 2); // pon+śr, 2 tygodnie
    expect(okna).toHaveLength(4);
    for (const o of okna) {
      const start = new Date(o.start_ts);
      expect(start.getTime()).toBeGreaterThan(Date.now());
      expect([1, 3]).toContain(start.getDay()); // JS: 1=pon, 3=śr
      expect(start.getHours()).toBe(8);
      expect(new Date(o.end_ts).getHours()).toBe(12);
    }
  });

  it("pusta lista dni → brak okien", () => {
    expect(rozwinDostepnosc([], "08:00", "16:00")).toEqual([]);
  });
});
