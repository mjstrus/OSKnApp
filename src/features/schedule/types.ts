import type { TypRozliczenia } from "@/engine/types";

export type SlotStatus =
  | "zaplanowany"
  | "odbyty"
  | "odwolany_w_oknie"
  | "usprawiedliwiony"
  | "nieusprawiedliwiony";

export interface SlotView {
  id: string;
  start_ts: string;
  end_ts: string;
  status: SlotStatus;
  instructor_id: string;
}

/** Wolne okno możliwe do rezerwacji (wyliczone przez silnik scheduling). */
export interface SlotDoRezerwacji {
  instructor_id: string;
  start_ts: string;
  end_ts: string;
}

/** Mapowanie statusu slotu na wejście automatu liczników (Unit 2). */
export const STATUS_NA_ROZLICZENIE: Record<
  Exclude<SlotStatus, "zaplanowany">,
  TypRozliczenia
> = {
  odbyty: "odbyta",
  odwolany_w_oknie: "odwolana_w_oknie",
  usprawiedliwiony: "usprawiedliwiona",
  nieusprawiedliwiony: "nieusprawiedliwiona",
};
