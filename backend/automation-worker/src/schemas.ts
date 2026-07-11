import { z } from "zod";
import type { NormalizedApplicationResult } from "./types.js";

export const RtrvrApplicationResultSchema = z.object({
  status: z.enum(["completed", "prepared", "waiting_for_user", "failed"]),
  submitted: z.boolean(),
  submissionEvidence: z
    .object({
      confirmationText: z.string().optional(),
      confirmationNumber: z.string().optional(),
      finalUrl: z.string().url().optional(),
    })
    .optional(),
  fieldsFilled: z.array(
    z.object({
      label: z.string(),
      valueType: z.string(),
      status: z.enum(["filled", "skipped", "unknown", "failed"]),
    }),
  ),
  unansweredQuestions: z.array(
    z.object({
      question: z.string(),
      reason: z.string(),
      options: z.array(z.string()).optional(),
    }),
  ),
  blockers: z.array(
    z.object({
      type: z.enum([
        "captcha",
        "totp",
        "login",
        "legal_question",
        "missing_information",
        "upload_failure",
        "unsupported_page",
        "other",
      ]),
      message: z.string(),
    }),
  ),
  screenshots: z.array(z.string()).optional(),
  summary: z.string(),
}) satisfies z.ZodType<NormalizedApplicationResult>;

export const RTRVR_APPLICATION_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "submitted",
    "fieldsFilled",
    "unansweredQuestions",
    "blockers",
    "summary",
  ],
  properties: {
    status: {
      type: "string",
      enum: ["completed", "prepared", "waiting_for_user", "failed"],
    },
    submitted: { type: "boolean" },
    submissionEvidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        confirmationText: { type: "string" },
        confirmationNumber: { type: "string" },
        finalUrl: { type: "string" },
      },
    },
    fieldsFilled: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "valueType", "status"],
        properties: {
          label: { type: "string" },
          valueType: { type: "string" },
          status: {
            type: "string",
            enum: ["filled", "skipped", "unknown", "failed"],
          },
        },
      },
    },
    unansweredQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "reason"],
        properties: {
          question: { type: "string" },
          reason: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
      },
    },
    blockers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "message"],
        properties: {
          type: {
            type: "string",
            enum: [
              "captcha",
              "totp",
              "login",
              "legal_question",
              "missing_information",
              "upload_failure",
              "unsupported_page",
              "other",
            ],
          },
          message: { type: "string" },
        },
      },
    },
    screenshots: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
} as const;

export function parseRtrvrApplicationResult(
  value: unknown,
): NormalizedApplicationResult {
  return RtrvrApplicationResultSchema.parse(value);
}
