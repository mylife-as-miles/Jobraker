import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Rocket,
  Sparkles,
  Star,
} from "lucide-react";
import type { EditorialPortfolioProps } from "./EditorialPortfolioTemplate";
import { OdysseyPortfolioScene } from "./OdysseyPortfolioScene";
import "./OdysseyPortfolioTemplate.css";

const SOURCE_REPOSITORY = "https://github.com/AbhishekBadar/portfolio";

const normalizeUrl = (url: string) => url.startsWith("http") ? url : `https://${url}`;

function yearRange(start?: string | null, end?: string | null, current?: boolean) {
  const first = start && Number.isFinite(new Date(start).getTime()) ? new Date(start).getFullYear() : null;
  const last = current
    ? "Now"
    : end && Number.isFinite(new Date(end).getTime())
      ? new Date(end).getFullYear()
      : "Recent";
  return [first, last].filter(Boolean).join(" — ");
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

export function OdysseyPortfolioTemplate({
  site,
  profile,
  experiences,
  education,
  skills,
}: EditorialPortfolioProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [stage, setStage] = useState(0);
  const [selectedMission, setSelectedMission] = useState<number | null>(null);
  const [showLoader, setShowLoader] = useState(true);
  const accent = typeof site.design?.accent === "string" ? site.design.accent : "#4cc9f0";
  const email = profile.email || site.contactEmail;
  const role = site.headline || profile.jobTitle || "Creative professional";
  const intro = site.intro || profile.about || `${profile.name} is charting a focused path through experience, skills, and ambitious work.`;

  const sceneSkills = useMemo(() => skills.map((skill) => skill.name).slice(0, 8), [skills]);
  const sceneMissions = useMemo(() => experiences.map((item) => ({ title: item.title, company: item.company })).slice(0, 6), [experiences]);
  const groupedSkills = useMemo(() => skills.reduce<Record<string, typeof skills>>((groups, skill) => {
    const category = skill.category || "Core systems";
    groups[category] = groups[category] || [];
    groups[category].push(skill);
    return groups;
  }, {}), [skills]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setShowLoader(false);
      return;
    }
    const timeout = window.setTimeout(() => setShowLoader(false), 1450);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let previousStage = -1;
    const update = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      rootRef.current?.style.setProperty("--ody-progress", String(progress));
      const nextStage = Math.min(4, Math.floor(progress * 5.05));
      if (nextStage !== previousStage) {
        previousStage = nextStage;
        setStage(nextStage);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const contacts = [
    email ? { label: email, href: `mailto:${email}`, icon: Mail } : null,
    profile.phone ? { label: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, "")}`, icon: Phone } : null,
    profile.linkedinUrl ? { label: "LinkedIn", href: normalizeUrl(profile.linkedinUrl), icon: Linkedin } : null,
    profile.githubUrl ? { label: "GitHub", href: normalizeUrl(profile.githubUrl), icon: Github } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;

  const style = {
    "--ody-accent": accent,
    "--ody-accent-soft": `${accent}33`,
  } as CSSProperties;

  return (
    <main ref={rootRef} className="ody-root" style={style}>
      <OdysseyPortfolioScene
        profileName={profile.name}
        role={role}
        accent={accent}
        skills={sceneSkills}
        missions={sceneMissions}
      />

      {showLoader ? (
        <div className="ody-loader" aria-hidden>
          <div className="ody-loader-orbit"><Rocket /></div>
          <p>Initializing Odyssey</p>
          <span>JR / FLIGHT 05</span>
        </div>
      ) : null}

      {site.showWatermark !== false ? (
        <Link to="/" className="ody-watermark"><span /> Made with JobRaker</Link>
      ) : null}
      {site.isPreview ? <div className="ody-preview">Private preview</div> : null}

      <header className="ody-nav">
        <a href="#top" className="ody-brand" aria-label="Back to top">
          <Rocket className="h-4 w-4" />
          <span>ODYSSEY</span>
          <small>05</small>
        </a>
        <nav aria-label="Portfolio sections">
          <a href="#about">About</a>
          <a href="#skills">Systems</a>
          <a href="#missions">Missions</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="ody-nav-status"><span /> Signal online</div>
      </header>

      <aside className="ody-hud-rail" aria-label="Journey progress">
        {["Launch", "About", "Systems", "Missions", "Contact"].map((label, index) => (
          <a key={label} className={stage === index ? "is-active" : ""} href={["#top", "#about", "#skills", "#missions", "#contact"][index]}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <em>{label}</em>
          </a>
        ))}
        <div className="ody-hud-progress"><span /></div>
      </aside>

      <section id="top" className="ody-section ody-hero">
        <div className="ody-telemetry ody-telemetry-left">
          <span>FLIGHT / 05</span><span>ALT +000.4</span><span>THR 000%</span>
        </div>
        <div className="ody-hero-copy">
          <div className="ody-status-chip"><span /> {profile.availability.start ? "Available for new missions" : "Open to opportunities"}</div>
          <h1>{profile.name}</h1>
          <p>{role}</p>
          <div className="ody-hero-meta">
            <span><MapPin className="h-4 w-4" /> {profile.location || "Remote-ready"}</span>
            <span><Star className="h-4 w-4" /> {profile.experienceYears || 0}+ years</span>
          </div>
        </div>
        <a href="#about" className="ody-scroll-cue"><span>Scroll to launch</span><ArrowDown className="h-5 w-5" /></a>
      </section>

      <section id="about" className="ody-section ody-about">
        <article className="ody-glass-panel ody-about-panel">
          <p className="ody-eyebrow">Landmark 01 / Orange world</p>
          <h2>About<br />the pilot.</h2>
          <div className="ody-pilot-row">
            <div className="ody-avatar">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : <span>{initials(profile.name)}</span>}
            </div>
            <div><strong>{profile.name}</strong><span>{role}</span></div>
          </div>
          <p className="ody-body-copy">{intro}</p>
          {profile.goals.length ? (
            <div className="ody-goal-list">
              {profile.goals.slice(0, 4).map((goal, index) => <span key={goal}><small>0{index + 1}</small>{goal}</span>)}
            </div>
          ) : null}
        </article>
        <div className="ody-world-label"><span>ABOUT ME</span><small>Atmosphere stable</small></div>
      </section>

      <section id="skills" className="ody-section ody-skills">
        <div className="ody-section-heading">
          <p className="ody-eyebrow">Landmark 02 / Holographic corridor</p>
          <h2>Systems<br />online.</h2>
          <p>Capabilities appear as telemetry cards while the flight threads through the skill corridor.</p>
        </div>
        <div className="ody-skill-grid">
          {Object.entries(groupedSkills).length ? Object.entries(groupedSkills).slice(0, 6).map(([category, entries], index) => (
            <article key={category} className="ody-skill-card" style={{ "--card-index": index } as CSSProperties}>
              <div><span>SYS {String(index + 1).padStart(2, "0")}</span><Sparkles className="h-4 w-4" /></div>
              <h3>{category}</h3>
              <p>{entries.slice(0, 5).map((skill) => skill.name).join(" · ")}</p>
              <div className="ody-skill-meter"><span style={{ width: `${58 + (index % 4) * 10}%` }} /></div>
            </article>
          )) : (
            <article className="ody-skill-card"><h3>Core capability scan pending</h3><p>Add skills to populate this corridor.</p></article>
          )}
        </div>
      </section>

      <section id="missions" className="ody-section ody-missions">
        <div className="ody-section-heading ody-mission-heading">
          <p className="ody-eyebrow">Landmark 03 / Ringed archive</p>
          <h2>Mission<br />files.</h2>
          <p>Each role is catalogued as a completed or active mission around the blue archive world.</p>
        </div>
        <div className="ody-mission-grid">
          {experiences.length ? experiences.slice(0, 6).map((item, index) => (
            <button key={`${item.company}-${item.title}-${index}`} type="button" className="ody-mission-card" onClick={() => setSelectedMission(selectedMission === index ? null : index)} aria-expanded={selectedMission === index}>
              <div className="ody-mission-top"><span>MISSION {String(index + 1).padStart(2, "0")}</span><BriefcaseBusiness className="h-4 w-4" /></div>
              <h3>{item.title}</h3>
              <p>{item.company}</p>
              <div className="ody-mission-meta"><span>{yearRange(item.start_date, item.end_date, item.is_current)}</span><span>{item.location || "Remote"}</span></div>
              {selectedMission === index && item.description ? <div className="ody-mission-description">{item.description}</div> : null}
            </button>
          )) : (
            <article className="ody-mission-card"><h3>Mission archive pending</h3><p>Experience details will appear here.</p></article>
          )}
        </div>
      </section>

      <section className="ody-section ody-credentials">
        <div className="ody-credential-grid">
          <article className="ody-glass-panel">
            <div className="ody-panel-label"><GraduationCap className="h-4 w-4" /> Education</div>
            {education.length ? education.map((item, index) => (
              <div key={`${item.school}-${index}`} className="ody-credential-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.degree}</strong><p>{item.school}</p></div>
                <small>{yearRange(item.start_date, item.end_date)}</small>
              </div>
            )) : <p className="ody-body-copy">Education records have not been added.</p>}
          </article>
          <article className="ody-glass-panel">
            <div className="ody-panel-label"><CalendarDays className="h-4 w-4" /> Flight availability</div>
            <div className="ody-availability-grid">
              <span><small>Launch window</small><strong>{profile.availability.start?.replace(/_/g, " ") || "Open to discuss"}</strong></span>
              <span><small>Weekly capacity</small><strong>{profile.availability.weeklyHours ? `${profile.availability.weeklyHours} hrs` : "Flexible"}</strong></span>
              <span><small>Timezone</small><strong>{profile.availability.timezone || "Remote-friendly"}</strong></span>
              <span><small>Portfolio views</small><strong>{site.views}</strong></span>
            </div>
          </article>
        </div>
      </section>

      <section id="contact" className="ody-section ody-contact">
        <article className="ody-glass-panel ody-contact-panel">
          <p className="ody-eyebrow">Final landmark / Solar transmission</p>
          <h2>Open a<br />channel.</h2>
          <p className="ody-body-copy">Have a role, project, or conversation worth exploring? Send a transmission and begin the next mission.</p>
          {email ? <a className="ody-primary-contact" href={`mailto:${email}`}>{site.ctaLabel || "Start a conversation"}<ArrowUpRight className="h-5 w-5" /></a> : null}
          <div className="ody-contact-links">
            {contacts.map((item) => {
              const Icon = item.icon;
              const external = item.href.startsWith("http");
              return <a key={item.href} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}><Icon className="h-4 w-4" /><span>{item.label}</span><ArrowUpRight className="h-4 w-4" /></a>;
            })}
            {site.links.slice(0, 4).map((link) => <a key={link.url} href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer"><Sparkles className="h-4 w-4" /><span>{link.label}</span><ArrowUpRight className="h-4 w-4" /></a>)}
          </div>
        </article>
      </section>

      <footer className="ody-footer">
        <span>© {new Date().getFullYear()} {profile.name}</span>
        <a href={SOURCE_REPOSITORY} target="_blank" rel="noopener noreferrer">Cosmic voyage direction inspired by Abhishek Badar’s portfolio <ArrowUpRight className="h-3.5 w-3.5" /></a>
        <span>Procedural JobRaker adaptation</span>
      </footer>
    </main>
  );
}
