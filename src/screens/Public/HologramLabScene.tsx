import { useEffect, useRef } from "react";

type HologramLabSceneProps = {
  accent: string;
  avatarUrl: string | null;
  paused?: boolean;
};

type Point = { x: number; y: number; z: number; size: number; speed: number };

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((part) => part + part).join("")
    : clean.slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return `rgba(99,243,255,${alpha})`;
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function seededPoints(count: number): Point[] {
  let seed = 271828;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  return Array.from({ length: count }, () => ({
    x: random() * 2 - 1,
    y: random() * 2 - 1,
    z: random(),
    size: 0.4 + random() * 1.5,
    speed: 0.12 + random() * 0.42,
  }));
}

export function HologramLabScene({ accent, avatarUrl, paused = false }: HologramLabSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const particles = seededPoints(96);
    const avatar = avatarUrl ? new Image() : null;
    if (avatar) {
      avatar.crossOrigin = "anonymous";
      avatar.src = avatarUrl || "";
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animationDisabled = reducedMotion || paused;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let last = performance.now();
    let scrollProgress = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onScroll = () => {
      const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollProgress = Math.min(1, Math.max(0, window.scrollY / range));
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / Math.max(1, width) - 0.5) * 2;
      pointer.ty = (event.clientY / Math.max(1, height) - 0.5) * 2;
    };

    const line = (x1: number, y1: number, x2: number, y2: number, opacity = 0.25, lineWidth = 1) => {
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.strokeStyle = hexToRgba(accent, opacity);
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const drawGrid = (time: number) => {
      const horizon = height * (0.51 + scrollProgress * 0.05);
      const centerX = width * 0.5 + pointer.x * 22;
      const bottom = height * 1.08;
      context.save();
      context.globalCompositeOperation = "screen";
      for (let index = -14; index <= 14; index += 1) {
        const edgeX = centerX + index * width * 0.085;
        line(centerX, horizon, edgeX, bottom, index % 2 === 0 ? 0.22 : 0.11);
      }
      for (let index = 0; index < 18; index += 1) {
        const phase = (index / 18 + time * 0.000025 + scrollProgress * 0.8) % 1;
        const eased = phase * phase;
        const y = horizon + eased * (bottom - horizon);
        line(0, y, width, y, 0.08 + eased * 0.2);
      }
      context.restore();
    };

    const drawRoom = (time: number) => {
      const centerX = width * 0.5 + pointer.x * 24;
      const centerY = height * 0.48 + pointer.y * 12;
      const pulse = 1 + Math.sin(time * 0.0012) * 0.025;
      const chamberWidth = Math.min(width * 0.36, 530) * pulse;
      const chamberHeight = Math.min(height * 0.62, 620) * pulse;

      context.save();
      context.translate(centerX, centerY);
      context.globalCompositeOperation = "screen";

      for (let ring = 0; ring < 5; ring += 1) {
        const radiusX = chamberWidth * (0.43 + ring * 0.065);
        const radiusY = chamberHeight * (0.42 + ring * 0.055);
        context.beginPath();
        context.ellipse(0, 0, radiusX, radiusY, Math.sin(time * 0.00025 + ring) * 0.08, 0, Math.PI * 2);
        context.strokeStyle = hexToRgba(accent, 0.16 - ring * 0.018);
        context.lineWidth = ring === 0 ? 1.4 : 0.8;
        context.stroke();
      }

      const top = -chamberHeight * 0.42;
      const bottom = chamberHeight * 0.42;
      const left = -chamberWidth * 0.43;
      const right = chamberWidth * 0.43;
      line(left, top, right, top, 0.28);
      line(right, top, right, bottom, 0.18);
      line(right, bottom, left, bottom, 0.26);
      line(left, bottom, left, top, 0.18);
      line(left, top, left * 1.26, top * 1.12, 0.12);
      line(right, top, right * 1.26, top * 1.12, 0.12);

      const scanY = top + ((time * 0.075) % Math.max(1, chamberHeight * 0.84));
      const scanGradient = context.createLinearGradient(left, scanY, right, scanY);
      scanGradient.addColorStop(0, "transparent");
      scanGradient.addColorStop(0.5, hexToRgba(accent, 0.62));
      scanGradient.addColorStop(1, "transparent");
      context.strokeStyle = scanGradient;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, scanY);
      context.lineTo(right, scanY);
      context.stroke();

      const avatarSize = Math.min(chamberWidth * 0.58, chamberHeight * 0.48);
      context.save();
      context.translate(pointer.x * 7, pointer.y * 5);
      context.beginPath();
      context.arc(0, -avatarSize * 0.04, avatarSize * 0.38, 0, Math.PI * 2);
      context.clip();
      if (avatar?.complete && avatar.naturalWidth > 0) {
        context.globalAlpha = 0.68;
        context.drawImage(avatar, -avatarSize * 0.42, -avatarSize * 0.46, avatarSize * 0.84, avatarSize * 0.84);
        context.globalCompositeOperation = "source-atop";
        context.fillStyle = hexToRgba(accent, 0.38);
        context.fillRect(-avatarSize * 0.45, -avatarSize * 0.5, avatarSize * 0.9, avatarSize * 0.9);
      } else {
        const silhouette = context.createRadialGradient(0, -avatarSize * 0.12, 4, 0, 0, avatarSize * 0.46);
        silhouette.addColorStop(0, hexToRgba(accent, 0.75));
        silhouette.addColorStop(1, hexToRgba(accent, 0.05));
        context.fillStyle = silhouette;
        context.fillRect(-avatarSize * 0.5, -avatarSize * 0.5, avatarSize, avatarSize);
      }
      context.restore();

      context.fillStyle = hexToRgba(accent, 0.8);
      context.shadowColor = hexToRgba(accent, 0.8);
      context.shadowBlur = 28;
      context.beginPath();
      context.ellipse(0, chamberHeight * 0.34, chamberWidth * 0.25, chamberHeight * 0.025, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };

    const drawParticles = (time: number) => {
      context.save();
      context.globalCompositeOperation = "screen";
      for (const particle of particles) {
        const depth = (particle.z + time * 0.00002 * particle.speed + scrollProgress * 0.4) % 1;
        const scale = 0.25 + depth * 1.35;
        const x = width * 0.5 + (particle.x + pointer.x * 0.04) * width * scale;
        const y = height * 0.48 + (particle.y + pointer.y * 0.03) * height * scale;
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
        context.fillStyle = hexToRgba(accent, 0.08 + depth * 0.42);
        context.fillRect(x, y, particle.size * scale, particle.size * scale);
      }
      context.restore();
    };

    const drawHud = (time: number) => {
      const padding = Math.max(18, width * 0.022);
      context.save();
      context.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.fillStyle = hexToRgba(accent, 0.58);
      context.letterSpacing = "1px";
      context.fillText(`SYS ${String(Math.floor(time / 100) % 9999).padStart(4, "0")}`, padding, height - padding);
      context.fillText(`DEPTH ${Math.round(scrollProgress * 100).toString().padStart(3, "0")}%`, width - padding - 92, height - padding);
      const bracket = 18;
      line(padding, padding, padding + bracket, padding, 0.55);
      line(padding, padding, padding, padding + bracket, 0.55);
      line(width - padding, padding, width - padding - bracket, padding, 0.55);
      line(width - padding, padding, width - padding, padding + bracket, 0.55);
      line(padding, height - padding, padding + bracket, height - padding, 0.55);
      line(padding, height - padding, padding, height - padding - bracket, 0.55);
      line(width - padding, height - padding, width - padding - bracket, height - padding, 0.55);
      line(width - padding, height - padding, width - padding, height - padding - bracket, 0.55);
      context.restore();
    };

    const draw = (time: number) => {
      const dt = Math.min(32, time - last);
      last = time;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 0.0045);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 0.0045);

      context.clearRect(0, 0, width, height);
      const background = context.createRadialGradient(
        width * (0.5 + pointer.x * 0.03),
        height * 0.42,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.72,
      );
      background.addColorStop(0, "rgba(7,27,30,0.98)");
      background.addColorStop(0.5, "rgba(2,10,12,0.99)");
      background.addColorStop(1, "rgba(0,2,3,1)");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      drawParticles(time);
      drawGrid(time);
      drawRoom(time);
      drawHud(time);

      context.save();
      context.globalAlpha = 0.05;
      context.fillStyle = accent;
      for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
      context.restore();

      if (!animationDisabled) frame = requestAnimationFrame(draw);
    };

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    draw(performance.now());

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [accent, avatarUrl, paused]);

  return <canvas ref={canvasRef} className="holo-scene" aria-hidden />;
}
