import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import QRCode from "qrcode";
import type { EditorialPortfolioProps } from "./EditorialPortfolioTemplate";
import { initials } from "./WodniackPortfolioCore";
import "./WodniackSiteHead.css";

/**
 * Navigation ported 1:1 from AntoineW/AW-2025-Portfolio `src/components/SiteHead.astro`:
 * segmented bar (logo · typing console · menu · socials · contrast · availability · QR),
 * the console typewriter, the blink-in menu caret, and the wipe-mask contrast toggle.
 */

const MENU = [
  { id: "about", text: "About" },
  { id: "work", text: "Work" },
  { id: "contact", text: "Contact" },
];

/** Verbatim console copy from the source component. */
const MESSAGES = [
  "Preparing for inevitable debugging",
  "Compiling designer dreams…into developer nightmares",
  "Please wait while I overthink this",
  "Optimizing… but nothing’s perfect",
  "Configuring the next minor inconvenience",
  "Fetching assets… contemplating the futility of it all",
  "Re-routing your expectations… expect delays",
  "Trying to animate enthusiasm… it’s not going well",
  "Stuck in an infinite loop",
  "Loading… still pointless",
  "Simulating progress… sort of",
  "This will probably break soon",
  "Simulating something useful",
  "Progress bar full of lies",
  "Finding meaning in the code",
  "Calculating failure probabilities",
  "Please wait… indefinitely",
  "Loading… almost there!",
  "Animating pixels with love",
  "Integrating magic and code",
  "Optimizing creativity… stand by",
  "Design and code handshake",
  "Fetching creativity… almost done!",
  "Preparing awesomeness",
  "Simulating brilliance… probably",
  "Everything is under control",
  "Loading coolness… almost ready",
  "Calibrating designer dreams",
  "Fusing design and animation",
  "Running creativity protocols",
  "Crafting magic… please wait",
  "Making things pretty… hold on",
  "Loading… this might take a bit",
  "Animating pixels… somewhat precisely",
  "Integrating code and reality",
  "Halfway done… maybe",
  "Optimizing… cautiously hopeful",
  "Design meets code… fingers crossed",
  "Fetching some interesting stuff",
  "Preparing… slowly but surely",
  "Aligning pixels… carefully",
  "Calibrating… what exactly? Good question",
  "Waiting… patience is key",
  "Simulating… something, probably",
  "Loading… feel free to blink",
  "Running some clever algorithms",
  "Almost there… give or take",
  "Integrating… like a pro",
  "Crafting… without breaking anything",
  "Adjusting fonts… nearly invisible",
  "Piecing it together… stay tuned",
  "Loading… nothing to see yet",
  "Running final checks… hopefully",
  "Almost ready… trust me",
  "Building… it’s getting there",
  "Loading… but why rush?",
  "Please wait… or don’t, whatever",
  "Initializing… prepare for bugs",
  "Optimizing… but who cares?",
  "Deploying… probably not broken",
  "Making things work… hopefully",
  "Running… but not too fast",
  "Testing patience… stay calm",
  "Initializing… no promises",
  "Loading… but who’s counting?",
  "Loading… could be worse",
];

