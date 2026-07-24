import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  Phone,
} from "lucide-react";
import { EditorialPortfolioGlobe } from "./EditorialPortfolioGlobe";

export type EditorialPortfolioProps = {
  site: {
    headline: string | null;
    intro: string | null;
    ctaLabel: string;
    contactEmail: string | null;
    links: Array<{ label: string; url: string }>;
    design?: Record<string, unknown>;
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
  skills: Array<{ name: string; level: string | null; category: string | null }>;
  theme: { accent: string; alt: string; bg: string; text: string };
};

type SectionHeadingProps = {
  number: string;
  title: string;
  description?: string;
};

function SectionHeading({ number, title, description }: SectionHeadingProps) {
  return (
    <div className="mb-9 flex items-start gap-4 sm:gap-6">
      <span
        className="shrink-0 pt-1 font-serif text-2xl font-light italic leading-none text-[var(--editorial-accent)] sm:text-3xl"
        aria-hidden
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-4">
          <h2 className="font-serif text-3xl font-bold leading-none tracking-[-0.035em] sm:text-5xl">
            {title}
          </h2>
          <span className="h-px flex-1 bg-[#2b241d]/15" />
        </div>
        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#6f655b]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function years(start?: string | null, end?: string | null, current?: boolean) {
  const first = start && Number.isFinite(new Date(start).getTime())
    ? new Date(start).getFullYear()
    : null;
  const last = current
    ? "Present"
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

function normalizeUrl(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

function readableAvailability(value?: string | null) {
  return value
    ? value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : null;
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756b60]">
      {children}
    </span>
  );
}

export function EditorialPortfolioTemplate({
  site,
  profile,
  experiences,
  education,
  skills,
}: EditorialPortfolioProps) {
  const accent = typeof site.design?.accent === "string" ? site.design.accent : "#b4532f";
  const intro =
    site.intro ||
    profile.about ||
    `${profile.name} is building thoughtful work and a career with clear direction.`;
  const email = profile.email || site.contactEmail;
  const firstName = profile.name.split(/\s+/).filter(Boolean)[0] || profile.name;
  const style = {
    "--editorial-accent": accent,
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  } as CSSProperties;
  const displayStyle = {
    fontFamily: "Georgia, 'Times New Roman', serif",
  } as CSSProperties;
  const contacts = [
    profile.email ? { label: profile.email, href: `mailto:${profile.email}`, icon: Mail } : null,
    profile.phone
      ? { label: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, "")}`, icon: Phone }
      : null,
    profile.linkedinUrl
      ? { label: "LinkedIn", href: normalizeUrl(profile.linkedinUrl), icon: Linkedin }
      : null,
    profile.githubUrl
      ? { label: "GitHub", href: normalizeUrl(profile.githubUrl), icon: Github }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;
  const groupedSkills = skills.reduce<Record<string, typeof skills>>((groups, skill) => {
    const category = skill.category || "Core capabilities";
    groups[category] = groups[category] || [];
    groups[category].push(skill);
    return groups;
  }, {});
  const availabilityStart = readableAvailability(profile.availability.start);
  const hasAvailability = Boolean(
    availabilityStart || profile.availability.weeklyHours || profile.availability.timezone,
  );
  const globeDestinations = experiences.map((experience) => ({
    label: experience.company,
    location: experience.location,
  }));
  const proofPoints = [
    `${profile.experienceYears || 0}+ years of focused experience`,
    `${experiences.length} role${experiences.length === 1 ? "" : "s"} documented`,
    `${skills.length} skill${skills.length === 1 ? "" : "s"} across ${Math.max(1, Object.keys(groupedSkills).length)} disciplines`,
    profile.location ? `Based in ${profile.location}` : "Available for remote opportunities",
  ];

  return (
    <main
      className="relative min-h-screen overflow-x-clip bg-[#f4eee3] text-[#261f19] selection:bg-[var(--editorial-accent)]/20"
      style={style}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.045] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 0 0.04 0 0 0 .85 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {site.showWatermark !== false ? (
        <Link
          to="/"
          className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 border border-[#2b241d]/15 bg-[#f8f3ea]/95 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] shadow-[0_14px_35px_rgba(45,35,25,.12)] backdrop-blur-xl"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--editorial-accent)]" />
          Made with JobRaker
        </Link>
      ) : null}
      {site.isPreview ? (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 border border-[#2b241d]/15 bg-[#f8f3ea]/95 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur-xl">
          Private preview
        </div>
      ) : null}

      <section id="top" className="relative isolate z-10 min-h-[100svh] overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20"
          style={{
            background:
              "radial-gradient(ellipse 74% 78% at 76% 28%, rgba(255,255,255,.94), transparent 67%), radial-gradient(ellipse 55% 70% at 8% 8%, color-mix(in srgb, var(--editorial-accent) 24%, transparent), transparent 70%), linear-gradient(135deg, #f8f2e7 0%, #eee3d2 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-52 bg-gradient-to-b from-transparent to-[#f4eee3]"
        />

        <div className="mx-auto flex min-h-[100svh] w-full max-w-[1200px] flex-col px-6 pb-8 pt-6 md:px-10 lg:px-12">
          <header className="flex items-center justify-between gap-4 border-b border-[#2b241d]/15 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--editorial-accent)]" />
              <MetaLabel>{profile.jobTitle || "Career portfolio"}</MetaLabel>
            </div>
            <MetaLabel>{profile.location || "Remote"} · {new Date().getFullYear()}</MetaLabel>
          </header>

          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.08fr_.92fr] lg:gap-16 lg:py-14">
            <div className="order-2 min-w-0 lg:order-1">
              <MetaLabel>Independent profile · Issue 01</MetaLabel>
              <h1
                className="mt-5 max-w-[13ch] text-[clamp(3.65rem,8.6vw,7.6rem)] font-bold leading-[0.91] tracking-[-0.055em]"
                style={displayStyle}
              >
                Hey, I&apos;m{" "}
                <span className="font-normal italic text-[var(--editorial-accent)]">{firstName}</span>.
              </h1>
              <div className="mt-7 max-w-[42rem] border-l-2 border-[var(--editorial-accent)] pl-5">
                <p className="text-lg leading-8 text-[#514940] sm:text-xl">
                  {site.headline || profile.jobTitle || intro}
                </p>
              </div>

              <div className="mt-8 max-w-[34rem] border border-[#2b241d]/12 bg-[#f8f3ea]/60 p-5 backdrop-blur-sm sm:p-6">
                <MetaLabel>Profile note</MetaLabel>
                <p className="mt-3 text-sm leading-7 text-[#514940] sm:text-base">{intro}</p>
                {profile.goals[0] ? (
                  <p className="mt-4 font-serif text-lg italic leading-snug text-[#514940]" style={displayStyle}>
                    “{profile.goals[0]}”
                  </p>
                ) : null}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex min-h-12 items-center gap-2 bg-[#261f19] px-5 text-sm font-semibold text-[#f8f3ea] transition-transform active:scale-[0.98]"
                  >
                    {site.ctaLabel || "Start a conversation"}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
                <a
                  href="#experience"
                  className="inline-flex min-h-12 items-center gap-2 border border-[#2b241d]/20 px-5 text-sm font-semibold transition-colors hover:border-[var(--editorial-accent)] hover:text-[var(--editorial-accent)]"
                >
                  Explore the work
                  <ArrowDown className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <div className="relative aspect-[4/5] w-[15rem] overflow-hidden border border-[#2b241d]/12 bg-[#eadfce] shadow-[0_34px_90px_rgba(45,35,25,.17)] sm:w-[18rem] lg:w-[23rem]">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--editorial-accent)] text-7xl font-bold text-[#f8f3ea]" style={displayStyle}>
                    {initials(profile.name)}
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#f4eee3]/45 via-transparent to-white/20" />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                  style={{
                    background:
                      "radial-gradient(ellipse 80% 60% at 85% 8%, color-mix(in srgb, var(--editorial-accent) 42%, transparent), transparent 68%)",
                  }}
                />
                <span className="absolute bottom-3 left-3 bg-[#f8f3ea]/90 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#514940] backdrop-blur">
                  {profile.location || "Remote-ready"}
                </span>
              </div>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-y-3 border-t border-[#2b241d]/15 pt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[#756b60] lg:grid-cols-4 lg:gap-0">
            <li><strong className="mr-2 text-base text-[#261f19]">{profile.experienceYears || 0}+</strong>years</li>
            <li className="lg:text-center"><strong className="mr-2 text-base text-[#261f19]">{experiences.length}</strong>roles</li>
            <li className="lg:text-center"><strong className="mr-2 text-base text-[#261f19]">{skills.length}</strong>skills</li>
            <li className="lg:text-right"><strong className="mr-2 text-base text-[#261f19]">{site.views}</strong>views</li>
          </ul>
        </div>
      </section>

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-16 pt-14 md:px-10 lg:px-12 lg:pt-20">
        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-8 border-t border-[#2b241d]/15 pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-[var(--editorial-accent)] font-serif text-lg font-bold text-white" style={displayStyle}>
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : initials(profile.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-bold" style={displayStyle}>{profile.name}</p>
                  <p className="truncate text-xs text-[#756b60]">{profile.jobTitle || "Career profile"}</p>
                </div>
              </div>

              <nav className="mt-7 grid border-y border-[#2b241d]/12 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-[#756b60]">
                {[
                  ["01", "History", "#history"],
                  ["02", "Experience", "#experience"],
                  ["03", "Education", "#education"],
                  ["04", "Skills", "#skills"],
                  ["05", "Contact", "#contact"],
                ].map(([number, label, href]) => (
                  <a key={href} href={href} className="flex items-center justify-between py-2.5 transition-colors hover:text-[var(--editorial-accent)]">
                    <span>{label}</span>
                    <span className="text-[var(--editorial-accent)]">{number}</span>
                  </a>
                ))}
              </nav>

              <div className="mt-6">
                <MetaLabel>Current signal</MetaLabel>
                <p className="mt-3 text-sm leading-6 text-[#514940]">
                  {profile.goals[0] || "Open to the right opportunity and meaningful work."}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-[#2b241d]/12 pt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#756b60]">
                <span className="relative h-2 w-2 rounded-full bg-[var(--editorial-accent)] before:absolute before:-inset-1 before:rounded-full before:bg-[var(--editorial-accent)]/20" />
                Available to connect
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <section id="history" className="scroll-mt-8 pb-16 md:pb-20">
              <SectionHeading number="01" title="History" />
              <div className="grid gap-10 md:grid-cols-2 md:gap-12">
                <div className="space-y-4 text-base leading-8 text-[#5e554c]">
                  <p>{intro}</p>
                  {profile.goals.length > 1 ? (
                    <p>
                      The work ahead is guided by {profile.goals.slice(0, 3).join(", ").toLowerCase()}.
                    </p>
                  ) : null}
                </div>
                <ol className="border-y border-[#2b241d]/12">
                  {proofPoints.map((point, index) => (
                    <li key={point} className="flex gap-4 border-b border-[#2b241d]/10 py-4 text-sm leading-6 text-[#5e554c] last:border-b-0">
                      <span className="shrink-0 font-serif text-lg font-light italic text-[var(--editorial-accent)]" style={displayStyle}>
                        0{index + 1}
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section id="experience" className="scroll-mt-8 border-t border-[#2b241d]/15 py-16 md:py-20">
              <SectionHeading
                number="02"
                title="Experience"
                description="Roles, teams, and the places where this work has travelled. Drag the globe to explore the network."
              />

              <div className="mb-12 grid items-center gap-8 md:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)] md:gap-10">
                <div className="md:pr-4">
                  <p className="max-w-[18rem] font-serif text-2xl italic leading-[1.35] tracking-[-0.025em] text-[#514940]" style={displayStyle}>
                    From {profile.location || "one home base"} to teams and opportunities across the world.
                  </p>
                  <p className="mt-5 max-w-sm text-sm leading-7 text-[#756b60]">
                    Each arc represents a role or professional connection recorded in this JobRaker profile.
                  </p>
                </div>
                <div className="relative mx-auto aspect-square w-full max-w-[25rem]">
                  <EditorialPortfolioGlobe
                    home={profile.location}
                    destinations={globeDestinations}
                    accent={accent}
                  />
                </div>
              </div>

              <div className="border-t border-[#2b241d]/15">
                {experiences.length ? experiences.map((item, index) => (
                  <article
                    key={`${item.company}-${item.title}-${index}`}
                    className="grid gap-4 border-b border-[#2b241d]/12 py-7 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-7"
                  >
                    <span className="font-serif text-lg font-light italic text-[var(--editorial-accent)]" style={displayStyle}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-serif text-2xl font-bold tracking-[-0.025em]" style={displayStyle}>{item.title}</h3>
                      <p className="mt-1 text-sm font-medium text-[#756b60]">{item.company}</p>
                      {item.description ? (
                        <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-[#5e554c]">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="font-mono text-[10px] uppercase leading-6 tracking-[0.1em] text-[#756b60] sm:text-right">
                      <p>{years(item.start_date, item.end_date, item.is_current)}</p>
                      <p>{item.location || "Remote"}</p>
                    </div>
                  </article>
                )) : (
                  <p className="py-8 text-sm text-[#756b60]">
                    Experience details are being curated for this portfolio.
                  </p>
                )}
              </div>
            </section>

            <section id="education" className="scroll-mt-8 border-t border-[#2b241d]/15 py-16 md:py-20">
              <SectionHeading number="03" title="Education" />
              {education.length ? (
                <div className="grid gap-px border-y border-[#2b241d]/12 bg-[#2b241d]/12 sm:grid-cols-2">
                  {education.map((item, index) => (
                    <article key={`${item.school}-${index}`} className="bg-[#f4eee3] p-6 sm:p-7">
                      <GraduationCap className="h-5 w-5 text-[var(--editorial-accent)]" strokeWidth={1.5} />
                      <h3 className="mt-5 font-serif text-2xl font-bold tracking-[-0.025em]" style={displayStyle}>{item.degree}</h3>
                      <p className="mt-2 text-sm text-[#5e554c]">{item.school}</p>
                      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.11em] text-[#756b60]">
                        {years(item.start_date, item.end_date)}{item.location ? ` · ${item.location}` : ""}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#756b60]">Education details have not been added yet.</p>
              )}
            </section>

            <section id="skills" className="scroll-mt-8 border-t border-[#2b241d]/15 py-16 md:py-20">
              <SectionHeading number="04" title="Skills" description="A compact index of tools and strengths, grouped by where they create value." />
              {Object.entries(groupedSkills).length ? (
                <div className="border-t border-[#2b241d]/15">
                  {Object.entries(groupedSkills).map(([category, entries], index) => (
                    <article key={category} className="grid gap-4 border-b border-[#2b241d]/12 py-6 md:grid-cols-[3rem_12rem_minmax(0,1fr)] md:items-start md:gap-6">
                      <span className="font-serif text-lg font-light italic text-[var(--editorial-accent)]" style={displayStyle}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-serif text-xl font-bold" style={displayStyle}>{category}</h3>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#5e554c]">
                        {entries.map((skill) => (
                          <span key={`${category}-${skill.name}`} className="border-b border-[#2b241d]/18 pb-1">
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#756b60]">Skills will appear once the profile is enriched.</p>
              )}
            </section>

            <section id="contact" className="scroll-mt-8 border-t border-[#2b241d]/15 pt-16 md:pt-20">
              <SectionHeading number="05" title="Contact" />
              <div className="grid gap-8 border border-[#2b241d]/15 bg-[#eee3d2] p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <MetaLabel>Start a conversation</MetaLabel>
                  <h2 className="mt-5 max-w-3xl font-serif text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-6xl" style={displayStyle}>
                    Bring this experience into your next hiring conversation.
                  </h2>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-[#5e554c]">
                    For roles, collaborations, and meaningful work where this profile can make a difference.
                  </p>
                </div>
                {email ? (
                  <a href={`mailto:${email}`} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#261f19] px-5 text-sm font-semibold text-[#f8f3ea]">
                    {site.ctaLabel || "Start a conversation"}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              {(contacts.length || site.links.length || hasAvailability) ? (
                <div className="grid gap-px border-x border-b border-[#2b241d]/12 bg-[#2b241d]/12 sm:grid-cols-2">
                  {contacts.map((item) => {
                    const Icon = item.icon;
                    const external = item.href.startsWith("http");
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        className="flex min-h-14 items-center justify-between gap-3 bg-[#f4eee3] px-5 text-sm text-[#514940] transition-colors hover:text-[var(--editorial-accent)]"
                      >
                        <span className="inline-flex min-w-0 items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0" />
                      </a>
                    );
                  })}
                  {site.links.slice(0, 4).map((link) => (
                    <a key={link.url} href={normalizeUrl(link.url)} target="_blank" rel="noreferrer" className="flex min-h-14 items-center justify-between gap-3 bg-[#f4eee3] px-5 text-sm text-[#514940] transition-colors hover:text-[var(--editorial-accent)]">
                      <span className="truncate">{link.label || link.url}</span>
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                    </a>
                  ))}
                  {hasAvailability ? (
                    <div className="bg-[#f4eee3] px-5 py-4 sm:col-span-2">
                      <p className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--editorial-accent)]">
                        <CalendarDays className="h-4 w-4" strokeWidth={1.5} /> Availability
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-7 gap-y-2 text-sm text-[#5e554c]">
                        {availabilityStart ? <span>Start: {availabilityStart}</span> : null}
                        {profile.availability.weeklyHours ? <span>{profile.availability.weeklyHours} hrs/week</span> : null}
                        {profile.availability.timezone ? <span>{profile.availability.timezone}</span> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <footer className="flex flex-col gap-2 py-8 font-mono text-[9px] uppercase tracking-[0.13em] text-[#8a7e72] sm:flex-row sm:items-center sm:justify-between">
                <span>Built with JobRaker</span>
                <a href="https://github.com/Anshgrover23/portfolio" target="_blank" rel="noreferrer" className="transition-colors hover:text-[var(--editorial-accent)]">
                  Editorial template adapted from Ansh Grover&apos;s portfolio
                </a>
              </footer>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
