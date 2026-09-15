import React from "react";
import type { ColdMailOutput } from "@/lib/chatSkills/types";
import { OutreachReviewCard } from "./OutreachReviewCard";
import type { OutreachPackage } from "@/lib/outreach/types";

type Props = {
  output: ColdMailOutput;
};

/**
 * Backwards-compatible adapter that adapts legacy ColdMailOutput to OutreachReviewCard.
 */
export const ColdMailSkillCard: React.FC<Props> = ({ output }) => {
  const { preparation } = output;

  const pkg: OutreachPackage = {
    version: 1,
    id: output.runId || "cold-mail-run",
    userId: preparation.userId || "",
    opportunity: {
      jobId: preparation.jobId || "",
      companyName: preparation.companyName,
      jobTitle: preparation.jobTitle,
    },
    contact: {
      name: preparation.recipient.name,
      title: preparation.recipient.title,
      company: preparation.companyName,
      email: preparation.recipient.email,
      roleKind: "recruiter",
      verification: "source_verified",
      confidence: preparation.recipient.confidence === "high" ? 0.95 : 0.8,
      provenance: {
        sourceType: preparation.recipient.source,
        sourceUrl: preparation.recipient.source,
        checkedAt: new Date().toISOString(),
      },
      selectionReasons: [
        "Identified as active talent partner for target role",
        "Verified company work email",
      ],
    },
    candidateEvidence: [],
    applicationContext: {
      stage: "discovered",
    },
    relationshipContext: {
      previousMessages: 0,
      recruiterReplied: false,
    },
    strategy: {
      action: "recruiter_intro",
      tone: "conversational_professional",
      objective: "Establish early dialogue and introduce relevant candidate profile.",
      CTA: "Ask for a brief conversation or best channel for materials.",
    },
    message: {
      subject: preparation.subject,
      body: preparation.body,
    },
    delivery: {
      channel: "gmail",
      mode: "review",
      allowedToSend: false,
    },
    recommendation: {
      score: 90,
      reasons: ["Target opportunity detected with verified contact"],
      blockedReasons: [],
    },
    state: "ready_for_review",
    createdAt: new Date().toISOString(),
    signedPreparationToken: output.preparationToken,
  };

  return <OutreachReviewCard outreachPackage={pkg} />;
};
