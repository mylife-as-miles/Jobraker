import { describe, expect, it } from "vitest";
import { chooseTourPlacement, isTourStepApplicable } from "../lib/tourLayout";

const rect = (top: number, right: number, bottom: number, left: number) => ({
  top,
  right,
  bottom,
  left,
});

describe("tour layout", () => {
  it("applies mobile and desktop steps at the correct breakpoint", () => {
    expect(isTourStepApplicable("mobile", 375)).toBe(true);
    expect(isTourStepApplicable("mobile", 1024)).toBe(false);
    expect(isTourStepApplicable("desktop", 1024)).toBe(true);
    expect(isTourStepApplicable("desktop", 375)).toBe(false);
  });

  it("uses vertical placements on narrow mobile screens", () => {
    expect(chooseTourPlacement(
      rect(500, 340, 550, 20),
      { width: 360, height: 760 },
      "right",
    )).toBe("top");
  });

  it("chooses the side with the most room on desktop", () => {
    expect(chooseTourPlacement(
      rect(300, 250, 360, 150),
      { width: 1200, height: 800 },
    )).toBe("right");
  });
});
