import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColdMailTargetSelectionCard } from "./ColdMailTargetSelectionCard";

describe("ColdMailTargetSelectionCard", () => {
  it("returns the selected target with its stable job ID", () => {
    const onSelect = vi.fn();
    const target = {
      jobId: "job-123",
      searchResultId: "result-123",
      jobTitle: "Backend Engineer",
      companyName: "Acme",
      applyUrl: "https://acme.example/jobs/123",
      location: "Remote",
      source: "ats",
    };

    render(
      <ColdMailTargetSelectionCard
        output={{
          success: true,
          status: "awaiting_target_selection",
          searchQuery: "Backend Engineer",
          location: "Remote",
          targets: [target],
        }}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select company" }));
    expect(onSelect).toHaveBeenCalledWith(target);
  });
});
