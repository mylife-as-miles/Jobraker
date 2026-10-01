import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatActionGrid } from "./ChatActionGrid";
import { CHAT_ACTIONS } from "@/lib/chat/chatActions";

describe("ChatActionGrid", () => {
  it("runs the clicked action", () => {
    const onAction = vi.fn();
    render(<ChatActionGrid onAction={onAction} />);
    fireEvent.click(screen.getByText("Find jobs for me"));
    expect(onAction).toHaveBeenCalledWith(
      CHAT_ACTIONS.find((action) => action.id === "find_jobs"),
    );
  });

  it("blocks clicks while the chat is busy", () => {
    const onAction = vi.fn();
    render(<ChatActionGrid onAction={onAction} disabled />);
    fireEvent.click(screen.getByText("Find jobs for me"));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("gives every action a unique id and something to run", () => {
    const ids = new Set(CHAT_ACTIONS.map((action) => action.id));
    expect(ids.size).toBe(CHAT_ACTIONS.length);
    for (const action of CHAT_ACTIONS) {
      if (action.kind === "prompt") expect(action.prompt.trim()).not.toBe("");
      else expect(action.recipeId.trim()).not.toBe("");
    }
  });
});
