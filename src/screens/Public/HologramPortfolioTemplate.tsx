import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDot,
  Github,
  Linkedin,
  Mail,
  MapPin,
  Pause,
  Phone,
  Play,
  ScanLine,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { EditorialPortfolioProps } from "./EditorialPortfolioTemplate";
import { HologramLabScene } from "./HologramLabScene";
import "./HologramPortfolioTemplate.css";

const SOURCE_REPOSITORY = "https://github.com/davidhckh/portfolio-2025";

function normalizeUrl(value: string) {
  return value.startsWith("http") ? value : `https://${value}`;
}

function yearRange(start?: string | null, end?: string | null, current?: boolean) {
  const startYear = start && Number.isFinite(new Date(start).getTime())
    ? new Date(start).getFullYear()
    : null;
  const endYear = current
    ? "NOW"
    : end && Number.isFinite(new Date(end).getTime())
      ? new Date(end).getFullYear()
      : "RECENT";
  return [startYear, endYear].filter(Boolean).join(" — ");
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function availability(value?: string | null) {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Open to discuss";
}

function HoloPanel({
  index,
  title,
  children,
  className = "",
}: {
  index: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`holo-panel ${className}`}>
      <div className="holo-panel-head">
        <span>{index}</span>
        <strong>{title}</strong>
        <CircleDot className="h-3.5 w-3.5" />
      </div>
      <div className="holo-panel-body">{children}</div>
    </article>
  );
}

