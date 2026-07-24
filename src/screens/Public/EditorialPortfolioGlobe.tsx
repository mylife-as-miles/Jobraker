import { useEffect, useMemo, useRef } from "react";

type Destination = {
  label: string;
  location: string | null;
};

type EditorialPortfolioGlobeProps = {
  home: string | null;
  destinations: Destination[];
  accent: string;
};

type Coordinate = [number, number];
type Vector3 = [number, number, number];

const KNOWN_LOCATIONS: Array<[string[], Coordinate]> = [
  [["enugu", "nsukka"], [6.45, 7.5]],
  [["lagos"], [6.52, 3.38]],
  [["abuja"], [9.08, 7.4]],
  [["nigeria"], [9.08, 8.68]],
  [["ghana", "accra"], [5.56, -0.2]],
  [["kenya", "nairobi"], [-1.29, 36.82]],
  [["south africa", "cape town"], [-33.92, 18.42]],
  [["london", "united kingdom", "uk"], [51.51, -0.13]],
  [["paris", "france"], [48.86, 2.35]],
  [["berlin", "germany"], [52.52, 13.41]],
  [["amsterdam", "netherlands"], [52.37, 4.9]],
  [["new york"], [40.71, -74.01]],
  [["san francisco", "california"], [37.77, -122.42]],
  [["united states", "usa", "u.s."], [38.91, -77.04]],
  [["canada", "toronto"], [43.65, -79.38]],
  [["india", "delhi"], [28.61, 77.21]],
  [["singapore"], [1.35, 103.82]],
  [["tokyo", "japan"], [35.68, 139.69]],
  [["sydney", "australia"], [-33.87, 151.21]],
  [["brazil", "sao paulo"], [-23.55, -46.63]],
  [["dubai", "uae", "united arab emirates"], [25.2, 55.27]],
];

const CONTINENT_MASKS: Array<[number, number, number, number]> = [
  [48, -105, 28, 52],
  [19, -92, 17, 23],
  [-15, -60, 38, 22],
  [8, 20, 38, 28],
  [51, 15, 18, 30],
  [39, 85, 35, 72],
  [-25, 135, 18, 25],
  [65, -40, 13, 20],
  [36, 139, 12, 16],
];

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeLongitude(value: number) {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function coordinateFor(value: string | null, seed: string): Coordinate {
  const normalized = value?.trim().toLowerCase() || "";
  const known = KNOWN_LOCATIONS.find(([tokens]) =>
    tokens.some((token) => normalized.includes(token)),
  );
  if (known) return known[1];

  const hash = hashString(`${normalized}:${seed}`);
  const latitude = -48 + (hash % 9600) / 100;
  const longitude = -170 + ((Math.floor(hash / 97) % 34000) / 100);
  return [Math.max(-58, Math.min(70, latitude)), normalizeLongitude(longitude)];
}

function longitudeDistance(a: number, b: number) {
  return Math.abs(normalizeLongitude(a - b));
}

function isLand(latitude: number, longitude: number) {
  const inside = CONTINENT_MASKS.some(([centerLat, centerLon, radiusLat, radiusLon]) => {
    const latDistance = (latitude - centerLat) / radiusLat;
    const lonDistance = longitudeDistance(longitude, centerLon) / radiusLon;
    return latDistance * latDistance + lonDistance * lonDistance <= 1;
  });
  if (!inside) return false;
  return hashString(`${latitude}:${longitude}`) % 100 > 17;
}

const LAND_POINTS: Coordinate[] = (() => {
  const points: Coordinate[] = [];
  for (let latitude = -58; latitude <= 76; latitude += 3.6) {
    for (let longitude = -180; longitude < 180; longitude += 4.2) {
      if (isLand(latitude, longitude)) points.push([latitude, longitude]);
    }
  }
  return points;
})();

function toVector([latitude, longitude]: Coordinate): Vector3 {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.cos(lon),
  ];
}

function rotateY([x, y, z]: Vector3, angle: number): Vector3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

function normalize([x, y, z]: Vector3): Vector3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function slerp(a: Vector3, b: Vector3, amount: number): Vector3 {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  if (angle < 0.001) return a;
  const sinAngle = Math.sin(angle);
  const left = Math.sin((1 - amount) * angle) / sinAngle;
  const right = Math.sin(amount * angle) / sinAngle;
  return normalize([
    a[0] * left + b[0] * right,
    a[1] * left + b[1] * right,
    a[2] * left + b[2] * right,
  ]);
}

function rgbaFromHex(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized.slice(0, 6);
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number)) return `rgba(180,83,47,${alpha})`;
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

