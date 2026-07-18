import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";

type NavigatorPortfolioProps = {
  site: {
    headline: string | null;
    intro: string | null;
    ctaLabel: string;
    contactEmail: string | null;
    links: Array<{ label: string; url: string }>;
    views: number;
    showWatermark?: boolean;
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
  theme: {
    accent: string;
    alt: string;
    bg: string;
    text: string;
  };
};

function formatYearRange(start?: string | null, end?: string | null, current?: boolean) {
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

function formatAvailability(value?: string | null) {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : null;
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

function hostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function NavigatorPortfolioTemplate({
  site,
  profile,
  experiences,
  education,
  skills,
  theme,
}: NavigatorPortfolioProps) {
  const intro =
    site.intro ||
    profile.about ||
    `${profile.name} is building a focused career story through JobRaker.`;
  const availabilityStart = formatAvailability(profile.availability.start);
  const contactItems = [
    profile.email
      ? { label: profile.email, href: `mailto:${profile.email}`, icon: Mail }
      : null,
    profile.phone
      ? { label: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, "")}`, icon: Phone }
      : null,
    profile.linkedinUrl
      ? {
          label: "LinkedIn",
          href: profile.linkedinUrl.startsWith("http") ? profile.linkedinUrl : `https://${profile.linkedinUrl}`,
          icon: Linkedin,
        }
      : null,
    profile.githubUrl
      ? {
          label: "GitHub",
          href: profile.githubUrl.startsWith("http") ? profile.githubUrl : `https://${profile.githubUrl}`,
          icon: Github,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;
  const primaryContact = profile.email || site.contactEmail;
  const groupedSkills = skills.reduce<Record<string, typeof skills>>((groups, skill) => {
    const category = skill.category || "Core capabilities";
    groups[category] = groups[category] || [];
    groups[category].push(skill);
    return groups;
  }, {});
  const profileStyle = {
    "--navigator-accent": theme.accent,
    "--navigator-alt": theme.alt,
    "--navigator-bg": theme.bg,
    "--navigator-text": theme.text,
  } as CSSProperties;

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#030403] text-[#f7fff5]"
      style={profileStyle}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(247,255,245,0.15) 1px, transparent 0)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(to bottom, black, transparent 72%)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[var(--navigator-accent)] opacity-[0.11] blur-[130px]" />

      {site.showWatermark !== false ? (
        <Link
          to="/"
          aria-label="Made with JobRaker"
          className="fixed bottom-4 left-4 z-40 inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-white/12 bg-black/70 px-4 py-2 text-xs font-semibold text-white/75 shadow-[0_18px_48px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navigator-accent)] sm:bottom-5 sm:left-5"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--navigator-accent)] shadow-[0_0_18px_currentColor] text-[var(--navigator-accent)]" />
          Made with JobRaker
        </Link>
      ) : null}
      {site.isPreview ? (
        <div className="fixed left-1/2 top-5 z-40 -translate-x-1/2 rounded-full border border-[var(--navigator-accent)]/30 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--navigator-accent)] backdrop-blur-xl">
          Private preview
        </div>
      ) : null}

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:py-8">
        <a href="#top" className="text-sm font-semibold uppercase tracking-[0.24em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navigator-accent)]">
          JobRaker<span className="text-[var(--navigator-accent)]">/</span> portfolio
        </a>
        <nav aria-label="Portfolio sections" className="hidden items-center gap-6 text-xs font-medium text-white/55 sm:flex">
          <a className="transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:text-white" href="#work">Work</a>
          <a className="transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:text-white" href="#skills">Skills</a>
          <a className="transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:text-white" href="#contact">Contact</a>
        </nav>
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--navigator-accent)]/35 bg-[var(--navigator-accent)]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--navigator-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_12px_currentColor]" />
          Open to connect
        </span>
      </header>

      <section id="top" className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:pb-28 lg:pt-24">
        <div className="min-w-0">
          <p className="public-profile-reveal mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--navigator-accent)]">
            <Sparkles className="h-4 w-4" />
            Career portfolio · 01
          </p>
          <h1 className="public-profile-reveal max-w-4xl text-[clamp(3.7rem,10vw,8.8rem)] font-semibold uppercase leading-[0.83] tracking-[-0.07em] text-[var(--navigator-text)]">
            <span className="block text-white/40">Hello, I’m</span>
            {profile.name.split(/\s+/).filter(Boolean).map((part) => (
              <span key={part} className="block text-[var(--navigator-text)]">{part}</span>
            ))}
          </h1>
          <div className="public-profile-reveal mt-8 grid max-w-2xl gap-5 border-l border-[var(--navigator-accent)] pl-5 sm:mt-10 sm:grid-cols-[auto_1fr] sm:items-start">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--navigator-accent)]">{profile.jobTitle || "Candidate profile"}</p>
            <p className="max-w-xl text-lg leading-relaxed text-white/68">{site.headline || intro}</p>
          </div>
          <div className="public-profile-reveal mt-9 flex flex-wrap items-center gap-3">
            <a
              href={primaryContact ? `mailto:${primaryContact}` : "#contact"}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--navigator-accent)] px-5 text-sm font-semibold text-black transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {site.ctaLabel || "Start a conversation"}
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a
              href="#work"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white/78 transition-colors duration-150 hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navigator-accent)]"
            >
              See the story
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="public-profile-reveal public-profile-interactive relative mx-auto w-full max-w-sm lg:justify-self-end">
          <div className="absolute -inset-5 rounded-full border border-dashed border-[var(--navigator-accent)]/45 animate-[spin_28s_linear_infinite] motion-reduce:animate-none" />
          <div className="absolute -inset-1 rounded-full border border-white/10" />
          <div className="relative aspect-square overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] p-3 shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[var(--navigator-accent)] text-7xl font-semibold tracking-[-0.08em] text-black">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
              ) : (
                initials(profile.name)
              )}
            </div>
          </div>
          <div className="absolute -bottom-4 -left-5 max-w-[14rem] rounded-2xl border border-white/12 bg-[#080a08]/90 p-4 shadow-[0_16px_44px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">Current signal</p>
            <p className="mt-2 text-sm font-medium leading-5 text-white/90">{profile.goals[0] || "Ready for the right opportunity"}</p>
          </div>
          <div className="absolute -right-4 top-12 rounded-full border border-[var(--navigator-accent)]/30 bg-[var(--navigator-accent)]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--navigator-accent)] backdrop-blur-xl">
            {profile.experienceYears || 0}+ years
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-px px-5 sm:grid-cols-4 sm:px-8">
          {[
            ["Based in", profile.location || "Remote-ready"],
            ["Experience", `${profile.experienceYears || 0}+ years`],
            ["Profile views", String(site.views)],
            ["Focus", profile.goals[1] || profile.goals[0] || "Career growth"],
          ].map(([label, value]) => (
            <div key={label} className="public-profile-reveal border-b border-white/10 py-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">{label}</p>
              <p className="mt-2 truncate text-sm font-medium text-white/88" title={value}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="work" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="public-profile-reveal text-xs font-semibold uppercase tracking-[0.22em] text-[var(--navigator-accent)]">Selected work · 02</p>
            <h2 className="public-profile-reveal mt-4 max-w-2xl text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.055em] sm:text-7xl">The experience behind the signal.</h2>
          </div>
          <p className="public-profile-reveal max-w-sm text-sm leading-6 text-white/55">A focused record of roles, impact, and the skills built along the way.</p>
        </div>

        <div className="border-t border-white/12">
          {experiences.length > 0 ? experiences.map((experience, index) => (
            <article key={`${experience.company}-${experience.title}-${index}`} className="public-profile-reveal public-profile-interactive group grid gap-5 border-b border-white/12 py-7 transition-colors duration-150 hover:bg-white/[0.035] sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-8 sm:px-4">
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--navigator-accent)]">0{index + 1}</p>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-2xl font-semibold tracking-[-0.035em] text-white">{experience.title}</h3>
                  <p className="text-sm text-white/52">{experience.company}</p>
                </div>
                {experience.description ? <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/63">{experience.description}</p> : null}
              </div>
              <div className="flex gap-4 text-xs text-white/48 sm:flex-col sm:items-end sm:gap-1">
                <p>{formatYearRange(experience.start_date, experience.end_date, experience.is_current)}</p>
                <p>{experience.location || "Remote"}</p>
              </div>
            </article>
          )) : (
            <div className="public-profile-reveal py-10 text-sm text-white/58">Experience details are being curated for this portfolio.</div>
          )}
        </div>
      </section>

      <section id="skills" className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="grid gap-12 border-t border-white/12 pt-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="public-profile-reveal lg:sticky lg:top-10 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--navigator-accent)]">Capability map · 03</p>
            <h2 className="mt-4 text-5xl font-semibold uppercase leading-[0.9] tracking-[-0.055em] sm:text-6xl">The tools I bring to the table.</h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/58">Grouped by where they create value—not just a list of logos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(groupedSkills).length > 0 ? Object.entries(groupedSkills).map(([category, entries], index) => (
              <article key={category} className="public-profile-reveal public-profile-interactive rounded-3xl border border-white/12 bg-white/[0.035] p-5 transition-colors duration-150 hover:border-[var(--navigator-accent)]/35 sm:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--navigator-accent)]">0{index + 1} · {category}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {entries.map((skill) => <span key={`${category}-${skill.name}`} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/72">{skill.name}</span>)}
                </div>
              </article>
            )) : (
              <div className="public-profile-reveal rounded-3xl border border-white/12 bg-white/[0.035] p-6 text-sm text-white/58">Skills will appear here once the profile is enriched.</div>
            )}
          </div>
        </div>
      </section>

      {(availabilityStart || profile.availability.weeklyHours || profile.availability.timezone || education.length > 0) ? (
        <section className="relative z-10 mx-auto grid max-w-7xl gap-4 px-5 pb-24 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32">
          {(availabilityStart || profile.availability.weeklyHours || profile.availability.timezone) ? (
            <article className="public-profile-reveal public-profile-interactive rounded-[2rem] border border-white/12 bg-white/[0.035] p-6 sm:p-8">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navigator-accent)]"><CalendarDays className="h-4 w-4" /> Availability</p>
              <h2 className="mt-5 text-4xl font-semibold uppercase leading-[0.9] tracking-[-0.05em]">Ready when the work is right.</h2>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {availabilityStart ? <div><p className="text-[10px] uppercase tracking-[0.18em] text-white/42">Start</p><p className="mt-2 text-sm font-medium">{availabilityStart}</p></div> : null}
                {profile.availability.weeklyHours ? <div><p className="text-[10px] uppercase tracking-[0.18em] text-white/42">Capacity</p><p className="mt-2 text-sm font-medium">{profile.availability.weeklyHours} hrs/week</p></div> : null}
                {profile.availability.timezone ? <div><p className="text-[10px] uppercase tracking-[0.18em] text-white/42">Timezone</p><p className="mt-2 text-sm font-medium">{profile.availability.timezone}</p></div> : null}
              </div>
            </article>
          ) : null}
          {education.length > 0 ? (
            <article className="public-profile-reveal public-profile-interactive rounded-[2rem] border border-white/12 bg-white/[0.035] p-6 sm:p-8">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navigator-accent)]"><GraduationCap className="h-4 w-4" /> Education</p>
              <div className="mt-6 grid gap-5">
                {education.map((item, index) => <div key={`${item.school}-${index}`} className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0"><p className="font-semibold text-white">{item.degree}</p><p className="mt-1 text-sm text-white/55">{item.school}</p><p className="mt-2 text-xs text-white/42">{formatYearRange(item.start_date, item.end_date)}{item.location ? ` · ${item.location}` : ""}</p></div>)}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      <section id="contact" className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32">
        <div className="public-profile-reveal public-profile-interactive overflow-hidden rounded-[2.25rem] border border-[var(--navigator-accent)]/25 bg-[var(--navigator-accent)] p-7 text-black sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/60">Let’s make the next move · 04</p>
              <h2 className="mt-5 max-w-3xl text-5xl font-semibold uppercase leading-[0.88] tracking-[-0.06em] sm:text-7xl">Bring this profile into your hiring loop.</h2>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-black/70">For roles, projects, and conversations where this experience can make a difference.</p>
            </div>
            {primaryContact ? <a href={`mailto:${primaryContact}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{site.ctaLabel || "Start a conversation"}<ArrowUpRight className="h-4 w-4" /></a> : null}
          </div>
          {(contactItems.length > 0 || site.links.length > 0) ? (
            <div className="mt-10 grid gap-2 border-t border-black/15 pt-6 sm:grid-cols-2">
              {contactItems.map((item) => {
                const Icon = item.icon;
                const external = item.href.startsWith("http");
                return <a key={item.href} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="group inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-black/15 px-4 py-2 text-sm text-black/75 transition-colors duration-150 hover:border-black/40 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><span className="inline-flex items-center gap-3"><Icon className="h-4 w-4" />{item.label}</span><ChevronRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" /></a>;
              })}
              {site.links.slice(0, 4).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="group inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-black/15 px-4 py-2 text-sm text-black/75 transition-colors duration-150 hover:border-black/40 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><span>{link.label || hostLabel(link.url)}</span><ArrowUpRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></a>)}
            </div>
          ) : null}
        </div>
        <footer className="flex flex-col gap-2 px-1 pt-8 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>Built with JobRaker</span>
          <a href="https://github.com/anand-reddi/luffy-portfolio" target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:text-white">Navigator layout inspired by Luffy Portfolio</a>
        </footer>
      </section>
    </main>
  );
}
