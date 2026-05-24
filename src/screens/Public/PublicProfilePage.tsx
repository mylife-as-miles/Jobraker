import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Linkedin,
  Github,
} from "lucide-react";

type PublicProfilePayload = {
  site: {
    slug: string;
    theme: string;
    headline: string | null;
    intro: string | null;
    ctaLabel: string;
    contactEmail: string | null;
    links: Array<{ label: string; url: string }>;
    design: Record<string, unknown>;
    views: number;
    showWatermark?: boolean;
    isPublic?: boolean;
    isPreview?: boolean;
  };
  profile: {
    name: string;
    jobTitle: string | null;
    experienceYears: number;
    location: string | null;
    goals: string[];
    about: string | null;
    email: string | null;
    phone: string | null;
    availability: {
      start: string | null;
      weeklyHours: number | null;
      timezone: string | null;
      weekly: Record<string, Array<{ start: string; end: string }>> | null;
    };
    avatarUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
  };
  experiences: Array<{
    title: string;
    company: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  }>;
  education: Array<{
    degree: string;
    school: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
  }>;
  skills: Array<{
    name: string;
    level: string | null;
    category: string | null;
  }>;
};

const THEMES: Record<string, { accent: string; alt: string; bg: string; text: string }> = {
  obsidian: { accent: "#1dff00", alt: "#9f7aea", bg: "#030403", text: "#f7fff5" },
  atelier: { accent: "#e6c27a", alt: "#78f0ff", bg: "#090806", text: "#fff8ea" },
  prism: { accent: "#76ffea", alt: "#ff6bd6", bg: "#030615", text: "#f5fbff" },
  mono: { accent: "#ffffff", alt: "#a8ff60", bg: "#050505", text: "#f7f7f0" },
};
const DAY_LABELS: Record<string, string> = {
  "0": "Sun",
  "1": "Mon",
  "2": "Tue",
  "3": "Wed",
  "4": "Thu",
  "5": "Fri",
  "6": "Sat",
};

type SpringNode = {
  el: HTMLElement;
  index: number;
  target: number;
  value: number;
  velocity: number;
  revealed: boolean;
};

