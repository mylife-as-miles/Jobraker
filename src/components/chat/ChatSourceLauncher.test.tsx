import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSourceLauncher } from "./ChatSourceLauncher";

describe("ChatSourceLauncher", () => {
  it("exposes skills as buttons and returns the selected skill ID", () => {
    const onClose = vi.fn();
    const onSkillSelect = vi.fn();

    render(
      <ChatSourceLauncher
        open
        skills={[
          {
            id: "cold_mail",
            name: "Cold Mail",
            description: "Find a target and create an approved Gmail draft.",
          },
        ]}
        triggerRef={createRef<HTMLButtonElement>()}
        onClose={onClose}
        onUpload={vi.fn()}
        onSkillSelect={onSkillSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Cold Mail/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSkillSelect).toHaveBeenCalledWith("cold_mail");
  });
});
