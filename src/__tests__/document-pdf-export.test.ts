import { describe, it, expect, vi } from "vitest";
import {
  cleanMarkdownText,
  parseMarkdownToDocBlocks,
  createDocumentPdf,
  isExportableDocument,
  exportDocumentAsPdf,
  generateDocumentPdfBlob,
} from "../utils/document-pdf-export";

describe("document-pdf-export utility", () => {
  it("cleans raw markdown text accurately", () => {
    expect(cleanMarkdownText("**Bold** and *italic* and `code`")).toBe("Bold and italic and code");
    expect(cleanMarkdownText("[JobRaker](https://jobraker.io)")).toBe("JobRaker");
    expect(cleanMarkdownText("<span style='color:red'>Alert</span>")).toBe("Alert");
  });

  it("parses markdown into structured document blocks with title and subtitle", () => {
    const markdown = `# Systems Strategy & Architecture Overview
*Prepared for Technical Leadership Interview*

## Executive Summary
This strategy provides a resilient, highly available roadmap for the core systems.

## Core Pillars
- Distributed Consensus & High Availability
- Event-Driven Architecture with Idempotency
- Zero-Downtime Migration Strategies

> Reliability is an architectural invariant, not a post-deployment optimization.
`;

    const parsed = parseMarkdownToDocBlocks(markdown);
    expect(parsed.title).toBe("Systems Strategy & Architecture Overview");
    expect(parsed.subtitle).toBe("Prepared for Technical Leadership Interview");
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(4);

    const pillarBlock = parsed.blocks.find((b) => b.type === "bullet");
    expect(pillarBlock).toBeDefined();
    expect(pillarBlock?.items?.length).toBe(3);

    const quoteBlock = parsed.blocks.find((b) => b.type === "blockquote");
    expect(quoteBlock).toBeDefined();
    expect(quoteBlock?.text).toContain("Reliability is an architectural invariant");
  });

  it("detects exportable documents correctly", () => {
    const chatChitChat = "Sure, I can help you with that! Let me know what you need.";
    expect(isExportableDocument(chatChitChat)).toBe(false);

    const strategyDoc = `
# Systems Strategy & Architecture Overview
## Executive Summary
We present a high-scale systems strategy designed to sustain 99.99% availability and streamline engineering delivery across distributed services.

## Strategic Pillars
- Service Decoupling & Event Mesh
- Database Sharding & Active-Passive Replication
- Automated Telemetry & Proactive Alerts

## 30-60-90 Day Execution
1. Day 1-30: Audit bottlenecks
2. Day 31-60: Implement read replicas
3. Day 61-90: Scale out horizontally
`;
    expect(isExportableDocument(strategyDoc)).toBe(true);
  });

  it("creates a jsPDF document without errors and respects themes", () => {
    const markdown = `
# Executive Systems Strategy
## Vision
To establish world-class reliability and platform velocity.

- Pillar 1: High Availability
- Pillar 2: Security & SOC2 Compliance
`;

    const docEmerald = createDocumentPdf(markdown, { theme: "emerald", candidateName: "Miles Candidate" });
    expect(docEmerald).toBeDefined();
    expect(docEmerald.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const docSlate = createDocumentPdf(markdown, { theme: "slate", fitToOnePage: true });
    expect(docSlate).toBeDefined();

    const { blob, filename, pageCount } = generateDocumentPdfBlob(markdown);
    expect(blob).toBeDefined();
    expect(filename).toContain(".pdf");
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });

  it("handles empty and malformed content safely", () => {
    expect(isExportableDocument("")).toBe(false);
    expect(cleanMarkdownText("")).toBe("");
    const parsed = parseMarkdownToDocBlocks("");
    expect(parsed.blocks).toEqual([]);
  });
});

