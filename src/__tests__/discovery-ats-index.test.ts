import { describe, it, expect, beforeEach } from "vitest";

// The module reads Deno.env; provide a minimal stand-in before importing it.
const env = new Map<string, string>();
(globalThis as any).Deno = { env: { get: (k: string) => env.get(k) } };

const { discoverJobsFromAtsIndex, useAtsIndexFor } = await import(
  "../../backend/supabase/functions/_shared/discovery-ats-index"
);

function fakeClient(opts: { profileLocation: string | null; hits: any[] }) {
  const calls: { rpc?: any } = {};
  const client = {
    rpc: async (_name: string, params: any) => {
      calls.rpc = params;
      return { data: opts.hits, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { location: opts.profileLocation } }) }),
        in: async () => ({
          data: table === "ats_jobs"
            ? opts.hits.map((h) => ({ id: h.id, external_id: `ext-${h.id}`, description_text: "Desc", questions: [] }))
            : [],
          error: null,
        }),
      }),
    }),
  };
  return { client, calls };
}

const hit = (id: string, ats = "greenhouse") => ({
  id, company_id: "c1", ats, title: "Project Manager", company_name: "Canonical", location_text: "Home based - Worldwide",
  remote_scope: "worldwide", countries: [], apply_url: `https://x/${id}`, salary_min: null, salary_max: null,
  salary_currency: null, salary_period: null, questions_known: true, required_question_keys: ["email"], posted_at: null,
});

describe("useAtsIndexFor", () => {
  beforeEach(() => env.clear());
  it("is off by default", () => expect(useAtsIndexFor("u1")).toBe(false));
  it("enables allowlisted users only", () => {
    env.set("ATS_INDEX_SEARCH_USERS", "u1, u2");
    expect(useAtsIndexFor("u2")).toBe(true);
    expect(useAtsIndexFor("u3")).toBe(false);
  });
  it("enables everyone with ATS_INDEX_SEARCH_ALL", () => {
    env.set("ATS_INDEX_SEARCH_ALL", "true");
    expect(useAtsIndexFor("anyone")).toBe(true);
  });
});

describe("discoverJobsFromAtsIndex", () => {
  it("searches remote jobs workable from the profile country and maps to DiscoveryJob", async () => {
    const { client, calls } = fakeClient({ profileLocation: "Lagos, Nigeria", hits: [hit("1"), hit("2", "recruitee")] });
    const batches: any[][] = [];
    const result = await discoverJobsFromAtsIndex(
      { serviceClient: client, userId: "u1", searchQuery: "project manager", location: "Remote", limit: 20 },
      async (b) => { batches.push(b); },
    );
    expect(calls.rpc).toMatchObject({ p_query: "project manager", p_workable_from: "NG", p_remote_scopes: ["worldwide", "restricted"] });
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]).toMatchObject({
      url: "https://x/1", source_type: "adapter", source_kind: "greenhouse", verification_status: "verified",
      source_id: "ats:greenhouse:ext-1", description: "Desc",
    });
    expect(result.jobs[1].source_kind).toBe("direct");
    expect(result.jobs[0].raw_data.ats).toMatchObject({ remote_scope: "worldwide", required_question_keys: ["email"] });
    expect(batches.flat()).toHaveLength(2);
  });

  it("uses the searched country for a location search", async () => {
    const { client, calls } = fakeClient({ profileLocation: "Lagos, Nigeria", hits: [hit("1")] });
    await discoverJobsFromAtsIndex({ serviceClient: client, userId: "u1", searchQuery: "pm", location: "London, United Kingdom", limit: 5 });
    expect(calls.rpc).toMatchObject({ p_workable_from: "GB", p_remote_scopes: null });
  });

  it("returns a helpful warning when nothing matches", async () => {
    const { client } = fakeClient({ profileLocation: "Lagos, Nigeria", hits: [] });
    const result = await discoverJobsFromAtsIndex({ serviceClient: client, userId: "u1", searchQuery: "astronaut", location: "Remote", limit: 5 });
    expect(result.jobs).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/astronaut/);
  });
});

describe("discoverJobsFromAtsIndex with an explicit country", () => {
  it("uses the chosen country over the profile", async () => {
    const { client, calls } = fakeClient({ profileLocation: "Lagos, Nigeria", hits: [hit("1")] });
    await discoverJobsFromAtsIndex({ serviceClient: client, userId: "u1", searchQuery: "pm", location: "Remote", limit: 5, workableFrom: "ke" });
    expect(calls.rpc).toMatchObject({ p_workable_from: "KE" });
  });
  it("ANY removes the country filter", async () => {
    const { client, calls } = fakeClient({ profileLocation: "Lagos, Nigeria", hits: [hit("1")] });
    await discoverJobsFromAtsIndex({ serviceClient: client, userId: "u1", searchQuery: "pm", location: "Remote", limit: 5, workableFrom: "ANY" });
    expect(calls.rpc).toMatchObject({ p_workable_from: null, p_remote_scopes: ["worldwide", "restricted"] });
  });
});
