import { describe, expect, it } from "vitest";
import {
  inspectLinkedInConnectionsCsv,
  parseLinkedInConnectionsCsv,
} from "@/lib/parseLinkedInConnectionsCsv";

describe("LinkedIn Connections CSV inspection", () => {
  it("finds headers after LinkedIn notice rows and removes duplicates", () => {
    const csv = `Notes about your LinkedIn data export\nGenerated for account owner\nFirst Name,Last Name,URL,Company,Position\nAda,Lovelace,https://linkedin.com/in/ada/,Analytical,Engineer\nAda,Lovelace,https://linkedin.com/in/ada,Analytical,Engineer`;
    const result = inspectLinkedInConnectionsCsv(csv);

    expect(result.headerRow).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.warnings[0]).toContain("Skipped 2 introductory");
  });

  it("detects tab delimiters, BOMs, and quoted multiline fields", () => {
    const csv = `\ufeffFirst Name\tLast Name\tCompany\tPosition\nGrace\tHopper\t\"US\nNavy\"\tAdmiral`;
    const result = inspectLinkedInConnectionsCsv(csv);

    expect(result.delimiter).toBe("\t");
    expect(result.rows[0]).toMatchObject({
      first_name: "Grace",
      last_name: "Hopper",
      company: "US\nNavy",
      position: "Admiral",
    });
  });

  it("keeps the backward-compatible parser API", () => {
    expect(parseLinkedInConnectionsCsv("First Name,Last Name\nKatherine,Johnson"))
      .toHaveLength(1);
  });

  it("reports files without a usable header", () => {
    const result = inspectLinkedInConnectionsCsv("one,two\nthree,four");
    expect(result.rows).toEqual([]);
    expect(result.headerRow).toBe(-1);
    expect(result.warnings[0]).toContain("Could not find");
  });

  it("supports manual mapping for unfamiliar export headers", () => {
    const csv = "Given,Surname,Workplace,Role,Public Link\nDorothy,Vaughan,NACA,Manager,https://linkedin.com/in/dorothy";
    const initial = inspectLinkedInConnectionsCsv(csv);
    expect(initial.headers).toEqual(["given", "surname", "workplace", "role", "public link"]);

    const mapped = inspectLinkedInConnectionsCsv(csv, {
      first_name: "given",
      last_name: "surname",
      company: "workplace",
      position: "role",
      profile_url: "public link",
    });
    expect(mapped.rows[0]).toMatchObject({
      first_name: "Dorothy",
      last_name: "Vaughan",
      company: "NACA",
      position: "Manager",
      profile_url: "https://linkedin.com/in/dorothy",
    });
  });
});