/** clip-path geometry, sized to each icon's box (source uses the same technique). */
const GITHUB_PATH =
  "M10 0.248c-5.525 0 -10 4.478 -10 10 0 4.419 2.865 8.167 6.838 9.488 0.5 0.094 0.683 -0.215 0.683 -0.481 0 -0.237 -0.008 -0.867 -0.012 -1.7 -2.782 0.603 -3.368 -1.342 -3.368 -1.342C3.685 15.058 3.028 14.75 3.028 14.75c-0.906 -0.62 0.07 -0.607 0.07 -0.607 1.004 0.07 1.532 1.03 1.532 1.03 0.892 1.529 2.341 1.088 2.913 0.832 0.09 -0.647 0.348 -1.087 0.633 -1.338 -2.221 -0.25 -4.555 -1.11 -4.555 -4.942 0 -1.092 0.388 -1.983 1.029 -2.683 -0.113 -0.252 -0.45 -1.269 0.088 -2.647 0 0 0.837 -0.268 2.75 1.025 0.8 -0.223 1.65 -0.332 2.5 -0.337 0.85 0.005 1.7 0.115 2.5 0.338 1.9 -1.293 2.738 -1.025 2.738 -1.025 0.538 1.378 0.2 2.394 0.1 2.647 0.638 0.7 1.025 1.592 1.025 2.683 0 3.842 -2.338 4.688 -4.562 4.933 0.35 0.3 0.675 0.913 0.675 1.85 0 1.338 -0.012 2.413 -0.012 2.738 0 0.263 0.175 0.575 0.688 0.475C17.138 18.41 20 14.66 20 10.248c0 -5.522 -4.477 -10 -10 -10";

const LINKEDIN_PATH =
  "M1.13025 14.9839H3.93671V4.6H1.13025V14.9839ZM2.53348 0.0161285C1.598 0.0161285 0.849609 0.764516 0.849609 1.7C0.849609 2.63548 1.598 3.38387 2.53348 3.38387C3.46896 3.38387 4.21735 2.63548 4.21735 1.7C4.21735 0.764516 3.46896 0.0161285 2.53348 0.0161285ZM8.70767 6.19032V4.6H5.90122V14.9839H8.70767V9.65161C8.70767 6.65806 12.5432 6.47097 12.5432 9.65161V14.9839H15.3496V8.62258C15.3496 3.57097 10.0174 3.75806 8.70767 6.19032Z";

const LINK_PATH =
  "M7.5 10.5a3.75 3.75 0 0 0 5.66.4l2.25-2.25a3.75 3.75 0 0 0-5.3-5.3l-1.29 1.28a.94.94 0 0 0 1.33 1.33l1.28-1.29a1.88 1.88 0 0 1 2.65 2.65l-2.25 2.25a1.88 1.88 0 0 1-2.83-.2.94.94 0 0 0-1.5 1.13ZM10.5 7.5a3.75 3.75 0 0 0-5.66-.4L2.59 9.35a3.75 3.75 0 0 0 5.3 5.3l1.29-1.28a.94.94 0 0 0-1.33-1.33l-1.28 1.29a1.88 1.88 0 0 1-2.65-2.65l2.25-2.25a1.88 1.88 0 0 1 2.83.2.94.94 0 0 0 1.5-1.13Z";

const CONTRAST_PATH =
  "M10.0996 20C8.71628 20 7.41628 19.7373 6.19961 19.212C4.98294 18.6867 3.92461 17.9743 3.02461 17.075C2.12461 16.1757 1.41228 15.1173 0.887611 13.9C0.362944 12.6827 0.100277 11.3827 0.0996106 10C0.098944 8.61733 0.361611 7.31733 0.887611 6.1C1.41361 4.88267 2.12594 3.82433 3.02461 2.925C3.92328 2.02567 4.98161 1.31333 6.19961 0.788C7.41761 0.262667 8.71761 0 10.0996 0C11.4816 0 12.7816 0.262667 13.9996 0.788C15.2176 1.31333 16.2759 2.02567 17.1746 2.925C18.0733 3.82433 18.7859 4.88267 19.3126 6.1C19.8393 7.31733 20.1016 8.61733 20.0996 10C20.0976 11.3827 19.8349 12.6827 19.3116 13.9C18.7883 15.1173 18.0759 16.1757 17.1746 17.075C16.2733 17.9743 15.2149 18.687 13.9996 19.213C12.7843 19.739 11.4843 20.0013 10.0996 20ZM11.0996 17.925C13.0829 17.675 14.7456 16.804 16.0876 15.312C17.4296 13.82 18.1003 12.0493 18.0996 10C18.0989 7.95067 17.4279 6.18 16.0866 4.688C14.7453 3.196 13.0829 2.325 11.0996 2.075V17.925Z";

