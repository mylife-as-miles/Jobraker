import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPresetsBar } from "./ChatPresetsBar";

describe("ChatPresetsBar", () => {
  it("opens presets from a compact hand button and returns the selected recipe", () => {
    const onSelectRecipe = vi.fn();

    render(<ChatPresetsBar onSelectRecipe={onSelectRecipe} />);

    const trigger = screen.getByRole("button", { name: "Open quick presets" });
    expect(screen.queryByText("Quick 1-Click Presets:")).not.toBeInTheDocument();

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const recruiterPreset = screen.getByRole("menuitem", {
      name: /1-Click Recruiter Cold Outreach/i,
    });
    fireEvent.click(recruiterPreset);

    expect(onSelectRecipe).toHaveBeenCalledWith("recruiter_cold_outreach");
  });
});
