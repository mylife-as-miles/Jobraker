import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileText,
  Github,
  Globe2,
  Linkedin,
  Mail,
} from "lucide-react";

export type PendingPermissionRequest = {
  integrationSlug: string;
  integrationName: string;
  toolName: string;
  toolSummary: string;
  icon?: string;
  resolve: (decision: "allow_always" | "allow_once" | "deny") => void;
};

type Props = {
  request: PendingPermissionRequest | null;
  onRespond: (decision: "allow_always" | "allow_once" | "deny") => void;
};

export const IntegrationPermissionModal: React.FC<Props> = ({
  request,
  onRespond,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!request) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRespond("deny");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onRespond, request]);

  useEffect(() => {
    setShowOptions(false);
    setShowDetails(false);
  }, [request?.integrationSlug]);

  if (!request) return null;

  const { integrationName, toolSummary } = request;
  const name = integrationName.toLowerCase();
  const IntegrationIcon = name.includes("github")
    ? Github
    : name.includes("mail")
      ? Mail
      : name.includes("linkedin")
        ? Linkedin
        : name.includes("calendar") || name.includes("cal.com")
          ? CalendarDays
          : name.includes("drive") || name.includes("docs")
            ? FileText
            : Globe2;

  const allow = (decision: "allow_always" | "allow_once") => {
    setShowOptions(false);
    onRespond(decision);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
    >
      <section
        aria-labelledby="integration-permission-title"
        aria-modal="true"
        className="w-full max-w-5xl overflow-visible rounded-[30px] border border-zinc-800 bg-black text-zinc-100 shadow-2xl shadow-black/90"
        role="dialog"
      >
        <div className="px-7 pb-6 pt-7 sm:px-8">
          <div className="flex items-center gap-2.5 text-[19px] font-normal text-zinc-400">
            <IntegrationIcon aria-hidden="true" className="h-6 w-6 text-zinc-100" />
            <span>{integrationName}</span>
          </div>

          <h2
            className="mt-5 text-xl font-semibold tracking-[-0.02em] text-white sm:text-[21px]"
            id="integration-permission-title"
          >
            Use {integrationName} for this request?
          </h2>

          <p className="mt-3 max-w-4xl text-[17px] leading-7 text-zinc-400">
            JobRaker will use {integrationName} to help answer your request.
            Any content it uses may be shown in this chat.
            <button
              aria-expanded={showDetails}
              className="ml-1.5 inline underline underline-offset-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              onClick={() => setShowDetails((current) => !current)}
              type="button"
            >
              {showDetails ? "Hide details" : "See details"}
            </button>
          </p>

          {showDetails ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3.5 text-sm leading-6 text-zinc-300">
              <CircleHelp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <p>
                JobRaker is requesting access for <span className="font-medium text-white">{toolSummary}</span>.
                Choosing <span className="font-medium text-white">Always allow</span> remembers this choice for {integrationName};
                <span className="font-medium text-white"> Allow this time</span> applies only to the current chat session.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-800/80 px-7 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => onRespond("deny")}
            className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Deny
          </button>

          <div className="relative inline-flex overflow-visible rounded-full bg-zinc-100 text-zinc-950 shadow-sm">
            <button
              type="button"
              onClick={() => allow("allow_always")}
              className="rounded-l-full px-5 py-2 text-sm font-semibold transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Allow
            </button>
            <button
              aria-expanded={showOptions}
              aria-haspopup="menu"
              aria-label="Choose permission duration"
              className="rounded-r-full border-l border-zinc-300 px-3 py-2 transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              onClick={() => setShowOptions((current) => !current)}
              type="button"
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </button>

            {showOptions ? (
              <div
                className="absolute bottom-[calc(100%+0.5rem)] right-0 z-10 w-52 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 text-zinc-100 shadow-2xl"
                role="menu"
              >
                <button
                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-800 focus-visible:outline-none"
                  onClick={() => allow("allow_once")}
                  role="menuitem"
                  type="button"
                >
                  Allow this time
                </button>
                <button
                  className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-800 focus-visible:outline-none"
                  onClick={() => allow("allow_always")}
                  role="menuitem"
                  type="button"
                >
                  Always allow {integrationName}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};