export function HologramPortfolioTemplate({
  site,
  profile,
  experiences,
  education,
  skills,
}: EditorialPortfolioProps) {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const accent = typeof site.design?.accent === "string" ? site.design.accent : "#63f3ff";
  const intro = site.intro || profile.about || `${profile.name} builds thoughtful digital products and systems.`;
  const role = site.headline || profile.jobTitle || "Digital professional";
  const nameParts = profile.name.split(/\s+/).filter(Boolean);
  const groupedSkills = useMemo(() => {
    return skills.reduce<Record<string, typeof skills>>((groups, skill) => {
      const category = skill.category || "Core systems";
      groups[category] = groups[category] || [];
      groups[category].push(skill);
      return groups;
    }, {});
  }, [skills]);
  const contactEmail = profile.email || site.contactEmail;
  const contacts = [
    contactEmail ? { label: contactEmail, href: `mailto:${contactEmail}`, icon: Mail } : null,
    profile.phone ? { label: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, "")}`, icon: Phone } : null,
    profile.linkedinUrl ? { label: "LinkedIn", href: normalizeUrl(profile.linkedinUrl), icon: Linkedin } : null,
    profile.githubUrl ? { label: "GitHub", href: normalizeUrl(profile.githubUrl), icon: Github } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;
  const rootStyle = {
    "--holo-accent": accent,
  } as CSSProperties;

  return (
    <main className={`holo-root ${paused ? "holo-root-paused" : ""}`} style={rootStyle}>
      <HologramLabScene accent={accent} avatarUrl={profile.avatarUrl} paused={paused} />
      <div className="holo-noise" aria-hidden />
      <div className="holo-vignette" aria-hidden />

      {site.showWatermark !== false ? (
        <Link to="/" className="holo-watermark">
          <span /> Made with JobRaker
        </Link>
      ) : null}
      {site.isPreview ? <div className="holo-preview">PRIVATE PREVIEW</div> : null}

      <header className="holo-header">
        <a href="#top" className="holo-brand" aria-label="Back to top">
          <span>JR</span><small>/ LAB</small>
        </a>
        <nav aria-label="Portfolio sections">
          <a href="#about">About</a>
          <a href="#projects">Work</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="holo-controls">
          <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume motion" : "Pause motion"}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Enable interface sound" : "Mute interface sound"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <section id="top" className="holo-hero">
        <div className="holo-hero-meta">
          <span><i /> SYSTEM ONLINE</span>
          <span>{profile.location || "REMOTE NETWORK"}</span>
          <span>{String(site.views).padStart(4, "0")} PROFILE VIEWS</span>
        </div>

        <div className="holo-hero-title" aria-label={profile.name}>
          {nameParts.length ? nameParts.map((part, index) => (
            <span key={`${part}-${index}`}>{part}</span>
          )) : <span>JOBRAKER</span>}
          <div className="holo-role-banner">{role}</div>
        </div>

        <div className="holo-avatar-chip">
          <div className="holo-avatar-chip-image">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : <span>{initials(profile.name)}</span>}
          </div>
          <div>
            <small>SUBJECT / 001</small>
            <strong>{profile.name}</strong>
          </div>
        </div>

        <a className="holo-scroll" href="#about">
          <span>SCROLL TO INITIALIZE</span>
          <ArrowDown className="h-4 w-4" />
        </a>
      </section>

      <section id="about" className="holo-about-runway">
        <div className="holo-about-sticky">
          <div className="holo-section-marker">01 / PROFILE ANALYSIS</div>
          <div className="holo-about-layout">
            <HoloPanel index="01" title="IDENTITY" className="holo-panel-identity">
              <div className="holo-identity-row">
                <MapPin className="h-4 w-4" />
                <span>{profile.location || "Remote-ready"}</span>
              </div>
              <div className="holo-identity-row">
                <BriefcaseBusiness className="h-4 w-4" />
                <span>{profile.experienceYears || experiences.length}+ years / {experiences.length} missions</span>
              </div>
              <div className="holo-identity-row">
                <CalendarDays className="h-4 w-4" />
                <span>{availability(profile.availability.start)}</span>
              </div>
            </HoloPanel>

            <HoloPanel index="02" title="DESCRIPTION" className="holo-panel-description">
              <p>{intro}</p>
              {profile.goals.length ? (
                <div className="holo-goals">
                  {profile.goals.slice(0, 3).map((goal, index) => (
                    <span key={goal}><small>{String(index + 1).padStart(2, "0")}</small>{goal}</span>
                  ))}
                </div>
              ) : null}
            </HoloPanel>

            <HoloPanel index="03" title="SERVICES" className="holo-panel-services">
              <div className="holo-service-list">
                {Object.entries(groupedSkills).slice(0, 4).map(([category, entries], index) => (
                  <div key={category}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{category}</strong>
                    <small>{entries.length} modules</small>
                  </div>
                ))}
              </div>
            </HoloPanel>
          </div>
          <div className="holo-progress-strip">
            <span>PROFILE SCAN</span>
            <div><i /><i /><i /><i /><i /></div>
            <strong>100%</strong>
          </div>
        </div>
      </section>

      <section id="projects" className="holo-projects">
        <div className="holo-projects-heading">
          <span>02 / SELECTED MISSIONS</span>
          <h2>WORK<br />ARCHIVE</h2>
          <p>Roles and outcomes rendered as interactive mission records.</p>
        </div>

        <div className="holo-project-list">
          {experiences.length ? experiences.map((experience, index) => (
            <article key={`${experience.company}-${experience.title}-${index}`} className="holo-project-card">
              <div className="holo-project-visual">
                <span className="holo-project-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="holo-project-orbit"><i /><i /><i /></div>
                <strong>{experience.company.slice(0, 2).toUpperCase()}</strong>
                <ScanLine className="holo-project-scan" />
              </div>
              <div className="holo-project-copy">
                <div className="holo-project-meta">
                  <span>{yearRange(experience.start_date, experience.end_date, experience.is_current)}</span>
                  <span>{experience.location || "REMOTE"}</span>
                </div>
                <h3>{experience.title}</h3>
                <h4>{experience.company}</h4>
                {experience.description ? <p>{experience.description}</p> : null}
                <div className="holo-project-link">OPEN MISSION FILE <ArrowUpRight className="h-4 w-4" /></div>
              </div>
            </article>
          )) : (
            <div className="holo-empty">Experience records will appear when the profile is enriched.</div>
          )}
        </div>
      </section>

      <section className="holo-toolkit">
        <div className="holo-toolkit-heading">
          <span>03 / SYSTEM CAPABILITIES</span>
          <h2>SKILLS<br />MATRIX</h2>
        </div>
        <div className="holo-toolkit-grid">
          <HoloPanel index="A" title="CAPABILITIES" className="holo-toolkit-skills">
            {Object.entries(groupedSkills).length ? Object.entries(groupedSkills).map(([category, entries]) => (
              <div key={category} className="holo-skill-group">
                <span>{category}</span>
                <div>{entries.map((skill) => <strong key={`${category}-${skill.name}`}>{skill.name}</strong>)}</div>
              </div>
            )) : <p>Skill modules are awaiting synchronization.</p>}
          </HoloPanel>

          <HoloPanel index="B" title="EDUCATION">
            {education.length ? education.map((item, index) => (
              <div key={`${item.school}-${index}`} className="holo-education-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.degree}</strong><p>{item.school}</p></div>
                <small>{yearRange(item.start_date, item.end_date)}</small>
              </div>
            )) : <p>Education records have not been added.</p>}
          </HoloPanel>

          <HoloPanel index="C" title="AVAILABILITY">
            <div className="holo-availability">
              <span><small>START</small><strong>{availability(profile.availability.start)}</strong></span>
              <span><small>CAPACITY</small><strong>{profile.availability.weeklyHours ? `${profile.availability.weeklyHours} HRS / WEEK` : "FLEXIBLE"}</strong></span>
              <span><small>TIMEZONE</small><strong>{profile.availability.timezone || "REMOTE-FRIENDLY"}</strong></span>
            </div>
          </HoloPanel>
        </div>
      </section>

      <section id="contact" className="holo-contact">
        <div className="holo-contact-copy">
          <span>04 / OPEN CHANNEL</span>
          <h2>LET&apos;S BUILD<br />THE NEXT SYSTEM.</h2>
          <p>{site.ctaLabel || "Start a conversation"}</p>
        </div>
        <div className="holo-contact-console">
          <div className="holo-console-head"><i /> TRANSMISSION READY <span>ENCRYPTED</span></div>
          <div className="holo-contact-links">
            {contacts.map((item) => {
              const Icon = item.icon;
              const external = item.href.startsWith("http");
              return (
                <a key={item.href} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                  <Icon className="h-4 w-4" /><span>{item.label}</span><ArrowUpRight className="h-4 w-4" />
                </a>
              );
            })}
            {site.links.slice(0, 4).map((link) => (
              <a key={link.url} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer">
                <Sparkles className="h-4 w-4" /><span>{link.label}</span><ArrowUpRight className="h-4 w-4" />
              </a>
            ))}
          </div>
          {contactEmail ? <a className="holo-primary-contact" href={`mailto:${contactEmail}`}>SEND TRANSMISSION <ArrowUpRight className="h-4 w-4" /></a> : null}
        </div>
      </section>

      <footer className="holo-footer">
        <span>© {new Date().getFullYear()} {profile.name}</span>
        <a href={SOURCE_REPOSITORY} target="_blank" rel="noopener noreferrer">
          Visual language inspired by David Heckhoff&apos;s portfolio <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <span>Original code, models, textures, fonts, and audio not included</span>
      </footer>
    </main>
  );
}
