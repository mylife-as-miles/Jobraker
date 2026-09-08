import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialResumeState } from "@/store/artboard";
import { ResumeTemplateRenderer } from "@/templates/render-resume-template";

describe("plain text resume template", () => {
  it("renders resume content without images, icons, tables, or HTML markup", () => {
    const resume = structuredClone(initialResumeState.data);
    resume.basics.name = "Ada Lovelace";
    resume.summary.content = "Built <strong>reliable</strong> systems.";

    const { container } = render(
      <ResumeTemplateRenderer
        templateId="plain-text"
        resumeDataOverride={resume}
      />,
    );

    expect(screen.getByRole("document", { name: "Plain text resume" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Built reliable systems.")).toBeInTheDocument();
    expect(container.querySelector("img, svg, table, strong")).toBeNull();
  });
});
