export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";
export type TourViewport = "all" | "mobile" | "desktop";

export function isTourStepApplicable(
  viewport: TourViewport | undefined,
  width: number,
): boolean {
  if (!viewport || viewport === "all") return true;
  return viewport === "mobile" ? width < 768 : width >= 768;
}

export function chooseTourPlacement(
  rect: Pick<DOMRect, "top" | "right" | "bottom" | "left">,
  viewport: { width: number; height: number },
  requested?: TourPlacement,
): Exclude<TourPlacement, "center"> {
  const mobile = viewport.width < 640;
  const topInset = mobile ? 64 : 80;
  const bottomInset = mobile ? 88 : 32;
  const spaces = {
    top: Math.max(0, rect.top - topInset),
    bottom: Math.max(0, viewport.height - rect.bottom - bottomInset),
    left: Math.max(0, rect.left - 24),
    right: Math.max(0, viewport.width - rect.right - 24),
  };

  if (requested && requested !== "center") {
    if (!mobile || requested === "top" || requested === "bottom") {
      return requested;
    }
  }

  if (mobile) {
    return spaces.bottom >= spaces.top ? "bottom" : "top";
  }

  return (Object.entries(spaces) as Array<[
    Exclude<TourPlacement, "center">,
    number,
  ]>).reduce((best, candidate) => candidate[1] > best[1] ? candidate : best)[0];
}
