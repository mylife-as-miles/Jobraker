/**
 * Typed view of `applications.provider_run_output` when populated by the
 * auto-apply workflow (Skyvern block outputs). Fields are optional because
 * the same column may hold a raw webhook body or run API object.
 */

export interface AutoApplyResumeOutput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  linkedin?: string | null;
  education?: string[];
  skills?: string[];
  experience?: string[];
}

export interface AutoApplyUserInformationOutput {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  address?: string | null;
  skills?: string[];
  experience_summary?: string | null;
  education?: string[];
}

export interface SkyvernBlockTaskOutput<T = unknown> {
  task_id?: string;
  status?: string;
  extracted_information?: T | null;
  failure_reason?: string | null;
  errors?: unknown[];
  failure_category?: string | null;
  downloaded_files?: unknown[];
  downloaded_file_urls?: unknown;
  task_screenshots?: string[] | null;
  workflow_screenshots?: string[] | null;
  task_screenshot_artifact_ids?: string[];
  workflow_screenshot_artifact_ids?: string[];
  summary?: string;
}

export interface AutoApplyExtractedJobInfo {
  company_name?: string;
  job_title?: string;
  job_description?: string;
}

export interface AutoApplyJobApplicationExtracted {
  application_status?: string;
  submission_confirmed?: boolean;
  confirmation_message?: string | null;
  submitted_at?: string;
  job?: { title?: string; company?: string };
  candidate?: Record<string, unknown>;
  application_data_used?: Record<string, unknown>;
  termination_reason?: string | null;
}

export interface AutoApplyWorkflowOutput {
  resume_output?: AutoApplyResumeOutput;
  user_information_output?: AutoApplyUserInformationOutput;
  url_output?: SkyvernBlockTaskOutput;
  extract_job_info_output?: SkyvernBlockTaskOutput<AutoApplyExtractedJobInfo>;
  generate_cover_letter_output?: { llm_response?: string };
  auto_apply_job_output?: SkyvernBlockTaskOutput<AutoApplyJobApplicationExtracted>;
  job_summary_output?: { llm_response?: string };
  email_notification_output?: { success?: boolean };
  wait_between_jobs_output?: { success?: boolean };
  for_each_job_output?: unknown[][];
  extracted_information?: unknown[];
}
