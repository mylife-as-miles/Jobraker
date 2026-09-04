import { describe, expect, it } from "vitest";
import {
  formatAsFirstPersonUserQuestion,
  normalizeFollowUpQuestions,
} from "./followUpQuestions";

describe("followUpQuestions", () => {
  describe("formatAsFirstPersonUserQuestion", () => {
    it("converts 'Would you like me to try sending this again...' to first-person user query", () => {
      const input =
        "Would you like me to try sending this again in a few hours once the limit refreshes?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you try sending this again in a few hours once the limit refreshes?",
      );
    });

    it("converts 'Should I generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?'", () => {
      const input =
        "Should I generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?",
      );
    });

    it("converts 'Do you want me to search for jobs matching your profile?' and replaces possessive", () => {
      const input = "Do you want me to search for jobs matching your profile?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you search for jobs matching my profile?",
      );
    });

    it("converts 'Shall I tailor your resume for this role?'", () => {
      const input = "Shall I tailor your resume for this role?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you tailor my resume for this role?",
      );
    });

    it("converts 'Would you like to see interview questions for this position?'", () => {
      const input = "Would you like to see interview questions for this position?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you show me interview questions for this position?",
      );
    });

    it("converts 'Would you like me to draft a follow-up email for you?' and replaces pronouns", () => {
      const input = "Would you like me to draft a follow-up email for you?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you draft a follow-up email for me?",
      );
    });

    it("converts 'I can help you prepare for the upcoming technical interview.'", () => {
      const input =
        "I can help you prepare for the upcoming technical interview.";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you help me prepare for the upcoming technical interview?",
      );
    });

    it("preserves already well-formed user questions", () => {
      const input =
        "Can you search for remote software engineering roles in New York?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you search for remote software engineering roles in New York?",
      );
    });

    it("preserves 'What are the key requirements for this position?'", () => {
      const input = "What are the key requirements for this position?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "What are the key requirements for this position?",
      );
    });

    it("handles bullet points and leading numbering", () => {
      const input = "1. Would you like me to refine the summary?";
      expect(formatAsFirstPersonUserQuestion(input)).toBe(
        "Can you refine the summary?",
      );
    });
  });

  describe("normalizeFollowUpQuestions", () => {
    it("normalizes array of questions and strips duplicates", () => {
      const raw = [
        "Would you like me to try sending this again in a few hours once the limit refreshes?",
        "Should I generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?",
        "would you like me to try sending this again in a few hours once the limit refreshes?",
      ];

      const result = normalizeFollowUpQuestions(raw, 2);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(
        "Can you try sending this again in a few hours once the limit refreshes?",
      );
      expect(result[1]).toBe(
        "Can you generate a more detailed cover letter tailored specifically to Startrz Ai's recent projects?",
      );
    });

    it("handles { questions: [...] } envelope object", () => {
      const envelope = {
        questions: [
          "Shall I tailor your resume for this role?",
          "Can you search for jobs at Stripe?",
        ],
      };
      const result = normalizeFollowUpQuestions(envelope);
      expect(result).toEqual([
        "Can you tailor my resume for this role?",
        "Can you search for jobs at Stripe?",
      ]);
    });
  });
});
