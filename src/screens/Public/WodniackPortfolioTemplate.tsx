import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, GraduationCap, MapPin, Sparkles } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import type { EditorialPortfolioProps } from "./EditorialPortfolioTemplate";
import { WodniackWaveField } from "./WodniackWaveField";
import { ContactItems, PlayfulArtifacts } from "./WodniackPortfolioPlayground";
import { FourPointStar, WorkStage, chunkName, initials, splitTitle, yearRange } from "./WodniackPortfolioCore";
import { WodniackSiteHead } from "./WodniackSiteHead";
import { WodniackHero } from "./WodniackHero";
import { WodniackIntro } from "./WodniackIntro";
import { WodniackScrollbar } from "./WodniackScrollbar";
import { emitter, observeIntersections, prefersReducedMotion, startRuntime, ticker } from "./WodniackRuntime";
import "./WodniackPortfolioTemplate.css";

gsap.registerPlugin(ScrollTrigger);

const SOURCE_REPOSITORY = "https://github.com/AntoineW/AW-2025-Portfolio";

export function WodniackPortfolioTemplate({
  site,
  profile,
  experiences,
  education,
  skills,
}: EditorialPortfolioProps) {
  const [contrasted, setContrasted] = useState(true);
  const [showIntro, setShowIntro] = useState(() => !prefersReducedMotion());
  const rootRef = useRef<HTMLElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const accent = typeof site.design?.accent === "string" ? site.design.accent : "#f40c3f";
  const intro = site.intro || profile.about || `${profile.name} is building a career through curiosity, craft, and memorable work.`;
  const email = profile.email || site.contactEmail;
  const titleWords = splitTitle(profile.jobTitle || site.headline || "Creative Professional");
  const nameChunks = chunkName(profile.name);
  const groupedSkills = skills.reduce<Record<string, typeof skills>>((groups, skill) => {
    const category = skill.category || "Core capabilities";
    groups[category] = groups[category] || [];
    groups[category].push(skill);
    return groups;
  }, {});

  /**
   * Shared runtime + Lenis, mirroring the `Site` class in the reference's
   * index.astro: one gsap ticker drives Lenis, Lenis drives ScrollTrigger, and
   * every section listens on the same tick/scroll/resize bus.
   */
  useEffect(() => {
    const stopRuntime = startRuntime();

    let lenis: Lenis | null = null;
    let rafHandler: ((time: number) => void) | null = null;

    if (!prefersReducedMotion()) {
      lenis = new Lenis();
      lenis.on("scroll", ScrollTrigger.update);

      rafHandler = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(rafHandler);
      gsap.ticker.lagSmoothing(0);
    }

    const stopObserving = rootRef.current ? observeIntersections(rootRef.current) : undefined;

    return () => {
      stopObserving?.();
      if (rafHandler) gsap.ticker.remove(rafHandler);
      gsap.ticker.lagSmoothing(500, 33);
      lenis?.destroy();
      stopRuntime();
    };
  }, []);

  /** The persistent page frame fades in as the intro curtain hands off. */
  const onIntroDone = () => {
    setShowIntro(false);
    if (mountRef.current) gsap.set(mountRef.current, { opacity: 1 });
    ticker.nextTick(() => emitter.emit("updateViewport"));
  };

  const style = {
    "--wdk-red": accent,
    "--wdk-primary": contrasted ? "#fff2ed" : accent,
    "--wdk-secondary": "#160000",
    "--wdk-shadow": contrasted ? "#4d4040" : "#540000",
    "--wdk-white": "#fff0eb",
  } as CSSProperties;

  const signals = [
    ["Experience", `${profile.experienceYears || 0}+ years`],
    ["Roles", String(experiences.length)],
    ["Capabilities", String(skills.length)],
    ["Portfolio views", String(site.views)],
    ["Location", profile.location || "Remote-ready"],
    ["Current direction", profile.goals[0] || profile.jobTitle || "Career growth"],
  ];

  return (
    <main className="wdk-root" style={style} ref={rootRef}>
      <div className="wdk-wrapper">
      <WodniackSiteHead
        site={site}
        profile={profile}
        contrasted={contrasted}
        onToggleContrast={() => setContrasted((value) => !value)}
      />

      <WodniackHero
        words={[titleWords[0], titleWords[1]]}
        nameChunks={nameChunks}
        footChunks={["Do", "Things", "Your", "Way", profile.location || "Remote"]}
      />

      <section id="about" className="wdk-about">
        <div className="wdk-about-grid" aria-hidden />
        <div className="wdk-about-inner">
          <article className="wdk-about-copy">
            <p className="wdk-kicker">01 / About</p>
            <h2>Curiosity is<br />the real skill.</h2>
            <p>{intro}</p>
            {profile.goals.length ? (
              <div className="wdk-goals">
                {profile.goals.slice(0, 4).map((goal, index) => (
                  <span key={goal}><small>{String(index + 1).padStart(2, "0")}</small>{goal}</span>
                ))}
              </div>
            ) : null}
          </article>

          <div className="wdk-signals">
            <div className="wdk-signal-heading">
              <span>Profile signals</span>
              <FourPointStar className="wdk-signal-star" />
            </div>
            {signals.map(([label, value], index) => (
              <div key={label} className="wdk-signal-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{label}</strong>
                <em>{value}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="wdk-profile-band">
          <div className="wdk-profile-portrait">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} /> : <span>{initials(profile.name)}</span>}
          </div>
          <div>
            <p>{profile.name}</p>
            <strong>{site.headline || profile.jobTitle || "Career portfolio"}</strong>
          </div>
          <div className="wdk-profile-location"><MapPin className="h-4 w-4" />{profile.location || "Remote-ready"}</div>
        </div>
      </section>

      <WorkStage experiences={experiences} accent={accent} />

      <section className="wdk-profile-details">
        <div className="wdk-details-header">
          <p className="wdk-kicker">03 / The toolkit</p>
          <h2>Skills, education,<br />and working rhythm.</h2>
        </div>
        <div className="wdk-details-grid">
          <article className="wdk-details-panel wdk-details-skills">
            <div className="wdk-panel-label"><Sparkles className="h-4 w-4" /> Capabilities</div>
            {Object.entries(groupedSkills).length ? Object.entries(groupedSkills).map(([category, entries]) => (
              <div key={category} className="wdk-skill-group">
                <span>{category}</span>
                <div>{entries.map((skill) => <strong key={`${category}-${skill.name}`}>{skill.name}</strong>)}</div>
              </div>
            )) : <p>Skills will appear as this profile is enriched.</p>}
          </article>

          <article className="wdk-details-panel">
            <div className="wdk-panel-label"><GraduationCap className="h-4 w-4" /> Education</div>
            {education.length ? education.map((item, index) => (
              <div key={`${item.school}-${index}`} className="wdk-education-row">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.degree}</strong><p>{item.school}</p></div>
                <small>{yearRange(item.start_date, item.end_date)}</small>
              </div>
            )) : <p>Education details have not been added yet.</p>}
          </article>

          <article className="wdk-details-panel">
            <div className="wdk-panel-label"><CalendarDays className="h-4 w-4" /> Availability</div>
            <div className="wdk-availability">
              <span><small>Start</small><strong>{profile.availability.start?.replace(/_/g, " ") || "Open to discuss"}</strong></span>
              <span><small>Capacity</small><strong>{profile.availability.weeklyHours ? `${profile.availability.weeklyHours} hrs/week` : "Flexible"}</strong></span>
              <span><small>Timezone</small><strong>{profile.availability.timezone || "Remote-friendly"}</strong></span>
            </div>
          </article>
        </div>
      </section>

      <PlayfulArtifacts profile={profile} skills={skills} education={education} />

      <section id="contact" className="wdk-contact">
        <div className="wdk-contact-grid" aria-hidden>
          <WodniackWaveField className="wdk-contact-waves" strength={0.55} interactive />
        </div>
        <div className="wdk-contact-inner">
          <div className="wdk-contact-button-wrap">
            <a href={email ? `mailto:${email}` : "#top"} className="wdk-contact-button">
              <span className="wdk-contact-go">GO</span>
              <span className="wdk-contact-rock">LET’S<br />ROCK</span>
              <FourPointStar className="wdk-contact-star wdk-contact-star-a" />
              <FourPointStar className="wdk-contact-star wdk-contact-star-b" />
            </a>
          </div>
          <div className="wdk-contact-copy">
            <p>Have a role, project, or conversation worth exploring?</p>
            <h2>{site.ctaLabel || "Start a conversation"}</h2>
            {email ? <a href={`mailto:${email}`}>{email}<ArrowUpRight className="h-5 w-5" /></a> : null}
          </div>
          <ContactItems site={site} profile={profile} />
        </div>
      </section>

      <footer className="wdk-footer">
        <span>© {new Date().getFullYear()} {profile.name}</span>
        <a href={SOURCE_REPOSITORY} target="_blank" rel="noopener noreferrer">
          Interaction language inspired by Antoine Wodniack’s open-source portfolio
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <span>Original code, fonts, and assets not included</span>
      </footer>
      </div>{/* .wdk-wrapper */}

      {/* Persistent page frame; the intro's own borders hand off to this. */}
      <div className="wdk-mount" ref={mountRef} aria-hidden />

      {site.showWatermark !== false ? (
        <Link to="/" className="wdk-watermark">
          <span /> Made with JobRaker
        </Link>
      ) : null}
      {site.isPreview ? <div className="wdk-preview">Private preview</div> : null}

      {showIntro ? <WodniackIntro onDone={onIntroDone} /> : null}

      <WodniackScrollbar />
    </main>
  );
}
