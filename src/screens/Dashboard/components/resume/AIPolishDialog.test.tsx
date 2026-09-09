import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AIPolishDialog } from "./AIPolishDialog";

describe("AIPolishDialog", () => {
  it("keeps the original summary unchanged until a suggestion is applied", () => {
    const onApply = vi.fn();

    render(
      <AIPolishDialog
        open
        onClose={vi.fn()}
        originalText='Original summary'
        suggestions={[
          {
            id: "suggestion-1",
            type: "enhancement",
            label: "Clear and concise",
            content: "Enhanced summary",
            original: "Original summary",
            isRecommended: true,
          },
        ]}
        onApply={onApply}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "AI summary suggestions" }),
    ).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("Enhanced summary");
  });
});
