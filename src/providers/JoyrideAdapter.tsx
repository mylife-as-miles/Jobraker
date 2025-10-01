import React from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useProductTour } from './TourProvider';

/*
  JoyrideAdapter bridges existing internal tour registration with react-joyride to
  provide a richer UX (beacons, spotlight, auto positioning, keyboard support).
  We map the currently active internal step to a Joyride step set each render.
  This keeps existing registration + DB walkthrough completion logic intact.
*/

export const JoyrideAdapter: React.FC = () => {
  const { activeId, page, isRunning, next, back, skip } = useProductTour();
  const [steps, setSteps] = React.useState<Step[]>([]);

  // Build Joyride steps from DOM data-tour elements for current page when running.
  React.useEffect(() => {
    if (!isRunning) { setSteps([]); return; }
    // Query all current data-tour registered nodes with ordering attribute if present
    const nodes = Array.from(document.querySelectorAll('[data-tour]')) as HTMLElement[];
    const filtered = nodes.filter(n => !!n.getAttribute('data-tour'));
  const built: Step[] = filtered.map((el) => ({
      target: el,
      title: el.getAttribute('data-tour-title') || undefined,
      content: el.getAttribute('data-tour-desc') || el.getAttribute('aria-description') || el.getAttribute('title') || 'Feature',
      placement: 'auto',
      disableBeacon: true,
      styles: { options: { zIndex: 10050 } },
    }));
    setSteps(built);
  }, [page, isRunning, activeId]);

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
      styles={{
        options: {
          zIndex: 10040,
          primaryColor: '#1dff00',
          textColor: '#ffffff',
          overlayColor: 'rgba(0,0,0,0.55)',
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
