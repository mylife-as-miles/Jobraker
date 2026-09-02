import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialResumeState } from "@/store/artboard";
import { useResumeExport } from "@/hooks/useResumeExport";

describe("useResumeExport", () => {
  it("reports exporter failures and resets its busy state", async () => {
    const onError = vi.fn();
    const exporter = vi.fn().mockRejectedValue(new Error("Canvas unavailable"));
    const { result } = renderHook(() => useResumeExport(onError, exporter));

    let exported = true;
    await act(async () => {
      exported = await result.current.downloadPdf(initialResumeState.data);
    });

    expect(exported).toBe(false);
    expect(onError).toHaveBeenCalledWith("Canvas unavailable");
    expect(result.current.exporting).toBe(false);
  });

  it("returns success after the exporter completes and calls onSuccess callback", async () => {
    const exporter = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useResumeExport(undefined, exporter, onSuccess));

    let exported = false;
    await act(async () => {
      exported = await result.current.downloadPdf(initialResumeState.data);
    });

    expect(exported).toBe(true);
    expect(exporter).toHaveBeenCalledWith(initialResumeState.data);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
