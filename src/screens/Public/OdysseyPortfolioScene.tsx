import { useEffect, useMemo, useRef } from "react";

type Mission = { title: string; company: string };

type OdysseyPortfolioSceneProps = {
  profileName: string;
  role: string;
  accent: string;
  skills: string[];
  missions: Mission[];
};

type StarPoint = { x: number; y: number; z: number; size: number; phase: number };

type FlightKeyframe = {
  progress: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

const FLIGHT_PATH: FlightKeyframe[] = [
  { progress: 0, x: 0.5, y: 0.72, rotation: 0, scale: 1 },
  { progress: 0.16, x: 0.5, y: 0.5, rotation: -0.08, scale: 0.95 },
  { progress: 0.29, x: 0.76, y: 0.58, rotation: 1.05, scale: 0.7 },
  { progress: 0.46, x: 0.28, y: 0.42, rotation: -0.68, scale: 0.58 },
  { progress: 0.66, x: 0.67, y: 0.46, rotation: 0.38, scale: 0.48 },
  { progress: 0.84, x: 0.4, y: 0.34, rotation: -0.12, scale: 0.4 },
  { progress: 1, x: 0.53, y: 0.28, rotation: 0, scale: 0.3 },
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
const smoothstep = (value: number, start: number, end: number) => {
  const t = clamp((value - start) / Math.max(0.0001, end - start));
  return t * t * (3 - 2 * t);
};

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function parseHex(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized.slice(0, 6);
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return { r: 76, g: 201, b: 240 };
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function flightAt(progress: number) {
  let next = FLIGHT_PATH[FLIGHT_PATH.length - 1];
  let previous = FLIGHT_PATH[0];
  for (let index = 1; index < FLIGHT_PATH.length; index += 1) {
    if (progress <= FLIGHT_PATH[index].progress) {
      next = FLIGHT_PATH[index];
      previous = FLIGHT_PATH[index - 1];
      break;
    }
  }
  const amount = smoothstep(progress, previous.progress, next.progress);
  return {
    x: lerp(previous.x, next.x, amount),
    y: lerp(previous.y, next.y, amount),
    rotation: lerp(previous.rotation, next.rotation, amount),
    scale: lerp(previous.scale, next.scale, amount),
  };
}

function drawRoundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawRocket(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  rotation: number,
  accent: string,
  thrust: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.scale(scale, scale);

  const glow = context.createRadialGradient(0, 44, 4, 0, 48, 78 + thrust * 22);
  glow.addColorStop(0, "rgba(255,255,255,.95)");
  glow.addColorStop(0.22, rgba(accent, 0.95));
  glow.addColorStop(1, "rgba(45,98,255,0)");
  context.fillStyle = glow;
  context.beginPath();
  context.ellipse(0, 54, 22 + thrust * 7, 62 + thrust * 28, 0, 0, Math.PI * 2);
  context.fill();

  context.shadowColor = rgba(accent, 0.7);
  context.shadowBlur = 24;
  context.fillStyle = "#e8f4ff";
  context.strokeStyle = "rgba(125,249,255,.9)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -62);
  context.bezierCurveTo(25, -42, 27, 25, 13, 48);
  context.lineTo(-13, 48);
  context.bezierCurveTo(-27, 25, -25, -42, 0, -62);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 0;
  context.fillStyle = "#0d1735";
  context.beginPath();
  context.arc(0, -18, 10, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = rgba(accent, 0.95);
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = rgba(accent, 0.95);
  context.beginPath();
  context.moveTo(-12, 27);
  context.lineTo(-34, 48);
  context.lineTo(-13, 44);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(12, 27);
  context.lineTo(34, 48);
  context.lineTo(13, 44);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(5,10,28,.9)";
  context.fillRect(-13, 45, 26, 9);
  context.restore();
}

function drawPlanet(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  colors: [string, string, string],
  alpha: number,
  ring = false,
) {
  if (alpha <= 0.001) return;
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);

  if (ring) {
    context.save();
    context.rotate(-0.28);
    context.strokeStyle = colors[1];
    context.lineWidth = Math.max(2, radius * 0.08);
    context.globalAlpha = alpha * 0.65;
    context.beginPath();
    context.ellipse(0, 0, radius * 1.72, radius * 0.43, 0, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = colors[2];
    context.lineWidth = Math.max(1, radius * 0.025);
    context.beginPath();
    context.ellipse(0, 0, radius * 1.98, radius * 0.51, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  context.shadowColor = colors[1];
  context.shadowBlur = radius * 0.6;
  const gradient = context.createRadialGradient(-radius * 0.32, -radius * 0.38, radius * 0.04, 0, 0, radius);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.52, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.shadowBlur = 0;
  context.globalCompositeOperation = "screen";
  context.strokeStyle = "rgba(255,255,255,.18)";
  context.lineWidth = 1;
  for (let index = 0; index < 8; index += 1) {
    context.beginPath();
    context.ellipse(
      0,
      -radius * 0.58 + index * radius * 0.16,
      radius * Math.sqrt(Math.max(0.08, 1 - ((index - 3.5) / 4.2) ** 2)),
      radius * 0.05,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }
  context.restore();
}

function drawHologramCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  index: number,
  alpha: number,
  accent: string,
) {
  context.save();
  context.globalAlpha = alpha;
  context.translate(x, y);
  context.rotate((index % 2 === 0 ? -1 : 1) * 0.04);
  context.shadowColor = rgba(accent, 0.55);
  context.shadowBlur = 20;
  drawRoundRect(context, -width / 2, -height / 2, width, height, 12);
  context.fillStyle = "rgba(5,15,38,.66)";
  context.fill();
  context.strokeStyle = rgba(accent, 0.82);
  context.lineWidth = 1;
  context.stroke();
  context.shadowBlur = 0;

  context.fillStyle = rgba(accent, 0.92);
  context.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(`SKILL ${String(index + 1).padStart(2, "0")}`, -width / 2 + 14, -height / 2 + 21);
  context.fillStyle = "rgba(232,244,255,.94)";
  context.font = "700 15px Inter, system-ui, sans-serif";
  const trimmed = label.length > 22 ? `${label.slice(0, 21)}…` : label;
  context.fillText(trimmed, -width / 2 + 14, 7);
  context.fillStyle = "rgba(154,220,255,.24)";
  context.fillRect(-width / 2 + 14, height / 2 - 22, width - 28, 4);
  context.fillStyle = rgba(accent, 0.92);
  context.fillRect(-width / 2 + 14, height / 2 - 22, (width - 28) * (0.55 + (index % 4) * 0.1), 4);
  context.restore();
}

export function OdysseyPortfolioScene({
  profileName,
  role,
  accent,
  skills,
  missions,
}: OdysseyPortfolioSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stars = useMemo<StarPoint[]>(() => Array.from({ length: 340 }, (_, index) => ({
    x: seeded(index * 5 + 1),
    y: seeded(index * 5 + 2),
    z: 0.2 + seeded(index * 5 + 3) * 0.8,
    size: 0.35 + seeded(index * 5 + 4) * 1.9,
    phase: seeded(index * 5 + 5) * Math.PI * 2,
  })), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let targetProgress = 0;
    let progress = 0;
    let velocity = 0;
    let previousScroll = window.scrollY;
    let pointerX = 0;
    let pointerY = 0;
    let smoothPointerX = 0;
    let smoothPointerY = 0;
    let frame = 0;
    let lastTime = performance.now();

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      targetProgress = clamp(window.scrollY / maxScroll);
      velocity = clamp((window.scrollY - previousScroll) / Math.max(1, height), -0.15, 0.15);
      previousScroll = window.scrollY;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(1, width) - 0.5) * 2;
      pointerY = (event.clientY / Math.max(1, height) - 0.5) * 2;
    };

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const delta = Math.min(40, time - lastTime) / 16.6667;
      lastTime = time;
      progress += (targetProgress - progress) * (reducedMotion ? 1 : 0.065 * delta);
      velocity *= 0.92;
      smoothPointerX += (pointerX - smoothPointerX) * 0.035 * delta;
      smoothPointerY += (pointerY - smoothPointerY) * 0.035 * delta;

      context.clearRect(0, 0, width, height);
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "#02030c");
      background.addColorStop(0.54, "#070d24");
      background.addColorStop(1, "#02040d");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const nebulaX = width * (0.24 + progress * 0.58) + smoothPointerX * 25;
      const nebulaY = height * (0.35 + Math.sin(progress * Math.PI * 2) * 0.12) + smoothPointerY * 18;
      const nebula = context.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, Math.max(width, height) * 0.72);
      nebula.addColorStop(0, rgba(accent, 0.18));
      nebula.addColorStop(0.35, "rgba(82,45,170,.13)");
      nebula.addColorStop(1, "rgba(3,5,18,0)");
      context.fillStyle = nebula;
      context.fillRect(0, 0, width, height);

      const warp = smoothstep(progress, 0.1, 0.23) * (1 - smoothstep(progress, 0.3, 0.38));
      for (let index = 0; index < stars.length; index += 1) {
        const star = stars[index];
        const depth = 0.35 + star.z * 0.9;
        const starX = ((star.x + progress * (0.03 + star.z * 0.12)) % 1) * width + smoothPointerX * depth * 9;
        const starY = ((star.y + progress * (0.08 + star.z * 0.17)) % 1) * height + smoothPointerY * depth * 7;
        const twinkle = 0.55 + Math.sin(time * 0.0015 + star.phase) * 0.3;
        context.strokeStyle = `rgba(190,225,255,${clamp(twinkle * star.z, 0.08, 0.9)})`;
        context.lineWidth = star.size;
        context.beginPath();
        context.moveTo(starX, starY);
        const streak = warp * (15 + star.z * 80 + Math.abs(velocity) * 620);
        context.lineTo(starX - streak, starY + streak * 0.1);
        context.stroke();
      }

      const minSize = Math.min(width, height);
      const aboutAlpha = smoothstep(progress, 0.17, 0.26) * (1 - smoothstep(progress, 0.42, 0.49));
      drawPlanet(
        context,
        width * (0.22 + smoothPointerX * 0.012),
        height * (0.54 + smoothPointerY * 0.009),
        minSize * 0.245,
        ["#ffd4a8", "#e06628", "#48121b"],
        aboutAlpha,
      );

      const skillAlpha = smoothstep(progress, 0.34, 0.41) * (1 - smoothstep(progress, 0.57, 0.63));
      const visibleSkills = skills.length ? skills.slice(0, 6) : ["Strategy", "Communication", "Leadership", "Execution"];
      visibleSkills.forEach((skill, index) => {
        const spread = (index - (visibleSkills.length - 1) / 2) * Math.min(180, width * 0.15);
        const depth = 1 - Math.abs(index - visibleSkills.length / 2) * 0.08;
        drawHologramCard(
          context,
          width / 2 + spread + smoothPointerX * 12 * depth,
          height * (0.48 + Math.sin(index * 1.4 + time * 0.0004) * 0.1),
          Math.min(174, width * 0.29) * depth,
          86 * depth,
          skill,
          index,
          skillAlpha * clamp(1 - Math.abs(spread) / Math.max(width, 1), 0.25, 1),
          accent,
        );
      });

      const missionAlpha = smoothstep(progress, 0.53, 0.61) * (1 - smoothstep(progress, 0.8, 0.86));
      drawPlanet(
        context,
        width * (0.72 + smoothPointerX * 0.012),
        height * (0.48 + smoothPointerY * 0.01),
        minSize * 0.21,
        ["#b7e8ff", "#2879cf", "#0b174f"],
        missionAlpha,
        true,
      );
      const visibleMissions = missions.length ? missions.slice(0, 5) : [{ title: role, company: profileName }];
      visibleMissions.forEach((mission, index) => {
        const angle = time * 0.00016 + index * (Math.PI * 2 / visibleMissions.length);
        const orbitX = width * 0.72 + Math.cos(angle) * minSize * 0.31;
        const orbitY = height * 0.48 + Math.sin(angle) * minSize * 0.12;
        const cardWidth = Math.min(150, width * 0.25);
        context.save();
        context.globalAlpha = missionAlpha * (0.52 + Math.sin(angle) * 0.25);
        context.translate(orbitX, orbitY);
        context.rotate(Math.sin(angle) * 0.1);
        drawRoundRect(context, -cardWidth / 2, -35, cardWidth, 70, 8);
        context.fillStyle = "rgba(7,15,39,.82)";
        context.fill();
        context.strokeStyle = "rgba(125,249,255,.62)";
        context.stroke();
        context.fillStyle = "rgba(232,244,255,.92)";
        context.font = "700 11px Inter, system-ui, sans-serif";
        context.fillText(mission.title.slice(0, 19), -cardWidth / 2 + 10, -5);
        context.fillStyle = "rgba(154,220,255,.7)";
        context.font = "500 9px ui-monospace, monospace";
        context.fillText(mission.company.slice(0, 21), -cardWidth / 2 + 10, 15);
        context.restore();
      });

      const contactAlpha = smoothstep(progress, 0.76, 0.86);
      if (contactAlpha > 0.001) {
        context.save();
        context.globalAlpha = contactAlpha;
        const sunX = width * 0.5 + smoothPointerX * 8;
        const sunY = height * 0.45 + smoothPointerY * 6;
        const radius = minSize * (0.17 + contactAlpha * 0.03);
        const sunGlow = context.createRadialGradient(sunX, sunY, radius * 0.05, sunX, sunY, radius * 2.7);
        sunGlow.addColorStop(0, "rgba(255,255,255,1)");
        sunGlow.addColorStop(0.13, "rgba(255,233,148,.98)");
        sunGlow.addColorStop(0.36, rgba(accent, 0.8));
        sunGlow.addColorStop(1, "rgba(255,119,45,0)");
        context.fillStyle = sunGlow;
        context.beginPath();
        context.arc(sunX, sunY, radius * 2.7, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fff7ce";
        context.shadowColor = rgba(accent, 0.95);
        context.shadowBlur = radius * 0.9;
        context.beginPath();
        context.arc(sunX, sunY, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      if (progress < 0.12) {
        context.save();
        context.globalAlpha = 1 - smoothstep(progress, 0.045, 0.12);
        context.textAlign = "center";
        context.font = `900 ${Math.min(width * 0.15, 180)}px Inter, system-ui, sans-serif`;
        context.fillStyle = "rgba(255,255,255,.025)";
        context.strokeStyle = "rgba(125,249,255,.13)";
        context.lineWidth = 1;
        context.fillText("PORTFOLIO", width / 2, height * 0.68);
        context.strokeText("PORTFOLIO", width / 2, height * 0.68);
        context.restore();
      }

      const flight = flightAt(progress);
      const thrust = clamp(0.35 + warp * 1.2 + Math.abs(velocity) * 4, 0.3, 1.4);
      drawRocket(
        context,
        width * flight.x + smoothPointerX * 9,
        height * flight.y + smoothPointerY * 7,
        (minSize / 720) * flight.scale,
        flight.rotation,
        accent,
        thrust,
      );
    };

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [accent, missions, profileName, role, skills, stars]);

  return <canvas ref={canvasRef} className="ody-scene" aria-hidden />;
}
