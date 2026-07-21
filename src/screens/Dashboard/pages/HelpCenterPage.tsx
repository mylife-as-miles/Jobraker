import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  CircleHelp,
  FileText,
  Link2,
  Mail,
  MessageSquare,
  PlayCircle,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import resumeBuilderScreenshot from "../../../../verification_resume_builder.png";
import applicationsScreenshot from "../../../../.codex-applications-page.png";

type HelpGuide = {
  title: string;
  description: string;
  route: string;
  tourPage?: string;
  icon: typeof Briefcase;
  steps: string[];
  troubleshooting: string[];
  media?: {
    type: "image" | "video";
    src: string;
    alt: string;
    caption: string;
  };
};

const GUIDES: HelpGuide[] = [
  {
    title: "Set up your profile",
    description: "Add your experience, skills, availability, and professional links.",
    route: "/dashboard/profile",
    tourPage: "profile",
    icon: UserRound,
    steps: ["Complete personal details", "Add experience and skills", "Review your public profile"],
    troubleshooting: ["Save each section before leaving the page.", "Reconnect GitHub or LinkedIn from Settings if imported details are stale."],
  },
  {
    title: "Connect your accounts",
    description: "Connect Gmail, GitHub, or LinkedIn and verify synchronization.",
    route: "/dashboard/settings/integrations",
    tourPage: "settings",
    icon: Link2,
    steps: ["Choose an integration", "Complete authorization", "Confirm the connected status"],
    troubleshooting: ["Keep the authorization popup open until JobRaker confirms completion.", "If sync partly fails, retry only the provider shown as failed."],
  },
  {
    title: "Find and save jobs",
    description: "Search for fresh roles, review matches, and organize your shortlist.",
    route: "/dashboard/jobs",
    tourPage: "jobs",
    icon: Briefcase,
    steps: ["Set search criteria", "Review new matches", "Save the roles worth pursuing"],
    troubleshooting: ["Broaden location or title filters when no new matches are available.", "Previously viewed jobs are intentionally not presented as new results."],
  },
  {
    title: "Start automatic applications",
    description: "Queue controlled applications and understand every processing state.",
    route: "/dashboard/jobs",
    tourPage: "jobs",
    icon: Sparkles,
    steps: ["Select eligible jobs", "Review application details", "Track queue progress"],
    troubleshooting: ["A queued request can take time to reach a worker.", "If a request fails terminally, verify that its credits and quota were restored."],
  },
  {
    title: "Build application documents",
    description: "Create resumes and cover letters from your JobRaker profile.",
    route: "/dashboard/account",
    tourPage: "resume",
    icon: FileText,
    steps: ["Choose a document", "Start from your profile", "Review, save, and export"],
    troubleshooting: ["Use Refresh from profile to preview changes before replacing edits.", "Keep the editor open until the saved status is visible before switching documents."],
    media: {
      type: "image",
      src: resumeBuilderScreenshot,
      alt: "JobRaker resume builder with editor controls and document preview",
      caption: "Resume Builder: edit profile-backed sections and review the live document preview.",
    },
  },
  {
    title: "Import LinkedIn connections",
    description: "Preview, validate, and privately import your Connections.csv export.",
    route: "/dashboard/referrals",
    icon: Upload,
    steps: ["Request your LinkedIn export", "Review detected contacts", "Confirm the private import"],
    troubleshooting: ["Use LinkedIn's Connections.csv file, not the full archive ZIP.", "Map unfamiliar column names in the preview before confirming the import."],
  },
  {
    title: "Track applications",
    description: "Keep statuses, follow-ups, and interviews current in one pipeline.",
    route: "/dashboard/application",
    tourPage: "application",
    icon: Mail,
    steps: ["Review the pipeline", "Update an application", "Schedule the next action"],
    troubleshooting: ["Clear active filters if an application appears missing.", "Use the next-action date for reminders rather than changing the application status."],
    media: {
      type: "image",
      src: applicationsScreenshot,
      alt: "JobRaker applications pipeline",
      caption: "Applications: review status, follow-ups, and pipeline activity from one workspace.",
    },
  },
];

export const HelpCenterPage = () => {
  const navigate = useNavigate();
  const guides = useMemo(() => GUIDES, []);
  const [selectedGuide, setSelectedGuide] = useState<HelpGuide | null>(null);

  const openGuide = (guide: HelpGuide, startTour = false) => {
    const query = startTour && guide.tourPage ? "?tour=1" : "";
    navigate(`${guide.route}${query}`);
  };

  return (
    <div className="product-page-shell min-h-full">
      <Modal
        open={Boolean(selectedGuide)}
        onClose={() => setSelectedGuide(null)}
        title={selectedGuide?.title || "Task guide"}
        size="lg"
        footer={
          selectedGuide ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {selectedGuide.tourPage ? (
                <Button variant="outline" onClick={() => openGuide(selectedGuide, true)}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Start walkthrough
                </Button>
              ) : null}
              <Button onClick={() => openGuide(selectedGuide)}>
                Open feature <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : null
        }
      >
        {selectedGuide ? (
          <div className="space-y-6 py-2">
            {selectedGuide.media ? (
              <figure className="overflow-hidden rounded-xl border border-border/50 bg-foreground/[0.03]">
                {selectedGuide.media.type === "image" ? (
                  <img
                    src={selectedGuide.media.src}
                    alt={selectedGuide.media.alt}
                    className="max-h-72 w-full object-cover object-top"
                  />
                ) : (
                  <video
                    src={selectedGuide.media.src}
                    aria-label={selectedGuide.media.alt}
                    className="max-h-72 w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  />
                )}
                <figcaption className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {selectedGuide.media.caption}
                </figcaption>
              </figure>
            ) : null}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {selectedGuide.description}
            </p>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Walkthrough</h3>
              <ol className="space-y-3">
                {selectedGuide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                      {index + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-xl border border-border/50 bg-foreground/[0.03] p-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">If something goes wrong</h3>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {selectedGuide.troubleshooting.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </Modal>
      <div className="mx-auto w-full max-w-6xl space-y-8 p-4 pb-24 sm:p-6 lg:p-8">
        <section className="rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/10 via-card to-card p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand">
                <CircleHelp className="h-5 w-5" /> JobRaker Help Center
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                What do you want to accomplish?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Follow a short task guide, launch the relevant walkthrough, or ask support for help with your current situation.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => window.dispatchEvent(new Event("jobraker:open-support"))}
              className="shrink-0"
            >
              <MessageSquare className="mr-2 h-4 w-4" /> Ask support
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Task guides</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guides.map((guide) => {
              const Icon = guide.icon;
              return (
                <Card key={guide.title} className="product-section-card flex h-full flex-col p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{guide.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
                  <ol className="my-4 space-y-2 text-xs text-muted-foreground">
                    {guide.steps.map((step, index) => (
                      <li key={step} className="flex gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-[10px] font-semibold text-foreground">{index + 1}</span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setSelectedGuide(guide)}>
                      Read guide <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                    {guide.tourPage ? (
                      <Button size="sm" variant="outline" onClick={() => openGuide(guide, true)}>
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Walkthrough
                      </Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpCenterPage;
