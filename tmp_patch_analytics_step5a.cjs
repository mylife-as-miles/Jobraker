const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace(
  "      // Filter sources by allowed job source domains only\n      const allowedDomains = ['remote.co', 'remotive.com', 'remoteok.com', 'jobicy.com', 'levels.fyi'];\n      const sourcesSet = new Set<string>();\n      for (const j of jobs) {\n        if (j.source_type && allowedDomains.includes(j.source_type.toLowerCase())) {\n          sourcesSet.add(j.source_type);\n        }\n      }\n      const sources = sourcesSet.size;",
  "      const sourceCounts = groupCounts(jobs.map((job: any) => normalizeSourceLabel(job)));\n      const sourceBreakdownData = Array.from(sourceCounts.entries())\n        .filter(([name]) => Boolean(name))\n        .sort((a, b) => b[1] - a[1])\n        .slice(0, 6)\n        .map(([name, value], index) => ({\n          name,\n          value,\n          color: indexedColor(index),\n        }));\n      const sources = sourceCounts.size;"
);
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
