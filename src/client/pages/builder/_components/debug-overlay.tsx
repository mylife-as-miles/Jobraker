import { useEffect, useState } from "react";

export const DebugOverlay = () => {
  const [visible, setVisible] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1');
  const [info, setInfo] = useState<any>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'd') setVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const h = () => setInfo({
      size: { w: window.innerWidth, h: window.innerHeight },
      scroll: { x: window.scrollX, y: window.scrollY },
      time: new Date().toLocaleTimeString(),
    });
    h();
    const id = setInterval(h, 500);
    return () => clearInterval(id);
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-50 rounded bg-black/70 p-2 text-[11px] text-white shadow-lg">
      <div>Debug Overlay (toggle with 'd')</div>
      <div>Viewport: {info?.size?.w} × {info?.size?.h}</div>
      <div>Scroll: {info?.scroll?.x}, {info?.scroll?.y}</div>
      <div>Time: {info?.time}</div>
    </div>
  );
};
