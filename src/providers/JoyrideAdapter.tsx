import React from 'react';
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';
import { useProductTour } from './TourProvider';

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
  return (
    <div
      {...tooltipProps}
      className="relative max-w-sm w-[min(380px,90vw)] rounded-2xl border border-[#1dff00]/35 bg-gradient-to-br from-[#132313] via-[#060a06] to-black p-5 shadow-[0_4px_28px_-6px_rgba(0,0,0,0.7),0_0_0_1px_rgba(29,255,0,0.25)] text-white font-sans"
    >
      <button
        {...closeProps}
        {...skipProps}
        title="Skip tour"
        className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-[#1dff00]/15 hover:bg-[#1dff00]/30 text-[#1dff00] text-lg font-bold flex items-center justify-center shadow-inner"
      >
        ×
      </button>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-lg bg-[#1dff00]/15 border border-[#1dff00]/30 flex items-center justify-center text-[#1dff00] text-xs font-bold">
          {index + 1}
        </div>
        {step.title && (
          <h3 className="text-base font-semibold bg-gradient-to-r from-white to-[#1dff00] bg-clip-text text-transparent tracking-wide">
            {step.title}
          </h3>
        )}
      </div>
      {step.content && (
        <div className="text-sm leading-relaxed text-white/75 mb-4">
          {step.content as any}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: size }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-3 rounded-sm ${i <= index ? 'bg-[#1dff00]' : 'bg-[#1dff00]/30'} transition-colors`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            {...backProps}
            disabled={!index}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#1dff00]/35 text-[#1dff00]/80 disabled:opacity-30 hover:text-black hover:bg-[#1dff00] transition-colors"
          >
            Back
          </button>
          <button
            {...primaryProps}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-[#1dff00] text-black hover:brightness-110 shadow-[0_0_0_1px_rgba(29,255,0,0.4)] transition-all"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
      <div className="sr-only" aria-live="assertive">Step {index + 1} of {size}. {step.title}</div>
    </div>
  );
};

export const JoyrideAdapter: React.FC = () => {
  const { activeId, page, isRunning, next, back, skip, steps: internalSteps } = useProductTour();
  const [steps, setSteps] = React.useState<Step[]>([]);

  // Build Joyride steps from DOM data-tour elements for current page when running.
  React.useEffect(() => {
    if (!isRunning) { setSteps([]); return; }
    // Query all current data-tour registered nodes with ordering attribute if present
    // Map internal registry order to Joyride steps so descriptions match coach mark definitions.
    const built: Step[] = internalSteps.map(m => {
      // Resolve element again (in case Joyride re-renders after dynamic layout shift)
      let el: HTMLElement | null = m.element || null;
      if (!el && m.selector) {
        try { el = document.querySelector<HTMLElement>(m.selector.startsWith('[') ? m.selector : `[data-tour="${m.selector}"]`); } catch { el = null; }
      }
      return {
        target: el || 'body',
        title: m.title,
        content: m.body,
        placement: (m.placement as any) || 'auto',
        disableBeacon: true,
        styles: { options: { zIndex: 10050 } },
      } as Step;
    }).filter(s => !!s.target);
    setSteps(built);
  }, [page, isRunning, activeId, internalSteps]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      skip();
      return;
    }
    if (['reset','close'].includes(action || '')) {
      skip();
      return;
    }
    if (type === 'step:after' && action === 'next') {
      next();
    } else if (type === 'step:after' && action === 'prev') {
      back();
    }
  };

  // Global style overrides (insert once)
  React.useEffect(() => {
    const id = '__joyride_brand_theme';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
  .react-joyride__overlay { backdrop-filter: blur(1.5px); }
        .react-joyride__spotlight { box-shadow: 0 0 0 2px #1dff00, 0 0 0 6px rgba(29,255,0,0.25), 0 0 0 10000px rgba(0,0,0,0.55) !important; border-radius: 12px !important; }
        .react-joyride__tooltip { background: transparent !important; box-shadow: none !important; }
        .react-joyride__beacon { box-shadow: 0 0 0 0 rgba(29,255,0,0.65); animation: joyPulse 2.4s ease-in-out infinite; }
        @keyframes joyPulse { 0%{ box-shadow:0 0 0 0 rgba(29,255,0,0.45);} 70%{ box-shadow:0 0 0 14px rgba(29,255,0,0);} 100%{ box-shadow:0 0 0 0 rgba(29,255,0,0);} }
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
      spotlightClicks
      tooltipComponent={BrandedTooltip as any}
      styles={{
        options: {
          zIndex: 10040,
          primaryColor: '#1dff00',
          textColor: '#ffffff',
          overlayColor: 'rgba(0,0,0,0.55)',
          arrowColor: '#132313',
        },
        buttonNext: { background: '#1dff00', color: '#000', fontWeight: 600 },
        buttonBack: { color: '#1dff00' },
        buttonSkip: { color: '#1dff00' },
        beaconInner: { backgroundColor: '#1dff00' },
      }}
      callback={handleCallback}
    />
  );
};
