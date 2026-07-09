import { describe, expect, it } from "vitest";
import { wolneSlotyKursanta, zajeteZeSlotow } from "./availability";
import type { SlotView } from "./types";

// 2026-07-06 to poniedziałek (dzien_tygodnia = 0).
const PONIEDZIALEK = new Date("2026-07-06T00:00:00Z");

describe("wolneSlotyKursanta (R7)", () => {
  it("część wspólna godzin pracy i dostępności, pocięta na 1 h", () => {
    const sloty = wolneSlotyKursanta({
      instructorId: "i1",
      godzinyPracy: [{ dzien_tygodnia: 0, od_godz: "08:00", do_godz: "12:00" }],
      zajeteSloty: [],
      dostepnoscKursanta: [{ start_ts: "2026-07-06T09:00:00Z", end_ts: "2026-07-06T11:00:00Z" }],
      odDaty: PONIEDZIALEK,
      dni: 1,
    });
    expect(sloty).toHaveLength(2);
    expect(sloty[0]).toMatchObject({
      instructor_id: "i1",
      start_ts: "2026-07-06T09:00:00.000Z",
      end_ts: "2026-07-06T10:00:00.000Z",
    });
  });

  it("odejmuje zajęty slot instruktora z wolnych okien", () => {
    const sloty = wolneSlotyKursanta({
      instructorId: "i1",
      godzinyPracy: [{ dzien_tygodnia: 0, od_godz: "08:00", do_godz: "12:00" }],
      zajeteSloty: [{ start_ts: "2026-07-06T09:00:00Z", end_ts: "2026-07-06T10:00:00Z" }],
      dostepnoscKursanta: [{ start_ts: "2026-07-06T08:00:00Z", end_ts: "2026-07-06T12:00:00Z" }],
      odDaty: PONIEDZIALEK,
      dni: 1,
    });
    // 08-09, 10-11, 11-12 wolne; 09-10 zajęte
    expect(sloty.map((s) => s.start_ts)).toEqual([
      "2026-07-06T08:00:00.000Z",
      "2026-07-06T10:00:00.000Z",
      "2026-07-06T11:00:00.000Z",
    ]);
  });

  it("brak dostępności kursanta → brak slotów", () => {
    const sloty = wolneSlotyKursanta({
      instructorId: "i1",
      godzinyPracy: [{ dzien_tygodnia: 0, od_godz: "08:00", do_godz: "12:00" }],
      zajeteSloty: [],
      dostepnoscKursanta: [],
      odDaty: PONIEDZIALEK,
      dni: 1,
    });
    expect(sloty).toEqual([]);
  });
});

describe("zajeteZeSlotow", () => {
  it("bierze tylko aktywne sloty (zaplanowany/odbyty)", () => {
    const sloty: SlotView[] = [
      { id: "a", instructor_id: "i1", start_ts: "x", end_ts: "y", status: "zaplanowany" },
      { id: "b", instructor_id: "i1", start_ts: "x", end_ts: "y", status: "odbyty" },
      { id: "c", instructor_id: "i1", start_ts: "x", end_ts: "y", status: "odwolany_w_oknie" },
    ];
    expect(zajeteZeSlotow(sloty)).toHaveLength(2);
  });
});
