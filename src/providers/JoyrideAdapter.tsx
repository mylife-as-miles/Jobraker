import React from "react";
import Joyride, {
  CallBackProps,
  STATUS,
  Step,
  TooltipRenderProps,
} from "react-joyride";
import { X } from "lucide-react";
import { useProductTour } from "./TourProvider";
import { getProxiedLogoUrl } from "../lib/utils";
import { chooseTourPlacement } from "../lib/tourLayout";

/*
  JoyrideAdapter bridges existing internal tour registration with react-joyride to
  provide a richer UX (beacons, spotlight, auto positioning, keyboard support).
  We map the currently active internal step to a Joyride step set each render.
  This keeps existing registration + DB walkthrough completion logic intact.
*/

// Brand-styled tooltip component overriding Joyride default UI
const BrandedTooltip: React.FC<TooltipRenderProps> = ({
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  step,
  index,
  size,
  isLastStep,
}) => {
  const { waiting, steps: internalSteps, activeIndex, next } = useProductTour();
  const internalStep = activeIndex >= 0 ? internalSteps[activeIndex] : null;
  const cta = internalStep?.cta;
  const raw = step.content as any as string | undefined;
  let formatted: React.ReactNode = step.content as any;
  if (typeof raw === "string" && raw.includes("\n")) {
    const lines = raw
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const allBullets = lines.every((l) => l.startsWith("- "));
    if (allBullets) {
      formatted = (
        <ul className='list-disc ml-5 space-y-1 text-foreground/75 text-sm'>
          {lines.map((l, i) => (
            <li key={i}>{l.replace(/^-\s+/, "")}</li>
          ))}
        </ul>
      );
    } else {
      formatted = (
        <div className='space-y-2 text-foreground/75 text-sm'>
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      );
    }
  }
  return (
    <div
      {...tooltipProps}
      className='relative max-w-sm w-[min(380px,calc(100vw-24px))] max-h-[calc(100dvh-120px-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-2xl border border-brand/35 bg-gradient-to-br from-[#132313] via-background to-black p-4 sm:p-5 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.7),0_0_0_1px_rgba(34,197,94,0.25)] text-white font-sans'
    >
      <button
        {...closeProps}
        {...skipProps}
        title='Skip tour'
        className='absolute top-3 right-3 h-8 w-8 rounded-full bg-brand/15 hover:bg-brand/30 text-brand text-lg font-bold flex items-center justify-center shadow-inner'
      >
        <X size={16} />
      </button>
      <div className='flex items-center gap-3 mb-2'>
        <div className='h-8 w-8 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center text-brand text-xs font-bold'>
          {index + 1}
        </div>
        {step.title && (
          <h3 className='text-base font-semibold bg-gradient-to-r from-white to-brand bg-clip-text text-transparent tracking-wide'>
            {step.title}
          </h3>
        )}
      </div>
      {step.content && (
        <div className='leading-relaxed mb-4 space-y-3'>
          {internalStep?.media && (
            <div className='rounded-lg overflow-hidden border border-brand/25 shadow-inner'>
              {internalStep.media.type === "image" && (
                <img
                  src={getProxiedLogoUrl(internalStep.media.src)}
                  alt={internalStep.media.alt || ""}
                  className='max-h-40 w-full object-cover'
                />
              )}
              {internalStep.media.type === "video" && (
                <video
                  src={internalStep.media.src}
                  className='max-h-40 w-full object-cover'
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              )}
            </div>
          )}
          {formatted}
          {cta && (
            <button
              onClick={() => {
                if (cta.event) {
                  try {
                    window.dispatchEvent(
                      new CustomEvent("tour:event", {
                        detail: {
                          type: "cta",
                          id: internalStep.id,
                          event: cta.event,
                        },
                      }),
                    );
                  } catch {}
                }
                if (cta.advanceOnClick) next();
              }}
              className='mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-xs font-medium transition-colors'
            >
              {cta.label}
            </button>
          )}
        </div>
      )}
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-1' aria-hidden='true'>
          {Array.from({ length: size }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-3 rounded-sm ${i <= index ? "bg-brand" : "bg-brand/30"} transition-colors`}
            />
          ))}
        </div>
        <div className='flex gap-2'>
          <button
            {...backProps}
            disabled={!index}
            className='px-3 py-1.5 rounded-md text-xs font-medium border border-brand/35 text-brand/80 disabled:opacity-30 hover:text-black hover:bg-brand transition-colors'
          >
            Back
          </button>
          <button
            {...primaryProps}
            disabled={waiting}
            className='px-3 py-1.5 rounded-md text-xs font-semibold bg-brand text-black hover:brightness-110 shadow-[0_0_0_1px_rgba(34,197,94,0.4)] transition-all'
          >
            {waiting ? "Complete action…" : isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </div>
      <div className='sr-only' aria-live='assertive'>
        Step {index + 1} of {size}. {step.title}
      </div>
    </div>
  );
};

export const JoyrideAdapter: React.FC = () => {
  const {
    activeId,
    page,
    isRunning,
    next,
    back,
    skip,
    steps: internalSteps,
    activeIndex,
  } = useProductTour();
  const [steps, setSteps] = React.useState<Step[]>([]);
  const [viewportVersion, setViewportVersion] = React.useState(0);

  React.useEffect(() => {
    const updateViewport = () => setViewportVersion((version) => version + 1);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  // Build Joyride steps from DOM data-tour elements for current page when running.
  React.useEffect(() => {
    if (!isRunning) {
      setSteps([]);
      return;
    }
    // Query all current data-tour registered nodes with ordering attribute if present
    // Map internal registry order to Joyride steps so descriptions match coach mark definitions.
    const built = internalSteps
      .map((m) => {
        // Resolve element again (in case Joyride re-renders after dynamic layout shift)
        let el: HTMLElement | null = m.element || null;
        const selector = window.innerWidth < 768 && m.mobileSelector
          ? m.mobileSelector
          : m.selector;
        if (!el && selector) {
          try {
            el = document.querySelector<HTMLElement>(
              selector.startsWith("[") || selector.startsWith(".") ||
                  selector.startsWith("#") || selector.includes(" ")
                ? selector
                : `[data-tour="${selector}"]`,
            );
          } catch {
            el = null;
          }
        }
        if (!el) return null;
        const placement = chooseTourPlacement(
          el.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
          m.placement,
        );

        // Add offset to prevent tooltips from appearing at screen edges
        const offset = 16;
        return {
          target: el,
          title: m.title,
          content: m.body,
          placement,
          disableBeacon: true,
          offset: offset,
          styles: {
            options: {
              zIndex: 10050,
              arrowColor: "#132313",
            },
            tooltip: {
              borderRadius: "16px",
            },
            tooltipContainer: {
              textAlign: "left",
            },
          },
        } as Step;
      })
      .filter((step): step is Step => step !== null);
    setSteps(built);
  }, [page, isRunning, activeId, internalSteps, viewportVersion]);

  // Ensure current target is visible when step changes with better positioning
  React.useEffect(() => {
    if (!isRunning || activeIndex < 0) return;
    const step = internalSteps[activeIndex];
    if (!step) return;
    let el: HTMLElement | null = step.element || null;
    if (!el && step.selector) {
      try {
        el = document.querySelector<HTMLElement>(
          step.selector.startsWith("[")
            ? step.selector
            : `[data-tour="${step.selector}"]`,
        );
      } catch {
        el = null;
      }
    }
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mobile = window.innerWidth < 768;
    const topInset = mobile ? 64 : 80;
    const bottomInset = mobile ? 88 : 32;
    const fullyVisible = rect.top >= topInset &&
      rect.bottom <= window.innerHeight - bottomInset;
    if (!fullyVisible) {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [activeIndex, isRunning, internalSteps, viewportVersion]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      skip();
      return;
    }
    if (["reset", "close"].includes(action || "")) {
      skip();
      return;
    }
    if (type === "step:after" && action === "next") {
      next();
    } else if (type === "step:after" && action === "prev") {
      back();
    }
  };

  // Global style overrides (insert once)
  React.useEffect(() => {
    const id = "__joyride_brand_theme";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
  .react-joyride__overlay { backdrop-filter: blur(0.4px); }
    .react-joyride__spotlight { box-shadow: 0 0 0 2px #22c55e, 0 0 0 6px rgba(34,197,94,0.25), 0 0 0 10000px rgba(0,0,0,0.45) !important; border-radius: 12px !important; }
        .react-joyride__tooltip { background: transparent !important; box-shadow: none !important; position: relative !important; }
        @media (max-width: 639px) {
          .react-joyride__tooltip { max-width: calc(100vw - 24px) !important; }
        }
        .react-joyride__tooltip[data-placement="bottom"] { margin-top: 16px !important; }
        .react-joyride__tooltip[data-placement="top"] { margin-bottom: 16px !important; }
        .react-joyride__tooltip[data-placement="left"] { margin-right: 16px !important; }
        .react-joyride__tooltip[data-placement="right"] { margin-left: 16px !important; }
        .react-joyride__beacon { box-shadow: 0 0 0 0 rgba(34,197,94,0.65); animation: joyPulse 2.4s ease-in-out infinite; }
        @keyframes joyPulse { 0%{ box-shadow:0 0 0 0 rgba(34,197,94,0.45);} 70%{ box-shadow:0 0 0 14px rgba(34,197,94,0);} 100%{ box-shadow:0 0 0 0 rgba(34,197,94,0);} }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (!isRunning || !steps.length) return null;
  return (
    <Joyride
      steps={steps}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      hideCloseButton
      scrollToFirstStep
      scrollOffset={window.innerWidth < 768 ? 96 : 80}
      spotlightPadding={8}
      spotlightClicks
      tooltipComponent={BrandedTooltip}
      floaterProps={{
        disableAnimation: false,
        placement: "auto",
        styles: {
          arrow: {
            length: 8,
            spread: 16,
          },
        },
      }}
      styles={{
        options: {
          zIndex: 10040,
          primaryColor: "#22c55e",
          textColor: "#ffffff",
          overlayColor: "rgba(0,0,0,0.55)",
          arrowColor: "#132313",
        },
        buttonNext: { background: "#22c55e", color: "#000", fontWeight: 600 },
        buttonBack: { color: "#22c55e" },
        buttonSkip: { color: "#22c55e" },
        beaconInner: { backgroundColor: "#22c55e" },
      }}
      callback={handleCallback}
    />
  );
};
