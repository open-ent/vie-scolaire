import { describe, expect, it } from "vitest";
import { defaultTimeSlot, endOfHalfDay, endTimes, formatTime, unassociated } from "./timeSlots";

describe("plages horaires", () => {
  it("met une heure au format HH:mm", () => {
    expect(formatTime("8:5")).toBe("08:05");
    expect(formatTime("12:30:00")).toBe("12:30");
    expect(formatTime("abc")).toBe("");
    expect(formatTime(undefined)).toBe("");
  });
  it("trouve le profil appliqué", () => {
    expect(defaultTimeSlot([{ _id: "a", name: "A" }, { _id: "b", name: "B", default: true }])?._id).toBe("b");
    expect(defaultTimeSlot([])).toBeUndefined();
  });
  it("propose les fins de plage sans doublon, triées", () => {
    const slot = { _id: "a", name: "A", slots: [{ id: "1", name: "M2", startHour: "08:00", endHour: "09:00" }, { id: "2", name: "M1", startHour: "07:00", endHour: "8:00" }, { id: "3", name: "x", startHour: "07:00", endHour: "09:00" }] };
    expect(endTimes(slot)).toEqual(["08:00", "09:00"]);
    expect(endTimes(undefined)).toEqual([]);
  });
  it("ne propose que les classes sans profil, triées par nom", () => {
    const classes = [{ id: "2", name: "6B" }, { id: "1", name: "6A" }, { id: "3", name: "5A" }];
    expect(unassociated(classes, new Set(["1"])).map((c) => c.name)).toEqual(["5A", "6B"]);
  });
});

describe("fin de demi-journée", () => {
  it("lit le champ du serveur (end_of_half_day) au format HH:mm", () => {
    expect(endOfHalfDay({ _id: "a", name: "A", end_of_half_day: "12:00:00" })).toBe("12:00");
    expect(endOfHalfDay({ _id: "a", name: "A" })).toBe("");
    expect(endOfHalfDay(undefined)).toBe("");
  });
});
