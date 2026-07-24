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
        x: [9, 68, 21, 76, 45][index] ?? 45,
        y: [14, 9, 67, 70, 35][index] ?? 45,
        rotate: [-9, 7, 5, -6, 3][index] ?? 0,
        depth: [0.32, 0.52, 0.42, 0.28, 0.58][index] ?? 0.4,
      });
    });
    profile.goals.slice(0, 3).forEach((goal, index) => {
      raw.push({
        label: goal,
        kind: "goal",
        x: [7, 61, 73][index] ?? 50,
        y: [43, 46, 24][index] ?? 50,
        rotate: [4, -7, 9][index] ?? 0,
        depth: [0.65, 0.4, 0.48][index] ?? 0.5,
      });
    });
    if (education[0]) {
      raw.push({ label: education[0].school, kind: "education", x: 24, y: 25, rotate: -4, depth: 0.36 });
    }
    raw.push({ label: profile.location || "Remote-ready", kind: "location", x: 48, y: 78, rotate: 5, depth: 0.55 });
    if (profile.avatarUrl) {
      raw.push({ label: profile.avatarUrl, kind: "portrait", x: 84, y: 49, rotate: 8, depth: 0.7 });
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
      <div className="wdk-way-lines" aria-hidden />
      <div className="wdk-way-smiley" aria-hidden>
        <span className="wdk-way-eye wdk-way-eye-left" />
        <span className="wdk-way-eye wdk-way-eye-right" />
        <span className="wdk-way-mouth" />
      </div>

      <div className="wdk-way-copy">
        <span>Playground / process / personality</span>
        <h2>Do things<br />your way.</h2>
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
