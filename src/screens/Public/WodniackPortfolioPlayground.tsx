import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, Github, Linkedin, Mail, Phone, Sparkles } from "lucide-react";
import type { EditorialPortfolioProps } from "./EditorialPortfolioTemplate";
import { FourPointStar, normalizeUrl } from "./WodniackPortfolioCore";

type Artifact = {
  label: string;
  kind: "skill" | "goal" | "education" | "portrait" | "location";
  x: number;
  y: number;
  rotate: number;
  depth: number;
};

const LAYOUT_FIXES = `
  .wdk-way {
    min-height: max(56rem, 125svh);
  }

  .wdk-way-copy {
    padding-top: clamp(5rem, 8vw, 8rem);
    padding-bottom: clamp(8rem, 12vw, 12rem);
  }

  .wdk-way-copy h2 {
    display: grid;
    width: min(62vw, 56rem);
    max-width: 7.2ch;
    gap: 0.035em;
    font-size: clamp(5rem, 10.75vw, 11.5rem);
    line-height: 0.82;
    letter-spacing: -0.055em;
    text-wrap: balance;
  }

  .wdk-way-copy h2 span {
    display: block;
    white-space: nowrap;
  }

  .wdk-way-copy p {
    position: relative;
    z-index: 35;
    width: min(28rem, 36vw);
    margin-top: 2.25rem;
    margin-right: 1.5rem;
    padding: 0.8rem 1rem;
    background: color-mix(in srgb, var(--wdk-red) 78%, transparent);
    backdrop-filter: blur(5px);
  }

  .wdk-artifacts {
    pointer-events: none;
  }

  .wdk-artifact {
    max-width: 13rem;
  }

  .wdk-contact-inner {
    grid-template-columns: minmax(18rem, 0.82fr) minmax(0, 1.18fr);
    gap: clamp(2rem, 4vw, 4rem);
  }

  .wdk-contact-button {
    width: min(31vw, 29rem);
  }

  .wdk-contact-copy {
    min-width: 0;
  }

  .wdk-contact-copy h2 {
    max-width: 9ch;
    font-size: clamp(4rem, 6.4vw, 7.25rem);
    line-height: 0.88;
    letter-spacing: -0.045em;
    overflow-wrap: normal;
    word-break: normal;
    text-wrap: balance;
  }

  @media (max-width: 1024px) {
    .wdk-way-copy h2 {
      width: min(80vw, 48rem);
      font-size: clamp(5rem, 14vw, 9rem);
    }

    .wdk-way-copy p {
      width: min(30rem, 55vw);
      margin-right: 0;
    }

    .wdk-contact-inner {
      grid-template-columns: 1fr;
      gap: 3rem;
    }

    .wdk-contact-button {
      width: min(64vw, 28rem);
    }

    .wdk-contact-copy h2 {
      max-width: 10ch;
      margin-inline: auto;
      font-size: clamp(4rem, 10vw, 7rem);
    }
  }

  @media (max-width: 720px) {
    .wdk-way {
      min-height: 112svh;
    }

    .wdk-way-copy {
      padding-top: 5rem;
      padding-bottom: 7rem;
    }

    .wdk-way-copy h2 {
      width: 100%;
      max-width: 7ch;
      font-size: clamp(4rem, 19vw, 7rem);
      line-height: 0.84;
    }

    .wdk-way-copy p {
      width: auto;
      max-width: 24rem;
      margin-top: 2rem;
      margin-left: 0;
      padding: 0.75rem 0;
      background: transparent;
      backdrop-filter: none;
    }

    .wdk-contact-inner {
      gap: 2.5rem;
    }

    .wdk-contact-button {
      width: min(78vw, 24rem);
    }

    .wdk-contact-copy h2 {
      max-width: 9ch;
      font-size: clamp(3.5rem, 15vw, 5.8rem);
      line-height: 0.9;
    }
  }
`;

