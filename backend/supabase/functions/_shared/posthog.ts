type CapturePostHogEventInput = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
};

export async function capturePostHogEvent({
  event,
  distinctId,
  properties = {},
}: CapturePostHogEventInput) {
  const apiKey = Deno.env.get("POSTHOG_PROJECT_API_KEY");
  if (!apiKey) {
    throw new Error("Missing required POSTHOG_PROJECT_API_KEY secret");
  }

  const host = (Deno.env.get("POSTHOG_HOST") || "https://us.i.posthog.com")
    .replace(/\/$/, "");

  const response = await fetch(`${host}/capture/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: distinctId,
      properties,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `PostHog capture failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }
}
