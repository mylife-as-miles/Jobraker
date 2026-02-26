import { createClient } from "../../lib/supabaseClient";

export interface ScheduleInterviewParams {
  emailText: string;
  applicantName?: string;
  companyName?: string;
}

export interface ScheduleInterviewResponse {
  booking_link: string | null;
  suggested_reply: string;
}

export const scheduleInterviewViaEdge = async (
  params: ScheduleInterviewParams
): Promise<ScheduleInterviewResponse> => {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("schedule-interview", {
    body: params,
  });

  if (error) {
    throw new Error(error.message || "Failed to schedule interview");
  }

  // Gemini output contains literal markdown JSON fences sometimes
  let parsed = data;
  if (typeof parsed === 'string') {
    try {
        const cleaned = parsed.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(cleaned);
    } catch (e) {
        // fail silently, proceed
    }
  }

  return parsed as ScheduleInterviewResponse;
};
