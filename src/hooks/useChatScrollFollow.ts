import { useCallback, useEffect, useRef, useState } from "react";

const FOLLOW_THRESHOLD_PX = 240;
const BUTTON_THRESHOLD_PX = 160;

const distanceFromBottom = (container: HTMLDivElement) =>
  container.scrollHeight - container.scrollTop - container.clientHeight;

export const useChatScrollFollow = () => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollContentRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowRef = useRef(true);
  const animationFrameRef = useRef<number | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollState = useCallback((recordUserPosition = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distance = distanceFromBottom(container);
    if (recordUserPosition) {
      shouldFollowRef.current = distance < FOLLOW_THRESHOLD_PX;
    }
    setShowScrollToBottom(distance > BUTTON_THRESHOLD_PX);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    shouldFollowRef.current = true;
    setShowScrollToBottom(false);
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const onScroll = useCallback(() => {
    updateScrollState(true);
  }, [updateScrollState]);

  const scheduleFollow = useCallback(() => {
    if (!shouldFollowRef.current) {
      updateScrollState(false);
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      if (!shouldFollowRef.current) return;
      setShowScrollToBottom(false);
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    });
  }, [updateScrollState]);

  useEffect(() => {
    const content = scrollContentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(scheduleFollow);
    observer.observe(content);

    return () => {
      observer.disconnect();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [scheduleFollow]);

  return {
    messagesEndRef,
    onScroll,
    scrollContainerRef,
    scrollContentRef,
    scrollToBottom,
    showScrollToBottom,
  };
};