type WodniackSiteHeadProps = {
  site: EditorialPortfolioProps["site"];
  profile: EditorialPortfolioProps["profile"];
  contrasted: boolean;
  onToggleContrast: () => void;
  /** Delay (ms) before the intro timeline runs, so it lands as the intro curtain lifts. */
  introDelay?: number;
};

export function WodniackSiteHead({
  site,
  profile,
  contrasted,
  onToggleContrast,
  introDelay = 0,
}: WodniackSiteHeadProps) {
  const headRef = useRef<HTMLElement | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<HTMLDivElement | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const email = profile.email || site.contactEmail;
  const mailto = email ? `mailto:${email}` : "#contact";
  const socialLinks = [
    profile.githubUrl
      ? { key: "github", url: profile.githubUrl, label: "GitHub", modifier: "github", path: GITHUB_PATH }
      : null,
    profile.linkedinUrl
      ? { key: "linkedin", url: profile.linkedinUrl, label: "LinkedIn", modifier: "linkedin", path: LINKEDIN_PATH }
      : null,
    ...site.links.slice(0, 2).map((link) => ({
      key: link.url,
      url: link.url.startsWith("http") ? link.url : `https://${link.url}`,
      label: link.label,
      modifier: "link",
      path: LINK_PATH,
    })),
  ]
    .filter((link): link is NonNullable<typeof link> => Boolean(link))
    .slice(0, 2);

  /* Intro — same offsets, durations and eases as the source timeline. */
  useEffect(() => {
    const head = headRef.current;
    if (!head) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(head, { opacity: 1 });
      head.dataset.canWrite = "true";
      return;
    }

    const logo = head.querySelector(".wdk-sb-logo");
    const menuItems = head.querySelectorAll(".wdk-sb-menu .wdk-sb__item");
    const qr = head.querySelector(".wdk-sb-qr-code");
    const items = [logo, ...Array.from(menuItems)].filter(Boolean);

    const tl = gsap.timeline({ delay: introDelay / 1000 });

    tl.set(head, { opacity: 1 });
    tl.from(head, { y: "-100%", duration: 1.5, ease: "expo.inOut" }, 1);
    tl.from(items, { y: "-100%", duration: 1.5, ease: "expo.out", stagger: 0.1 }, 1.5);

    if (qr) {
      tl.fromTo(qr, { "--bg-p": "0%" }, { "--bg-p": "100%", duration: 1.5, ease: "expo.out" }, 1.75);
    }

    tl.call(() => { head.dataset.canWrite = "true"; }, undefined, 1.5);

    return () => { tl.kill(); };
  }, [introDelay]);

  /* Console typewriter — verbatim timing rules, paused while the head is off-screen. */
  useEffect(() => {
    const head = headRef.current;
    const target = consoleRef.current;
    if (!head || !target) return;

    let message = "";
    let messageLineBreak = false;
    let lastMessage = "";
    let lastTypeTime = 0;
    let writeDelay = 0;
    let isPaused = false;
    let frame = 0;

    const getRandomMessage = (): string => {
      let next = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      if (next === lastMessage) next = getRandomMessage();
      lastMessage = next;
      return next;
    };

    const update = (time: number) => {
      frame = window.requestAnimationFrame(update);
      if (isPaused || head.dataset.canWrite !== "true") return;
      if (time - lastTypeTime < writeDelay) return;

      if (message === "") {
        message = getRandomMessage();
        writeDelay = 2000;
      } else {
        if (message === lastMessage || messageLineBreak) {
          target.textContent += "\n";
        }

        const char = message.charAt(0);
        message = message.substring(1);

        if (char === "," || char === " ") {
          writeDelay = 100;
        } else if (char === "") {
          writeDelay = 200;
        } else if (char === "…" || char === ".") {
          writeDelay = 400;
        } else {
          writeDelay = 20;
        }

        target.textContent += char;
        messageLineBreak = char === "…";
      }

      target.textContent = target.textContent.split("\n").slice(-5).join("\n");
      lastTypeTime = time;
    };

    const observer = new IntersectionObserver(([entry]) => {
      isPaused = !entry.isIntersecting;
    });
    observer.observe(head);

    frame = window.requestAnimationFrame(update);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  /* QR code standing in for the source's static /images/qr-code.svg. */
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(email ? mailto : window.location.href, {
      margin: 0,
      width: 144,
      color: { dark: "#160000ff", light: "#00000000" },
    })
      .then((url) => { if (!cancelled) setQrCode(url); })
      .catch(() => { if (!cancelled) setQrCode(null); });
    return () => { cancelled = true; };
  }, [email, mailto]);

  /* Contrast wipe — the source's fromTo mask sweep, with the flip at the same moment. */
  const toggleContrast = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) {
      onToggleContrast();
      return;
    }

    const fromX = contrasted ? "-100%" : "0";
    const toX = contrasted ? "0" : "-100%";

    gsap.fromTo(
      mask,
      { x: fromX },
      {
        x: toX,
        duration: 1,
        ease: "expo.inOut",
        onComplete: () => {
          mask.style.transform = "";
          if (toX === "0") onToggleContrast();
        },
      },
    );

    if (toX !== "0") onToggleContrast();
  }, [contrasted, onToggleContrast]);

  const moveToSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <header className="wdk-site-head" ref={headRef}>
        <div className="wdk-site-head__container">
          <a href="#top" className="wdk-sb-logo" onClick={(event) => moveToSection(event, "top")}>
            <svg width="280" height="280" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text
                x="140"
                y="140"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif"
                fontSize="200"
                letterSpacing="-12"
              >
                {initials(profile.name)}
              </text>
            </svg>

            <span className="wdk-sr-only">{profile.name}</span>
          </a>

          <div className="wdk-sb-console" role="presentation">
            <div className="wdk-sb-console__inner" ref={consoleRef} />
          </div>

          <nav className="wdk-sb-menu" aria-label="Portfolio sections">
            <ul className="wdk-sb__list">
              {MENU.map((item) => (
                <li className="wdk-sb__item" key={item.id}>
                  <a href={`#${item.id}`} onClick={(event) => moveToSection(event, item.id)}>
                    <span className="wdk-sb__text">{item.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {socialLinks.length ? (
            <ul className="wdk-sb-socials">
              {socialLinks.map((link) => (
                <li className="wdk-sb__item" key={link.key}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <span
                      className={`wdk-sb__icon wdk-sb__icon--${link.modifier}`}
                      style={{ "--path": `path('${link.path}')` } as React.CSSProperties}
                    />

                    <span className="wdk-sr-only">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <button className="wdk-sb-contrast" type="button" onClick={toggleContrast} aria-pressed={!contrasted}>
            <span
              className="wdk-sb__icon"
              style={{ "--path": `path('${CONTRAST_PATH}')` } as React.CSSProperties}
            />

            <span className="wdk-sr-only">Change contrast</span>
          </button>

          <aside className="wdk-sb-availability">
            <p>
              <span className="wdk-sb__line">
                <span className="wdk-sb__text">
                  {profile.location ? `Working globally from ${profile.location}.` : "Working globally, remote-ready."}
                </span>
              </span>

              <span className="wdk-sb__line">
                <span className="wdk-sb__text">Available for new opportunities →</span>

                <a href={mailto} className="wdk-sb__link">
                  {site.ctaLabel || "Hire me"}
                </a>
              </span>
            </p>
          </aside>

          {qrCode ? (
            <a href={mailto} className="wdk-sb-qr-code" title="Contact me!">
              <img src={qrCode} alt="QR Code" width={72} height={72} />
            </a>
          ) : null}
        </div>
      </header>

      <div className="wdk-contrast-mask" ref={maskRef} aria-hidden />
    </>
  );
}
