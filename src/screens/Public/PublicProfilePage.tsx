import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
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
  };
  profile: {
    name: string;
    jobTitle: string | null;
    experienceYears: number;
    location: string | null;
    goals: string[];
    about: string | null;
    avatarUrl: string | null;
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

function ProfileShaderBackdrop({ theme }: { theme: { accent: string; alt: string; bg: string } }) {
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
        float t = u_time * 0.12;
        float field = noise(p * 2.0 + vec2(t, -t + u_scroll * 1.8));
        float ring = smoothstep(0.72, 0.0, abs(length(p + vec2(0.24, -0.08)) - 0.56));
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
    const accent = gl.getUniformLocation(program, "u_accent");
    const alt = gl.getUniformLocation(program, "u_alt");
    const base = gl.getUniformLocation(program, "u_base");
    const accentRgb = hexToRgb(theme.accent);
    const altRgb = hexToRgb(theme.alt);
    const baseRgb = hexToRgb(theme.bg);
    let frame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, now / 1000);
      gl.uniform1f(scroll, window.scrollY / maxScroll);
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
  }, [theme]);

  return <canvas ref={canvasRef} className="fixed inset-0 h-screen w-screen opacity-90" aria-hidden="true" />;
}

export const PublicProfilePage = () => {
  const { slug } = useParams();
  const [payload, setPayload] = useState<PublicProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const base = import.meta.env.VITE_SUPABASE_URL || "https://yquhsllwrwfvrwolqywh.supabase.co";
        const response = await fetch(`${base}/functions/v1/public-profile-site?slug=${encodeURIComponent(slug || "")}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load public profile");
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
  }, [slug]);

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

  useEffect(() => {
    if (!payload) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".public-profile-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 42, filter: "blur(10px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 82%",
            },
          },
        );
      });
    });
    return () => ctx.revert();
  }, [payload]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-xl font-semibold">{error || "Public profile not found"}</p>
        <Link to="/" className="text-sm text-brand hover:underline">
          Go to JobRaker
        </Link>
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

  return (
    <main
      className="relative min-h-screen overflow-hidden text-white"
      style={{ backgroundColor: theme.bg, color: theme.text } as CSSProperties}
    >
      <ProfileShaderBackdrop theme={theme} />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.08),rgba(0,0,0,0.72)),radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_38%)]" />

      <header className="fixed left-0 right-0 top-0 z-30 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="text-sm font-semibold tracking-tight text-white">
            JobRaker
          </Link>
          <div className="hidden items-center gap-5 text-xs uppercase tracking-[0.2em] text-white/50 sm:flex">
            <a href="#work" className="transition hover:text-white">Work</a>
            <a href="#skills" className="transition hover:text-white">Skills</a>
            <a href="#contact" className="transition hover:text-white">Contact</a>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-end px-5 pb-16 pt-28 sm:px-8 lg:pb-24">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
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
            <h1 className="max-w-5xl text-[clamp(4rem,13vw,11.5rem)] font-black uppercase leading-[0.82] tracking-normal">
              {profile.name}
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-relaxed text-white/72 sm:text-2xl">
              {site.headline || profile.jobTitle}
            </p>
          </div>

          <div className="public-profile-reveal rounded-[2rem] border border-white/12 bg-white/[0.055] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7">
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
              className="public-profile-reveal group grid gap-5 rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl transition duration-300 hover:border-white/20 sm:grid-cols-[0.28fr_0.72fr] sm:p-7"
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
            <div key={category} className="public-profile-reveal rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
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
          <div className="public-profile-reveal rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-8">
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
        <div className="public-profile-reveal overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.06] p-8 backdrop-blur-2xl sm:p-12">
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
                  <button className="inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-black transition active:scale-[0.98]" style={{ backgroundColor: theme.accent }}>
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
                  className="inline-flex h-12 items-center rounded-full border border-white/12 px-5 text-sm text-white/75 transition hover:border-white/30 hover:text-white"
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
