import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutreachActionType, OutreachChannel } from "./types";
import { FOLLOW_UP_MIN_DAYS } from "./types";

export interface OutreachInteractionRecord {
  id: string;
  userId: string;
  jobId?: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  actionType: OutreachActionType;
  channel: OutreachChannel;
  status: "drafted" | "sent" | "waiting" | "replied" | "followup_due";
  providerDraftId?: string;
  providerMessageId?: string;
  contactedAt: string;
  repliedAt?: string;
  recruiterReplied: boolean;
  followUpDueAt?: string;
}

/**
 * Fetches recent outreach interactions for an opportunity or candidate.
 * Queries cold_mail_drafts and applications to construct relationship history.
 */
export async function getOutreachHistoryForJob(
  supabase: SupabaseClient,
  userId: string,
  jobId?: string,
  recipientEmail?: string,
): Promise<OutreachInteractionRecord[]> {
  if (!userId) return [];

  try {
    let query = supabase
      .from("cold_mail_drafts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (jobId) {
      query = query.eq("job_id", jobId);
    }
    if (recipientEmail) {
      query = query.eq("recipient_email", recipientEmail.toLowerCase().trim());
    }

    const { data: drafts, error } = await query.limit(20);
    if (error || !drafts) {
      return [];
    }

    return drafts.map((d: any) => {
      const contactedTime = d.sent_at || d.created_at;
      const followUpDue = new Date(new Date(contactedTime).getTime() + FOLLOW_UP_MIN_DAYS * 24 * 60 * 60 * 1000).toISOString();

      return {
        id: d.id,
        userId: d.user_id,
        jobId: d.job_id,
        recipientEmail: d.recipient_email,
        recipientName: d.draft_from || undefined,
        subject: d.subject,
        actionType: "recruiter_intro",
        channel: "gmail",
        status: d.sent_at ? "sent" : "drafted",
        providerDraftId: d.provider_draft_id,
        providerMessageId: d.provider_message_id,
        contactedAt: contactedTime,
        recruiterReplied: false,
        followUpDueAt: followUpDue,
      };
    });
  } catch (err) {
    console.warn("Error fetching outreach history:", err);
    return [];
  }
}

/**
 * Checks if a specific recruiter or email address has already been contacted recently.
 */
export async function checkContactCooldown(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  cooldownDays: number = FOLLOW_UP_MIN_DAYS,
): Promise<{ inCooldown: boolean; lastContactedAt?: string; daysRemaining?: number }> {
  if (!email || !userId) return { inCooldown: false };

  try {
    const { data: recent } = await supabase
      .from("cold_mail_drafts")
      .select("created_at, sent_at")
      .eq("user_id", userId)
      .eq("recipient_email", email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recent) return { inCooldown: false };

    const lastTime = new Date(recent.sent_at || recent.created_at).getTime();
    const elapsedDays = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);

    if (elapsedDays < cooldownDays) {
      return {
        inCooldown: true,
        lastContactedAt: new Date(lastTime).toISOString(),
        daysRemaining: Math.ceil(cooldownDays - elapsedDays),
      };
    }

    return { inCooldown: false, lastContactedAt: new Date(lastTime).toISOString() };
  } catch (err) {
    return { inCooldown: false };
  }
}