export function PlayfulArtifacts({
  profile,
  skills,
  education,
}: Pick<EditorialPortfolioProps, "profile" | "skills" | "education">) {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const artifacts = useMemo<Artifact[]>(() => {
    const raw: Artifact[] = [];
    skills.slice(0, 5).forEach((skill, index) => {
      raw.push({
        label: skill.name,
        kind: "skill",
        x: [5, 70, 15, 84, 71][index] ?? 71,
        y: [12, 9, 78, 72, 38][index] ?? 38,
        rotate: [-9, 7, 5, -6, 3][index] ?? 0,
        depth: [0.32, 0.52, 0.42, 0.28, 0.58][index] ?? 0.4,
      });
    });
    profile.goals.slice(0, 3).forEach((goal, index) => {
      raw.push({
        label: goal,
        kind: "goal",
        x: [5, 65, 84][index] ?? 84,
        y: [55, 58, 24][index] ?? 24,
        rotate: [4, -7, 9][index] ?? 0,
        depth: [0.65, 0.4, 0.48][index] ?? 0.5,
      });
    });
    if (education[0]) {
      raw.push({ label: education[0].school, kind: "education", x: 28, y: 8, rotate: -4, depth: 0.36 });
    }
    raw.push({ label: profile.location || "Remote-ready", kind: "location", x: 50, y: 88, rotate: 5, depth: 0.55 });
    if (profile.avatarUrl) {
      raw.push({ label: profile.avatarUrl, kind: "portrait", x: 86, y: 44, rotate: 8, depth: 0.7 });
    }
    return raw.slice(0, 11);
  }, [education, profile.avatarUrl, profile.goals, profile.location, skills]);

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 44;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 44;
    setPointer({ x, y });
  };

  return (
    <section className="wdk-way" onPointerMove={onPointerMove} onPointerLeave={() => setPointer({ x: 0, y: 0 })}>
      <style>{LAYOUT_FIXES}</style>
      <div className="wdk-way-lines" aria-hidden />
      <div className="wdk-way-smiley" aria-hidden>
        <span className="wdk-way-eye wdk-way-eye-left" />
        <span className="wdk-way-eye wdk-way-eye-right" />
        <span className="wdk-way-mouth" />
      </div>

      <div className="wdk-way-copy">
        <span>Playground / process / personality</span>
        <h2><span>Do things</span><span>your way.</span></h2>
        <p>Move across the scene. The objects react, just like the source portfolio’s playful creative laboratory.</p>
      </div>

      <div className="wdk-artifacts" aria-hidden>
        {artifacts.map((artifact, index) => {
          const x = pointer.x * artifact.depth;
          const y = pointer.y * artifact.depth;
          const style = {
            left: `${artifact.x}%`,
            top: `${artifact.y}%`,
            transform: `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) rotate(${artifact.rotate}deg)`,
            zIndex: Math.round(10 + artifact.depth * 10),
            "--delay": `${index * -0.7}s`,
          } as CSSProperties;
          return (
            <div key={`${artifact.kind}-${artifact.label}-${index}`} className={`wdk-artifact wdk-artifact-${artifact.kind}`} style={style}>
              {artifact.kind === "portrait" ? (
                <img src={artifact.label} alt="" />
              ) : (
                <>
                  <span className="wdk-artifact-index">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{artifact.label}</strong>
                </>
              )}
            </div>
          );
        })}
        {Array.from({ length: 6 }).map((_, index) => (
          <FourPointStar
            key={index}
            className="wdk-floating-star"
          />
        ))}
      </div>
    </section>
  );
}

export function ContactItems({ site, profile }: Pick<EditorialPortfolioProps, "site" | "profile">) {
  const contacts = [
    profile.email ? { label: profile.email, href: `mailto:${profile.email}`, icon: Mail } : null,
    profile.phone ? { label: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, "")}`, icon: Phone } : null,
    profile.linkedinUrl ? { label: "LinkedIn", href: normalizeUrl(profile.linkedinUrl), icon: Linkedin } : null,
    profile.githubUrl ? { label: "GitHub", href: normalizeUrl(profile.githubUrl), icon: Github } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;

  return (
    <div className="wdk-contact-links">
      {contacts.map((item) => {
        const Icon = item.icon;
        const external = item.href.startsWith("http");
        return (
          <a key={item.href} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        );
      })}
      {site.links.slice(0, 4).map((link) => (
        <a key={link.url} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer">
          <Sparkles className="h-4 w-4" />
          <span>{link.label}</span>
          <ArrowUpRight className="h-4 w-4" />
        </a>
      ))}
    </div>
  );
}
