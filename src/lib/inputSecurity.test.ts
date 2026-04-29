/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import {
  getSafeExternalHref,
  sanitizeHtmlFragment,
  sanitizeStructuredPayload,
  sanitizeTextValue,
} from "./inputSecurity";

describe("inputSecurity", () => {
  it("normalizes text input and strips control characters", () => {
    expect(
      sanitizeTextValue("  he\u0000llo\u200B\r\nworld  ", {
        trim: true,
      }).value,
    ).toBe("hello world");
  });

  it("sanitizes structured payloads without mutating sensitive keys", () => {
    expect(
      sanitizeStructuredPayload({
        profile: {
          name: "  Miles\u0000  ",
          summary: "hello\u200B\nworld",
        },
        password: "  keep me raw  ",
      }),
    ).toEqual({
      profile: {
        name: "Miles",
        summary: "hello\nworld",
      },
      password: "  keep me raw  ",
    });
  });

  it("rejects unsafe protocols and upgrades bare www links", () => {
    expect(getSafeExternalHref("javascript:alert(1)")).toBe("");
    expect(getSafeExternalHref("www.example.com")).toBe(
      "https://www.example.com",
    );
  });

  it("removes dangerous html while preserving safe formatting", () => {
    expect(
      sanitizeHtmlFragment(
        '<p>Hello <strong>there</strong><script>alert(1)</script><a href="javascript:alert(1)" onclick="evil()">bad</a></p>',
      ),
    ).toBe("<p>Hello <strong>there</strong><a>bad</a></p>");
  });
});