export function EditorialPortfolioGlobe({
  home,
  destinations,
  accent,
}: EditorialPortfolioGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const homeCoordinate = useMemo(() => coordinateFor(home, "home"), [home]);
  const plottedDestinations = useMemo(() => {
    const unique = new Map<string, { label: string; coordinate: Coordinate }>();
    destinations.slice(0, 8).forEach((destination, index) => {
      const key = `${destination.label}:${destination.location || "remote"}`;
      if (!unique.has(key)) {
        unique.set(key, {
          label: destination.label,
          coordinate: coordinateFor(destination.location, `${destination.label}:${index}`),
        });
      }
    });
    return Array.from(unique.values()).slice(0, 6);
  }, [destinations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let rotation = -(homeCoordinate[1] * Math.PI) / 180;
    let velocity = 0;
    let dragging = false;
    let pointerX = 0;
    let previousPointerX = 0;
    let frame = 0;
    let visible = true;

    const resize = () => {
      width = parent.clientWidth;
      height = parent.clientHeight || width;
      canvas.width = Math.max(1, Math.floor(width * devicePixelRatio));
      canvas.height = Math.max(1, Math.floor(height * devicePixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const project = (vector: Vector3, radius: number, centerX: number, centerY: number) => ({
      x: centerX + vector[0] * radius,
      y: centerY - vector[1] * radius,
      z: vector[2],
    });

    const drawLabel = (label: string, x: number, y: number, isHome = false) => {
      const text = label.length > 18 ? `${label.slice(0, 17)}…` : label;
      context.save();
      context.font = `${isHome ? "600" : "500"} 9px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const textWidth = context.measureText(text).width;
      const boxWidth = textWidth + 14;
      const boxHeight = 21;
      const left = Math.min(width - boxWidth - 4, Math.max(4, x + 8));
      const top = Math.min(height - boxHeight - 4, Math.max(4, y - boxHeight / 2));
      context.shadowColor = "rgba(36,31,26,.16)";
      context.shadowBlur = 9;
      context.shadowOffsetY = 3;
      context.fillStyle = "rgba(249,245,237,.95)";
      context.fillRect(left, top, boxWidth, boxHeight);
      context.shadowColor = "transparent";
      context.strokeStyle = "rgba(36,31,26,.11)";
      context.strokeRect(left + 0.5, top + 0.5, boxWidth - 1, boxHeight - 1);
      context.fillStyle = isHome ? rgbaFromHex(accent, 1) : "rgba(36,31,26,.78)";
      context.fillText(text, left + 7, top + 14);
      context.restore();
    };

    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!visible) return;
      if (!dragging && !reducedMotion) {
        rotation += 0.0018 + velocity;
        velocity *= 0.94;
      }

      context.clearRect(0, 0, width, height);
      const size = Math.min(width, height);
      const radius = size * 0.39;
      const centerX = width / 2;
      const centerY = height / 2;

      const glow = context.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.35,
        radius * 0.05,
        centerX,
        centerY,
        radius * 1.12,
      );
      glow.addColorStop(0, "rgba(255,255,255,.95)");
      glow.addColorStop(0.66, "rgba(246,240,229,.82)");
      glow.addColorStop(1, "rgba(180,83,47,.04)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.02, 0, Math.PI * 2);
      context.fill();

      for (const destination of plottedDestinations) {
        const start = toVector(homeCoordinate);
        const end = toVector(destination.coordinate);
        context.beginPath();
        let hasPoint = false;
        for (let step = 0; step <= 42; step += 1) {
          const amount = step / 42;
          const elevation = 1 + Math.sin(amount * Math.PI) * 0.17;
          const rotated = rotateY(slerp(start, end, amount), rotation);
          const projected = project(
            [rotated[0] * elevation, rotated[1] * elevation, rotated[2] * elevation],
            radius,
            centerX,
            centerY,
          );
          if (projected.z < -0.2) {
            hasPoint = false;
            continue;
          }
          if (!hasPoint) {
            context.moveTo(projected.x, projected.y);
            hasPoint = true;
          } else {
            context.lineTo(projected.x, projected.y);
          }
        }
        context.strokeStyle = rgbaFromHex(accent, 0.38);
        context.lineWidth = 1.15;
        context.stroke();
      }

      for (const point of LAND_POINTS) {
        const vector = rotateY(toVector(point), rotation);
        if (vector[2] < -0.08) continue;
        const projected = project(vector, radius, centerX, centerY);
        const depth = Math.max(0, Math.min(1, (vector[2] + 0.08) / 1.08));
        context.fillStyle = `rgba(36,31,26,${0.09 + depth * 0.5})`;
        context.beginPath();
        context.arc(projected.x, projected.y, 0.75 + depth * 0.65, 0, Math.PI * 2);
        context.fill();
      }

      const homePoint = project(rotateY(toVector(homeCoordinate), rotation), radius, centerX, centerY);
      if (homePoint.z > 0) {
        context.fillStyle = rgbaFromHex(accent, 1);
        context.beginPath();
        context.arc(homePoint.x, homePoint.y, 4.2, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = rgbaFromHex(accent, 0.28);
        context.lineWidth = 7;
        context.stroke();
        if (homePoint.z > 0.35) drawLabel(home || "Home base", homePoint.x, homePoint.y, true);
      }

      plottedDestinations.forEach((destination) => {
        const point = project(rotateY(toVector(destination.coordinate), rotation), radius, centerX, centerY);
        if (point.z <= 0) return;
        context.fillStyle = "rgba(36,31,26,.88)";
        context.beginPath();
        context.arc(point.x, point.y, 3.1, 0, Math.PI * 2);
        context.fill();
        if (point.z > 0.5) drawLabel(destination.label, point.x, point.y);
      });

      context.strokeStyle = "rgba(36,31,26,.13)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.stroke();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerX = event.clientX;
      previousPointerX = event.clientX;
      velocity = 0;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = event.clientX - pointerX;
      rotation += delta / 190;
      velocity = (event.clientX - previousPointerX) / 2800;
      previousPointerX = event.clientX;
      pointerX = event.clientX;
    };
    const onPointerUp = () => {
      dragging = false;
      canvas.style.cursor = "grab";
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
      },
      { rootMargin: "100px", threshold: 0 },
    );

    resize();
    resizeObserver.observe(parent);
    intersectionObserver.observe(parent);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [accent, home, homeCoordinate, plottedDestinations]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      role="img"
      aria-label="Interactive globe showing the candidate's work connections. Drag to rotate."
    />
  );
}