function readDesignColor(design: Record<string, unknown> | undefined, key: string) {
  const value = design?.[key];
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)
    ? value
    : null;
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  const value = parseInt(cleaned.length === 3
    ? cleaned.split("").map((char) => char + char).join("")
    : cleaned, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function formatYearRange(start?: string | null, end?: string | null, current?: boolean) {
  const startTime = start ? new Date(start) : null;
  const endTime = end ? new Date(end) : null;
  const startYear = startTime && Number.isFinite(startTime.getTime())
    ? startTime.getFullYear()
    : null;
  const endYear = current
    ? "Now"
    : endTime && Number.isFinite(endTime.getTime())
      ? String(endTime.getFullYear())
      : "Recent";
  return [startYear, endYear].filter(Boolean).join(" - ");
}

function formatAvailabilityStart(value?: string | null) {
  if (!value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWeeklyAvailability(weekly: Record<string, Array<{ start: string; end: string }>> | null) {
  if (!weekly) return [];
  return Object.entries(weekly)
    .sort(([a], [b]) => Number(a) - Number(b))
    .flatMap(([day, slots]) =>
      slots.map((slot) => ({
        day: DAY_LABELS[day] || day,
        time: `${slot.start} - ${slot.end}`,
      })),
    );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function edgeResistance(value: number) {
  const abs = Math.abs(value);
  const resisted = 1 - 1 / (abs * 0.9 + 1);
  return Math.sign(value) * resisted;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function usePhysicsReveals(active: boolean, reducedMotion: boolean) {
  useEffect(() => {
    if (!active) return;
    const nodes: SpringNode[] = Array.from(
      document.querySelectorAll<HTMLElement>(".public-profile-reveal"),
    ).map((el, index) => ({
      el,
      index,
      target: 0,
      value: 0,
      velocity: 0,
      revealed: false,
    }));

    if (reducedMotion) {
      nodes.forEach(({ el }) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    nodes.forEach(({ el }) => {
      el.style.opacity = "0";
      el.style.transform = "translate3d(0, 38px, 0) scale(0.982)";
      el.style.willChange = "transform, opacity";
    });

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = clamp((now - last) / 1000, 0.001, 0.032);
      last = now;
      let moving = false;

      for (const node of nodes) {
        const displacement = node.target - node.value;
        const force = displacement * 88;
        const damping = node.velocity * 16;
        node.velocity += (force - damping) * dt;
        node.value += node.velocity * dt;
        const value = clamp(node.value, 0, 1);
        const y = (1 - value) * 38;
        const scale = 0.982 + value * 0.018;

        node.el.style.opacity = String(value);
        node.el.style.transform =
          `translate3d(0, calc(${y}px - var(--lift, 0px)), 0) ` +
          `scale(${scale}) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))`;

        if (Math.abs(displacement) > 0.002 || Math.abs(node.velocity) > 0.002) {
          moving = true;
        }
      }

      frame = moving ? requestAnimationFrame(tick) : 0;
    };

    const ensureTick = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const node = nodes.find((item) => item.el === entry.target);
          if (!node) continue;
          if (entry.isIntersecting) {
            node.revealed = true;
          }
          node.target = node.revealed ? 1 : 0;
        }
        ensureTick();
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.85, 1] },
    );

    nodes.forEach(({ el }) => observer.observe(el));
    ensureTick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      nodes.forEach(({ el }) => {
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
        el.style.removeProperty("will-change");
      });
    };
  }, [active, reducedMotion]);
}

function usePointerResponsiveCards(active: boolean, reducedMotion: boolean) {
  useEffect(() => {
    if (!active || reducedMotion) return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!canHover) return;

    const disposers = Array.from(
      document.querySelectorAll<HTMLElement>(".public-profile-interactive"),
    ).map((el) => {
      let frame = 0;
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      let velocityX = 0;
      let velocityY = 0;
      let last = performance.now();
      let activePointer = false;

      const tick = (now: number) => {
        const dt = clamp((now - last) / 1000, 0.001, 0.032);
        last = now;
        velocityX += ((targetX - currentX) * 95 - velocityX * 18) * dt;
        velocityY += ((targetY - currentY) * 95 - velocityY * 18) * dt;
        currentX += velocityX * dt;
        currentY += velocityY * dt;

        el.style.setProperty("--tilt-x", `${currentY * -4.5}deg`);
        el.style.setProperty("--tilt-y", `${currentX * 5.5}deg`);
        el.style.setProperty("--lift", `${activePointer ? 8 : 0}px`);

        if (
          activePointer ||
          Math.abs(targetX - currentX) > 0.002 ||
          Math.abs(targetY - currentY) > 0.002 ||
          Math.abs(velocityX) > 0.002 ||
          Math.abs(velocityY) > 0.002
        ) {
          frame = requestAnimationFrame(tick);
        } else {
          frame = 0;
        }
      };

      const ensureTick = () => {
        if (!frame) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      };

      const onMove = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        targetX = edgeResistance(x);
        targetY = edgeResistance(y);
        activePointer = true;
        ensureTick();
      };

      const onLeave = () => {
        targetX = 0;
        targetY = 0;
        activePointer = false;
        ensureTick();
      };

      el.style.transformStyle = "preserve-3d";
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
      el.style.setProperty("--lift", "0px");
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("pointercancel", onLeave);

      return () => {
        cancelAnimationFrame(frame);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
        el.removeEventListener("pointercancel", onLeave);
        el.style.removeProperty("--tilt-x");
        el.style.removeProperty("--tilt-y");
        el.style.removeProperty("--lift");
        el.style.removeProperty("transform-style");
      };
    });

    return () => disposers.forEach((dispose) => dispose());
  }, [active, reducedMotion]);
}

