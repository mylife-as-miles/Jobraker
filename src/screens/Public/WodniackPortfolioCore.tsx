import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { EditorialPortfolioProps } from "./EditorialPortfolioTemplate";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeUrl(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function yearRange(start?: string | null, end?: string | null, current?: boolean) {
  const startYear = start && Number.isFinite(new Date(start).getTime())
    ? new Date(start).getFullYear()
    : null;
  const endYear = current
    ? "Now"
    : end && Number.isFinite(new Date(end).getTime())
      ? new Date(end).getFullYear()
      : "Recent";
  return [startYear, endYear].filter(Boolean).join(" — ");
}

export function splitTitle(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["Creative", "Professional"];
  if (words.length === 1) return [words[0], "Portfolio"];
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(" "), words.slice(middle).join(" ")];
}

export function chunkName(value: string) {
  const compact = value.replace(/\s+/g, "");
  const chunks: string[] = [];
  for (let index = 0; index < compact.length; index += 2) {
    chunks.push(compact.slice(index, index + 2));
  }
  return chunks.length ? chunks : ["JO", "BR", "AK", "ER"];
}

export function KineticWord({ value }: { value: string }) {
  return (
    <span className="wdk-word" aria-label={value}>
      {Array.from(value).map((character, index) => (
        <span
          key={`${character}-${index}`}
          className={`wdk-char ${character === " " ? "wdk-char-space" : ""}`}
          style={{ "--i": index } as CSSProperties}
          aria-hidden
        >
          {character === " " ? (
            "\u00a0"
          ) : (
            <span className="wdk-char-track">
              <span>{character}</span>
              <span>{character}</span>
              <span>{character}</span>
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function FourPointStar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M50 0 57 43 100 50 57 57 50 100 43 57 0 50 43 43 50 0Z" fill="currentColor" />
    </svg>
  );
}

type WorkStageProps = {
  experiences: EditorialPortfolioProps["experiences"];
  accent: string;
};

export function WorkStage({ experiences, accent }: WorkStageProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const entries = experiences.length
    ? experiences
    : [
        {
          title: "Your next role",
          company: "Opportunity in progress",
          location: "Remote-ready",
          start_date: "",
          end_date: null,
          is_current: true,
          description: "Experience entries will animate through this stage as the profile is completed.",
        },
      ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      const next = clamp(-rect.top / scrollable, 0, 1);
      setProgress((current) => (Math.abs(current - next) > 0.002 ? next : current));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const height = `${Math.max(4, entries.length) * 78}vh`;
  const active = progress * Math.max(1, entries.length - 1);

  return (
    <section id="work" ref={sectionRef} className="wdk-work" style={{ height }}>
      <div className="wdk-work-sticky">
        <div className="wdk-work-grid" aria-hidden />
        <div className="wdk-work-title" aria-hidden>
          {Array.from("WORK").map((letter, index) => (
            <span key={letter} style={{ "--i": index } as CSSProperties}>{letter}</span>
          ))}
        </div>

        <div className="wdk-work-counter">
          <span>{String(Math.min(entries.length, Math.round(active) + 1)).padStart(2, "0")}</span>
          <span>/</span>
          <span>{String(entries.length).padStart(2, "0")}</span>
        </div>

        <div className="wdk-work-stage">
          {entries.map((entry, index) => {
            const offset = index - active;
            const distance = Math.abs(offset);
            const opacity = clamp(1 - distance * 0.66, 0, 1);
            const scale = clamp(1 - distance * 0.14, 0.68, 1);
            const x = offset * 68;
            const y = Math.sin(index * 1.77) * 8 + distance * 10;
            const rotate = offset * 7 + (index % 2 === 0 ? -2.5 : 2.5);
            const palette = index % 3;
            const cardStyle = {
              opacity,
              zIndex: Math.round(100 - distance * 10),
              transform: `translate3d(${x}vw, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
              pointerEvents: distance < 0.65 ? "auto" : "none",
              "--work-accent": accent,
            } as CSSProperties;

            return (
              <article
                key={`${entry.company}-${entry.title}-${index}`}
                className={`wdk-work-card wdk-work-card-${palette}`}
                style={cardStyle}
              >
                <div className="wdk-work-card-visual" aria-hidden>
                  <span className="wdk-work-card-number">{String(index + 1).padStart(4, "0")}</span>
                  <div className="wdk-work-card-orbit" />
                  <div className="wdk-work-card-mark">{initials(entry.company)}</div>
                  <FourPointStar className="wdk-work-card-star" />
                </div>
                <div className="wdk-work-card-copy">
                  <p>{yearRange(entry.start_date, entry.end_date, entry.is_current)}</p>
                  <h3>{entry.title}</h3>
                  <div className="wdk-work-card-meta">
                    <span>{entry.company}</span>
                    <span>{entry.location || "Remote"}</span>
                  </div>
                  {entry.description ? <p className="wdk-work-description">{entry.description}</p> : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="wdk-work-ruler" aria-hidden>
          <span style={{ height: `${Math.max(2, progress * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}
