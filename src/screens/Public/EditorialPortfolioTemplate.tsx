import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";

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

function years(start?: string | null, end?: string | null, current?: boolean) {
  const first = start && Number.isFinite(new Date(start).getTime())
    ? new Date(start).getFullYear()
    : null;
  const last = current
    ? "Now"
    : end && Number.isFinite(new Date(end).getTime())
      ? new Date(end).getFullYear()
      : "Recent";
  return [first, last].filter(Boolean).join(" — ");
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function normalizeUrl(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

export function EditorialPortfolioTemplate({
  site,
  profile,
  experiences,
  education,
  skills,
}: EditorialPortfolioProps) {
  const accent = typeof site.design?.accent === "string" ? site.design.accent : "#b4532f";
  const intro = site.intro || profile.about || `${profile.name} is building thoughtful work and a career with clear direction.`;
  const email = profile.email || site.contactEmail;
  const firstName = profile.name.split(/\s+/).filter(Boolean)[0] || profile.name;
  const groupedSkills = skills.reduce<Record<string, typeof skills>>((groups, skill) => {
    const category = skill.category || "Core capabilities";
    groups[category] = groups[category] || [];
    groups[category].push(skill);
    return groups;
  }, {});
  const style = { "--editorial-accent": accent } as CSSProperties;
  const contacts = [
    profile.email ? { label: profile.email, href: `mailto:${profile.email}`, icon: Mail } : null,
    profile.phone ? { label: profile.phone, href: `tel:${profile.phone.replace(/\s+/g, "")}`, icon: Phone } : null,
    profile.linkedinUrl ? { label: "LinkedIn", href: normalizeUrl(profile.linkedinUrl), icon: Linkedin } : null,
    profile.githubUrl ? { label: "GitHub", href: normalizeUrl(profile.githubUrl), icon: Github } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Mail }>;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f4eee3] text-[#241f1a]" style={style}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 8%, rgba(255,255,255,.95), transparent 31%), radial-gradient(circle at 88% 18%, color-mix(in srgb, var(--editorial-accent) 20%, transparent), transparent 28%), linear-gradient(rgba(36,31,26,.035) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 100% 32px",
        }}
      />

      {site.showWatermark !== false ? (
        <Link to="/" className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f8f3ea]/90 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-xl">
          <span className="h-2 w-2 rounded-full bg-[var(--editorial-accent)]" /> Made with JobRaker
        </Link>
      ) : null}
      {site.isPreview ? (
        <div className="fixed left-1/2 top-5 z-50 -translate-x-1/2 rounded-full border border-black/10 bg-[#f8f3ea]/90 px-4 py-2 text-xs font-semibold uppercase tracking-[.18em] backdrop-blur-xl">Private preview</div>
      ) : null}

      <section id="top" className="relative mx-auto flex min-h-[100svh] max-w-[1200px] flex-col px-6 pb-10 pt-7 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4 border-b border-black/10 pb-4 text-[10px] font-semibold uppercase tracking-[.22em] text-[#756b60] sm:text-xs">
          <span>{profile.jobTitle || "Career portfolio"}</span>
          <span>{profile.location || "Remote-ready"} · {new Date().getFullYear()}</span>
        </header>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-16 lg:py-16">
          <div className="order-2 lg:order-1">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-[var(--editorial-accent)]"><Sparkles className="h-4 w-4" /> Personal issue · 01</p>
            <h1 className="max-w-[12ch] text-[clamp(3.7rem,9vw,7.8rem)] font-black leading-[.87] tracking-[-.07em]">
              Hey, I’m <span className="font-serif font-normal italic">{firstName}</span>.
            </h1>
            <p className="mt-7 max-w-2xl border-l-2 border-[var(--editorial-accent)] pl-5 text-lg leading-8 text-[#514940]">{site.headline || intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {email ? <a href={`mailto:${email}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#241f1a] px-5 text-sm font-semibold text-white">{site.ctaLabel || "Start a conversation"}<ArrowUpRight className="h-4 w-4" /></a> : null}
              <a href="#work" className="inline-flex min-h-12 items-center rounded-full border border-black/15 px-5 text-sm font-semibold">Read the story</a>
            </div>
          </div>

          <div className="order-1 mx-auto w-full max-w-sm lg:order-2 lg:justify-self-end">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-black/10 bg-white/45 shadow-[0_32px_90px_rgba(45,35,25,.16)]">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-[var(--editorial-accent)] text-7xl font-black text-white">{initials(profile.name)}</div>}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#f4eee3]/35 via-transparent to-white/20" />
              <span className="absolute bottom-4 left-4 rounded-full bg-[#f8f3ea]/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] backdrop-blur">{profile.location || "Remote-ready"}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-black/10 pt-5 text-xs text-[#756b60] sm:grid-cols-4">
          <span><b className="block text-lg text-[#241f1a]">{profile.experienceYears || 0}+</b> years</span>
          <span><b className="block text-lg text-[#241f1a]">{experiences.length}</b> roles</span>
          <span><b className="block text-lg text-[#241f1a]">{skills.length}</b> skills</span>
          <span><b className="block text-lg text-[#241f1a]">{site.views}</b> profile views</span>
        </div>
      </section>

      <div className="relative mx-auto max-w-[1200px] px-6 md:px-10 lg:px-12">
        <section id="about" className="grid gap-8 border-t border-black/15 py-12 md:grid-cols-[.7fr_1.3fr]">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--editorial-accent)]">Profile note · 02</p><h2 className="mt-4 text-4xl font-black leading-[.95] tracking-[-.05em] sm:text-5xl">The person behind the work.</h2></div>
          <div><p className="text-lg leading-8 text-[#514940]">{intro}</p>{profile.goals.length ? <div className="mt-6 flex flex-wrap gap-2">{profile.goals.slice(0, 4).map((goal) => <span key={goal} className="rounded-full border border-black/10 bg-white/35 px-3 py-2 text-xs">{goal}</span>)}</div> : null}</div>
        </section>

        <section id="work" className="border-t border-black/15 py-12">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--editorial-accent)]"><BriefcaseBusiness className="h-4 w-4" /> Selected work · 03</p>
          <div className="mt-7 border-t border-black/10">
            {experiences.length ? experiences.map((item, index) => (
              <article key={`${item.company}-${item.title}-${index}`} className="grid gap-4 border-b border-black/10 py-7 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-7">
                <span className="text-xs font-semibold text-[var(--editorial-accent)]">0{index + 1}</span>
                <div><h3 className="text-2xl font-bold tracking-[-.035em]">{item.title}</h3><p className="mt-1 text-sm text-[#756b60]">{item.company}</p>{item.description ? <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#514940]">{item.description}</p> : null}</div>
                <div className="text-xs leading-6 text-[#756b60] md:text-right"><p>{years(item.start_date, item.end_date, item.is_current)}</p><p>{item.location || "Remote"}</p></div>
              </article>
            )) : <p className="py-8 text-sm text-[#756b60]">Experience details are being curated for this portfolio.</p>}
          </div>
        </section>

        <section id="skills" className="grid gap-8 border-t border-black/15 py-12 md:grid-cols-[.72fr_1.28fr]">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--editorial-accent)]">Capability map · 04</p><h2 className="mt-4 text-4xl font-black leading-[.95] tracking-[-.05em] sm:text-5xl">Tools, strengths, and craft.</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">{Object.entries(groupedSkills).length ? Object.entries(groupedSkills).map(([category, entries]) => <article key={category} className="rounded-2xl border border-black/10 bg-white/35 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#756b60]">{category}</p><div className="mt-4 flex flex-wrap gap-2">{entries.map((skill) => <span key={`${category}-${skill.name}`} className="rounded-full border border-black/10 bg-[#f8f3ea]/70 px-3 py-1.5 text-xs">{skill.name}</span>)}</div></article>) : <p className="text-sm text-[#756b60]">Skills will appear once the profile is enriched.</p>}</div>
        </section>

        {(education.length || profile.availability.start || profile.availability.weeklyHours || profile.availability.timezone) ? (
          <section className="grid gap-4 border-t border-black/15 py-12 md:grid-cols-2">
            {education.length ? <article className="rounded-2xl border border-black/10 bg-white/35 p-6"><p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--editorial-accent)]"><GraduationCap className="h-4 w-4" /> Education</p><div className="mt-6 grid gap-5">{education.map((item, index) => <div key={`${item.school}-${index}`} className="border-t border-black/10 pt-4 first:border-0 first:pt-0"><p className="font-bold">{item.degree}</p><p className="mt-1 text-sm text-[#756b60]">{item.school}</p><p className="mt-2 text-xs text-[#756b60]">{years(item.start_date, item.end_date)}{item.location ? ` · ${item.location}` : ""}</p></div>)}</div></article> : null}
            {(profile.availability.start || profile.availability.weeklyHours || profile.availability.timezone) ? <article className="rounded-2xl border border-black/10 bg-white/35 p-6"><p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] text-[var(--editorial-accent)]"><CalendarDays className="h-4 w-4" /> Availability</p><div className="mt-6 grid gap-4">{profile.availability.start ? <p><span className="block text-[10px] uppercase tracking-[.16em] text-[#756b60]">Start</span><b className="mt-1 block">{profile.availability.start.replace(/_/g, " ")}</b></p> : null}{profile.availability.weeklyHours ? <p><span className="block text-[10px] uppercase tracking-[.16em] text-[#756b60]">Capacity</span><b className="mt-1 block">{profile.availability.weeklyHours} hrs/week</b></p> : null}{profile.availability.timezone ? <p><span className="block text-[10px] uppercase tracking-[.16em] text-[#756b60]">Timezone</span><b className="mt-1 block">{profile.availability.timezone}</b></p> : null}</div></article> : null}
          </section>
        ) : null}

        <section id="contact" className="border-t border-black/15 py-12">
          <div className="rounded-[2rem] bg-[#241f1a] p-7 text-white sm:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[var(--editorial-accent)]">Contact · 05</p>
            <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><h2 className="max-w-3xl text-4xl font-black leading-[.95] tracking-[-.05em] sm:text-6xl">Let’s put this experience to work.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-white/65">For roles, projects, and conversations where thoughtful work matters.</p></div>{email ? <a href={`mailto:${email}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--editorial-accent)] px-5 text-sm font-semibold text-white">{site.ctaLabel || "Start a conversation"}<ArrowUpRight className="h-4 w-4" /></a> : null}</div>
            {(contacts.length || site.links.length) ? <div className="mt-8 grid gap-2 border-t border-white/10 pt-6 sm:grid-cols-2">{contacts.map((item) => { const Icon = item.icon; const external = item.href.startsWith("http"); return <a key={item.href} href={item.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/75 hover:border-white/25 hover:text-white"><Icon className="h-4 w-4 text-[var(--editorial-accent)]" />{item.label}</a>; })}{site.links.slice(0, 4).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/75 hover:border-white/25 hover:text-white"><span>{item.label}</span><ArrowUpRight className="h-4 w-4 text-[var(--editorial-accent)]" /></a>)}</div> : null}
          </div>
          <footer className="flex flex-col gap-2 px-1 pt-6 text-[10px] font-semibold uppercase tracking-[.16em] text-[#756b60] sm:flex-row sm:justify-between"><span>Built with JobRaker</span><a href="#top" className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Back to cover</a></footer>
        </section>
      </div>
    </main>
  );
}