function ProfileShaderBackdrop({
  theme,
  reducedMotion,
}: {
  theme: { accent: string; alt: string; bg: string };
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) return;

    const vertex = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragment = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_scroll;
      uniform float u_scroll_velocity;
      uniform vec3 u_accent;
      uniform vec3 u_alt;
      uniform vec3 u_base;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;
        float t = u_time * 0.12 + u_scroll_velocity * 0.035;
        float field = noise(p * 2.0 + vec2(t, -t + u_scroll * 1.8));
        float ring = smoothstep(0.72, 0.0, abs(length(p + vec2(0.24 + u_scroll_velocity * 0.012, -0.08)) - 0.56));
        float beam = smoothstep(0.58, 0.02, abs(p.x * 0.32 + p.y + sin(p.x * 2.4 + t) * 0.18));
        vec3 color = u_base;
        color += u_accent * ring * 0.35;
        color += u_alt * beam * 0.15;
        color += mix(u_accent, u_alt, field) * pow(field, 4.0) * 0.22;
        gl_FragColor = vec4(color, 0.82);
      }
    `;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const program = gl.createProgram();
    const vertexShader = compile(gl.VERTEX_SHADER, vertex);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
    if (!program || !vertexShader || !fragmentShader) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    const scroll = gl.getUniformLocation(program, "u_scroll");
    const scrollVelocity = gl.getUniformLocation(program, "u_scroll_velocity");
    const accent = gl.getUniformLocation(program, "u_accent");
    const alt = gl.getUniformLocation(program, "u_alt");
    const base = gl.getUniformLocation(program, "u_base");
    const accentRgb = hexToRgb(theme.accent);
    const altRgb = hexToRgb(theme.alt);
    const baseRgb = hexToRgb(theme.bg);
    let frame = 0;
    let lastScrollY = window.scrollY;
    let scrollV = 0;
    let lastTime = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const dt = Math.max(16, now - lastTime);
      const rawVelocity = ((window.scrollY - lastScrollY) / dt) * 16.67;
      scrollV += (rawVelocity - scrollV) * 0.18;
      if (reducedMotion) scrollV = 0;
      lastScrollY = window.scrollY;
      lastTime = now;
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, reducedMotion ? 0 : now / 1000);
      gl.uniform1f(scroll, window.scrollY / maxScroll);
      gl.uniform1f(scrollVelocity, clamp(scrollV, -24, 24));
      gl.uniform3f(accent, accentRgb[0], accentRgb[1], accentRgb[2]);
      gl.uniform3f(alt, altRgb[0], altRgb[1], altRgb[2]);
      gl.uniform3f(base, baseRgb[0], baseRgb[1], baseRgb[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion, theme]);

  return <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen opacity-90" aria-hidden="true" />;
}

function PublicProfileWatermark({ theme }: { theme: { accent: string } }) {
  return (
    <Link
      to="/"
      aria-label="Made with JobRaker"
      className="fixed bottom-4 left-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-white/12 bg-black/70 px-4 py-2 text-xs font-semibold text-white/75 shadow-[0_18px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-white/25 hover:text-white sm:bottom-5 sm:left-5"
    >
      <span
        className="h-2 w-2 rounded-full shadow-[0_0_18px_currentColor]"
        style={{ backgroundColor: theme.accent, color: theme.accent }}
      />
      Made with JobRaker
    </Link>
  );
}

export const PublicProfilePage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState<PublicProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setErrorCode(null);
      try {
        const base = import.meta.env.VITE_SUPABASE_URL || "https://yquhsllwrwfvrwolqywh.supabase.co";
        const shouldPreview = searchParams.get("preview") === "1";
        const headers: HeadersInit = {};
        if (shouldPreview) {
          const { createClient } = await import("../../lib/supabaseClient");
          const { data } = await createClient().auth.getSession();
          if (data.session?.access_token) {
            headers.Authorization = `Bearer ${data.session.access_token}`;
          }
        }
        const params = new URLSearchParams({ slug: slug || "" });
        if (shouldPreview) params.set("preview", "1");
        const response = await fetch(`${base}/functions/v1/public-profile-site?${params.toString()}`, {
          headers,
        });
        const data = await response.json();
        if (!response.ok) {
          setErrorCode(typeof data?.code === "string" ? data.code : null);
          throw new Error(data?.error || "Unable to load public profile");
        }
        if (active) setPayload(data);
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load public profile");
      } finally {
        if (active) setLoading(false);
      }
    };
    if (slug) void load();
    return () => {
      active = false;
    };
  }, [searchParams, slug]);

  const theme = useMemo(() => {
    const key = payload?.site.theme || "obsidian";
    const base = THEMES[key] || THEMES.obsidian;
    const designAccent =
      typeof payload?.site.design?.accent === "string"
        ? String(payload.site.design.accent)
        : base.accent;
    return {
      ...base,
      accent: designAccent,
      alt: readDesignColor(payload?.site.design, "alt") || base.alt,
      bg: readDesignColor(payload?.site.design, "background") || base.bg,
      text: readDesignColor(payload?.site.design, "text") || base.text,
    };
  }, [payload]);

  usePhysicsReveals(Boolean(payload), reducedMotion);
  usePointerResponsiveCards(Boolean(payload), reducedMotion);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className={`h-8 w-8 ${reducedMotion ? "" : "animate-spin"}`} />
      </main>
    );
  }

  if (error || !payload) {
    const notPublished = errorCode === "not_published";
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.045] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/25 bg-brand/10 text-brand">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-2xl font-semibold">
            {notPublished ? "This profile is still private" : "Public profile not available"}
          </p>
          <p className="mt-3 text-sm leading-6 text-white/58">
            {notPublished
              ? "The owner needs to publish this portfolio before recruiters can view it."
              : error || "The link may be wrong, unpublished, or no longer active."}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-black hover:bg-brand/90"
          >
            Go to JobRaker
          </Link>
        </div>
      </main>
    );
  }

  const { site, profile, experiences, education, skills } = payload;
  const groupedSkills = skills.reduce<Record<string, typeof skills>>((acc, skill) => {
    const category = skill.category || "Core";
    acc[category] = acc[category] || [];
    acc[category].push(skill);
    return acc;
  }, {});

  const intro =
    site.intro ||
    profile.about ||
    `${profile.name} is a candidate sharing a focused career profile through JobRaker.`;
  const weeklyAvailability = formatWeeklyAvailability(profile.availability?.weekly || null);
  const availabilityStart = formatAvailabilityStart(profile.availability?.start);
  const hasAvailability =
    Boolean(availabilityStart) ||
    Boolean(profile.availability?.weeklyHours) ||
    Boolean(profile.availability?.timezone) ||
    weeklyAvailability.length > 0;
  const contactItems = [
    profile.email
      ? {
          label: profile.email,
          href: `mailto:${profile.email}`,
          icon: Mail,
        }
      : null,
    profile.phone
      ? {
          label: profile.phone,
          href: `tel:${profile.phone.replace(/\s+/g, "")}`,
          icon: Phone,
        }
      : null,
    profile.linkedinUrl
      ? {
          label: "LinkedIn",
          href: profile.linkedinUrl.startsWith('http') ? profile.linkedinUrl : `https://${profile.linkedinUrl}`,
          icon: Linkedin,
        }
      : null,
    profile.githubUrl
      ? {
          label: "GitHub",
          href: profile.githubUrl.startsWith('http') ? profile.githubUrl : `https://${profile.githubUrl}`,
          icon: Github,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: any }>;

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{ backgroundColor: theme.bg, color: theme.text } as CSSProperties}
    >
      <ProfileShaderBackdrop theme={theme} reducedMotion={reducedMotion} />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.08),rgba(0,0,0,0.72)),radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_38%)]" />
      {site.showWatermark !== false ? <PublicProfileWatermark theme={theme} /> : null}
      {site.isPreview ? (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-brand/30 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand backdrop-blur-xl">
          Private preview
        </div>
      ) : null}

      <section className="relative z-10 mx-auto flex min-h-screen max-w-[96rem] items-end px-4 pb-16 pt-20 sm:px-6 lg:pb-24">
        <div className="grid w-full gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.78fr)] xl:items-end">
          <div className="min-w-0 xl:-translate-y-10">
            <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-white/60">
              {profile.location ? (
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" style={{ color: theme.accent }} />
                  {profile.location}
                </span>
              ) : null}
              {profile.experienceYears ? (
                <span>{profile.experienceYears}+ years of focused experience</span>
              ) : null}
            </div>
            <h1 className="max-w-[58rem] text-[clamp(4rem,10vw,10.5rem)] font-black uppercase leading-[0.84] tracking-normal">
              {profile.name.split(/\s+/).filter(Boolean).map((part) => (
                <span key={part} className="block whitespace-nowrap">
                  {part}
                </span>
              ))}
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/72 sm:text-2xl">
              {site.headline || profile.jobTitle}
            </p>
          </div>

          <div className="public-profile-reveal public-profile-interactive min-w-0 rounded-[2rem] border border-white/12 bg-white/[0.055] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7 xl:max-w-xl xl:justify-self-end">
            <div className="mb-8 flex items-start gap-4">
              <div
                className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white/10 text-3xl font-black text-black"
                style={{ backgroundColor: theme.accent }}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
                ) : (
                  profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2)
                )}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-white/45">Portfolio signal</p>
                <p className="mt-2 text-2xl font-semibold leading-tight">{profile.jobTitle || "Candidate profile"}</p>
              </div>
            </div>
            <p className="text-base leading-8 text-white/72">{intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {profile.goals.slice(0, 3).map((goal) => (
                <span key={goal} className="rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-xs text-white/72">
                  {goal}
                </span>
              ))}
            </div>
            {contactItems.length > 0 || site.links.length > 0 ? (
              <div className="mt-8 grid gap-2">
                {contactItems.map((item) => {
                  const Icon = item.icon;
                  const isHttp = item.href.startsWith("http");
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target={isHttp ? "_blank" : undefined}
                      rel={isHttp ? "noopener noreferrer" : undefined}
                      className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/72 hover:border-white/25 hover:text-white"
                    >
                      <Icon className="h-4 w-4" style={{ color: theme.accent }} />
                      <span className="break-all">{item.label}</span>
                    </a>
                  );
                })}
                {site.links.slice(0, 3).map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/72 hover:border-white/25 hover:text-white"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight className="h-4 w-4" style={{ color: theme.accent }} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-8 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 sm:grid-cols-4 sm:px-8">
          {[
            ["Roles", experiences.length],
            ["Skills", skills.length],
            ["Education", education.length],
            ["Profile views", site.views],
          ].map(([label, value]) => (
            <div key={label} className="public-profile-reveal">
              <p className="text-4xl font-black" style={{ color: theme.accent }}>{value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/45">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {hasAvailability ? (
        <section className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="public-profile-reveal public-profile-interactive rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
                  <CalendarDays className="h-4 w-4" />
                  Availability
                </p>
                <h2 className="text-4xl font-black uppercase tracking-normal sm:text-6xl">Ready window</h2>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {availabilityStart ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/40">Start</p>
                      <p className="mt-2 text-lg font-semibold">{availabilityStart}</p>
                    </div>
                  ) : null}
                  {profile.availability?.weeklyHours ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/40">Weekly load</p>
                      <p className="mt-2 text-lg font-semibold">{profile.availability.weeklyHours} hrs/week</p>
                    </div>
                  ) : null}
                  {profile.availability?.timezone ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/40">Timezone</p>
                      <p className="mt-2 text-lg font-semibold">{profile.availability.timezone}</p>
                    </div>
                  ) : null}
                </div>
                {weeklyAvailability.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
                      <Clock3 className="h-4 w-4" />
                      Working hours
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {weeklyAvailability.map((slot) => (
                        <span
                          key={`${slot.day}-${slot.time}`}
                          className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/72"
                        >
                          {slot.day} {slot.time}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section id="work" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
              <BriefcaseBusiness className="h-4 w-4" />
              Experience
            </p>
            <h2 className="text-4xl font-black uppercase tracking-normal sm:text-6xl">Selected work</h2>
          </div>
        </div>
        <div className="grid gap-4">
          {experiences.length > 0 ? experiences.map((item, index) => (
            <article
              key={`${item.company}-${item.title}-${index}`}
              className="public-profile-reveal public-profile-interactive group grid gap-5 rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl hover:border-white/20 sm:grid-cols-[0.28fr_0.72fr] sm:p-7"
            >
              <div>
                <p className="text-sm text-white/45">{formatYearRange(item.start_date, item.end_date, item.is_current)}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
                  {item.location || "Remote-ready"}
                </p>
              </div>
              <div>
                <h3 className="text-2xl font-semibold leading-tight">{item.title}</h3>
                <p className="mt-1 text-white/55">{item.company}</p>
                {item.description ? (
                  <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/68">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </article>
          )) : (
            <div className="public-profile-reveal rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-7 text-white/62 backdrop-blur-xl">
              Experience details are being curated for this profile.
            </div>
          )}
        </div>
      </section>

      <section id="skills" className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="public-profile-reveal">
          <p className="mb-3 inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
            <Sparkles className="h-4 w-4" />
            Capability map
          </p>
          <h2 className="text-4xl font-black uppercase tracking-normal sm:text-6xl">Skills with signal</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(groupedSkills).length > 0 ? Object.entries(groupedSkills).map(([category, items]) => (
            <div key={category} className="public-profile-reveal public-profile-interactive rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-white/45">{category}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((skill) => (
                  <span key={`${category}-${skill.name}`} className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75">
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )) : (
            <div className="public-profile-reveal rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 text-white/62 backdrop-blur-xl">
              Skills will appear here once the profile is enriched.
            </div>
          )}
        </div>
      </section>

      {education.length > 0 ? (
        <section className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="public-profile-reveal public-profile-interactive rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
            <p className="mb-6 inline-flex items-center gap-2 text-sm uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
              <GraduationCap className="h-4 w-4" />
              Education
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {education.map((item, index) => (
                <div key={`${item.school}-${index}`} className="border-t border-white/10 pt-5">
                  <h3 className="text-xl font-semibold">{item.degree}</h3>
                  <p className="mt-1 text-white/60">{item.school}</p>
                  <p className="mt-3 text-sm text-white/40">{formatYearRange(item.start_date, item.end_date)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section id="contact" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="public-profile-reveal public-profile-interactive overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.06] p-8 backdrop-blur-2xl sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="mb-4 text-sm uppercase tracking-[0.22em]" style={{ color: theme.accent }}>Open to the right conversation</p>
              <h2 className="max-w-4xl text-4xl font-black uppercase leading-none tracking-normal sm:text-7xl">
                Bring this profile into your hiring loop.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {site.contactEmail ? (
                <a href={`mailto:${site.contactEmail}`}>
                  <button className="inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-black active:scale-[0.98]" style={{ backgroundColor: theme.accent }}>
                    <Mail className="mr-2 h-4 w-4" />
                    {site.ctaLabel || "Contact"}
                  </button>
                </a>
              ) : null}
              {site.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center rounded-full border border-white/12 px-5 text-sm text-white/75 hover:border-white/30 hover:text-white"
                >
                  {link.label}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};
