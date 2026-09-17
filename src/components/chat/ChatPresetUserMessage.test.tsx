import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ChatPresetUserMessage,
  parsePresetPrompt,
} from "./ChatPresetUserMessage";

describe("parsePresetPrompt", () => {
  it("returns null when content does not contain preset marker", () => {
    expect(parsePresetPrompt("Hello, please help me find a job.")).toBeNull();
    expect(parsePresetPrompt("")).toBeNull();
  });

  it("parses 1-Click Recruiter Cold Outreach Preset correctly", () => {
    const prompt = `🎯 **1-Click Recruiter Cold Outreach Preset**

Please execute an autonomous recruiter cold outreach workflow for the following target positions:
1. **Canary Technologies Corp** - QA Automation Engineer
2. **Circle** - Senior Systems Engineer

**Outreach Configuration**:
- **Tone**: Startup Casual & Authentic
- **Step 1**: Pull verified recruiter emails
- **Step 2**: Craft outreach pitches
- **Step 3**: Prepare drafts in Gmail`;

    const parsed = parsePresetPrompt(prompt);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("1-Click Recruiter Cold Outreach");
    expect(parsed?.presetType).toBe("outreach");
    expect(parsed?.tone).toBe("Startup Casual & Authentic");
    expect(parsed?.targets).toHaveLength(2);
    expect(parsed?.targets[0]).toEqual({
      index: 1,
      company: "Canary Technologies Corp",
      title: "QA Automation Engineer",
    });
    expect(parsed?.targets[1]).toEqual({
      index: 2,
      company: "Circle",
      title: "Senior Systems Engineer",
    });
  });

  it("parses Instant Job Pitch & Cover Letter Preset correctly", () => {
    const prompt = `🎯 **Instant Job Pitch & Cover Letter Preset**

Please generate role-tailored introductory pitches for:
1. **Stripe** - Staff Software Engineer

**Configuration**:
- **Tone**: Executive Bold & High-Agency`;

    const parsed = parsePresetPrompt(prompt);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Instant Job Pitch & Cover Letter");
    expect(parsed?.presetType).toBe("pitch");
    expect(parsed?.tone).toBe("Executive Bold & High-Agency");
    expect(parsed?.targets).toHaveLength(1);
    expect(parsed?.targets[0]).toEqual({
      index: 1,
      company: "Stripe",
      title: "Staff Software Engineer",
    });
  });

  it("parses Application Follow-Up Bump Preset correctly", () => {
    const prompt = `🎯 **Application Follow-Up Bump Preset**

Please prepare polite, strategic follow-up outreach messages for:
1. **Linear** - Product Designer

**Configuration**:
- **Follow-Up Strategy**: Friendly & Professional Nudge`;

    const parsed = parsePresetPrompt(prompt);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe("Application Follow-Up Bump");
    expect(parsed?.presetType).toBe("followup");
    expect(parsed?.tone).toBe("Friendly & Professional Nudge");
    expect(parsed?.targets).toHaveLength(1);
    expect(parsed?.targets[0]).toEqual({
      index: 1,
      company: "Linear",
      title: "Product Designer",
    });
  });
});

describe("ChatPresetUserMessage Component", () => {
  const samplePrompt = `🎯 **1-Click Recruiter Cold Outreach Preset**

Please execute an autonomous recruiter cold outreach workflow for the following target positions:
1. **Canary Technologies Corp** - QA Automation Engineer

**Outreach Configuration**:
- **Tone**: Startup Casual & Authentic
- **Step 1**: Pull verified recruiter emails
- **Step 2**: Craft outreach pitches
- **Step 3**: Prepare drafts in Gmail`;

  it("renders a clean summary card without showing raw prompt text by default", () => {
    render(<ChatPresetUserMessage content={samplePrompt} />);

    // Renders title and badges
    expect(screen.getByText("1-Click Recruiter Cold Outreach")).toBeInTheDocument();
    expect(screen.getByText("Preset")).toBeInTheDocument();
    expect(screen.getByText("Startup Casual & Authentic")).toBeInTheDocument();

    // Renders target job
    expect(screen.getByText("Canary Technologies Corp")).toBeInTheDocument();
    expect(screen.getByText(/QA Automation Engineer/)).toBeInTheDocument();

    // Raw prompt instructions should NOT be visible initially
    expect(screen.queryByText(/Please execute an autonomous recruiter cold outreach workflow/)).not.toBeInTheDocument();
    expect(screen.getByText("Show prompt instructions")).toBeInTheDocument();
  });

  it("toggles full prompt instructions when clicking show/hide prompt instructions button", () => {
    render(<ChatPresetUserMessage content={samplePrompt} />);

    const toggleButton = screen.getByRole("button", {
      name: /Show prompt instructions/i,
    });

    // Expand
    fireEvent.click(toggleButton);
    expect(screen.getByText("Hide prompt instructions")).toBeInTheDocument();
    expect(
      screen.getByText(/Please execute an autonomous recruiter cold outreach workflow/),
    ).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByRole("button", { name: /Hide prompt instructions/i }));
    expect(screen.getByText("Show prompt instructions")).toBeInTheDocument();
    expect(
      screen.queryByText(/Please execute an autonomous recruiter cold outreach workflow/),
    ).not.toBeInTheDocument();
  });

  it("falls back to standard text when content is not a preset", () => {
    render(<ChatPresetUserMessage content="Just a regular message" />);
    expect(screen.getByText("Just a regular message")).toBeInTheDocument();
  });
});
