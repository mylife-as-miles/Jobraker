const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace(
  "      const statusCounts = groupCounts(apps.map((a: any) => a.status || 'Unknown'));\n      const totalStatus = Array.from(statusCounts.values()).reduce((s, v) => s + v, 0) || 1;\n      const donut = Array.from(statusCounts.entries()).map(([name, count]) => ({\n        name,\n        value: Math.round((count / totalStatus) * 100),\n        color: pickColor(name),\n      }));",
  "      const statusCounts = groupCounts(apps.map((a: any) => a.status || 'Unknown'));\n      const totalStatus = Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0) || 1;\n      const donut = Array.from(statusCounts.entries())\n        .sort((a, b) => b[1] - a[1])\n        .map(([name, count]) => ({\n          name,\n          value: count,\n          share: Math.round((count / totalStatus) * 100),\n          color: pickColor(name),\n        }));"
);
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
