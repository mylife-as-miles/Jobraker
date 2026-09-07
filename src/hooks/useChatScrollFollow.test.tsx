// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatScrollFollow } from "./useChatScrollFollow";

type ResizeCallback = ResizeObserverCallback;

let resizeCallback: ResizeCallback | null = null;

class ResizeObserverMock {
  constructor(callback: ResizeCallback) {
    resizeCallback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

const setScrollMetrics = (
  element: HTMLDivElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop: number },
) => {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollTop: { configurable: true, writable: true, value: metrics.scrollTop },
  });
};

const Harness = () => {
  const values = useChatScrollFollow();

  return (
    <div ref={values.scrollContainerRef} data-testid="scroll-container" onScroll={values.onScroll}>
      <div ref={values.scrollContentRef} data-testid="scroll-content">
        Messages
      </div>
      <div ref={values.messagesEndRef} data-testid="messages-end" />
      <output data-testid="button-state">{String(values.showScrollToBottom)}</output>
    </div>
  );
};

describe("useChatScrollFollow", () => {
  beforeEach(() => {
    resizeCallback = null;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("follows asynchronous content growth while the user is already at the bottom", () => {
    const { getByTestId } = render(<Harness />);
    const container = getByTestId("scroll-container") as HTMLDivElement;

    setScrollMetrics(container, { clientHeight: 300, scrollHeight: 1000, scrollTop: 700 });
    fireEvent.scroll(container);

    setScrollMetrics(container, { clientHeight: 300, scrollHeight: 1400, scrollTop: 700 });
    act(() => resizeCallback?.([], {} as ResizeObserver));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto" });
    expect(getByTestId("button-state").textContent).toBe("false");
  });

  it("preserves the user's position when content grows after they scroll upward", () => {
    const { getByTestId } = render(<Harness />);
    const container = getByTestId("scroll-container") as HTMLDivElement;

    setScrollMetrics(container, { clientHeight: 300, scrollHeight: 1000, scrollTop: 250 });
    fireEvent.scroll(container);

    setScrollMetrics(container, { clientHeight: 300, scrollHeight: 1400, scrollTop: 250 });
    act(() => resizeCallback?.([], {} as ResizeObserver));

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(getByTestId("button-state").textContent).toBe("true");
  });
});
