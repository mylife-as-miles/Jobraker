import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialResumeState } from "@/store/artboard";
import { updateResumeRecord } from "@/hooks/useResumePersistence";

function clientReturning(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as SupabaseClient,
    spies: { from, update, eq, select, maybeSingle },
  };
}

describe("resume persistence", () => {
  it("requires Supabase to return the updated owned record", async () => {
    const { client } = clientReturning({ data: null, error: null });
    await expect(updateResumeRecord(client, "resume-1", initialResumeState.data))
      .rejects.toThrow("was not updated");
  });

  it("returns the authoritative server timestamp", async () => {
    const { client, spies } = clientReturning({
      data: { id: "resume-1", updated_at: "2026-07-21T10:00:00.000Z" },
      error: null,
    });
    await expect(updateResumeRecord(client, "resume-1", initialResumeState.data))
      .resolves.toEqual({ id: "resume-1", updated_at: "2026-07-21T10:00:00.000Z" });
    expect(spies.eq).toHaveBeenCalledWith("id", "resume-1");
    expect(spies.select).toHaveBeenCalledWith("id, updated_at");
  });
});
