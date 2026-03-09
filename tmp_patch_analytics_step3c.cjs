const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace('  return { chartDataApps, chartDataJobs, barData, donutData, matchBarData, metrics, comparisons, loading, error, lastUpdated, refresh, exportCSV, exportJSON, snapshot } as const;', '  return { chartDataApps, chartDataJobs, barData, sourceBreakdown, donutData, matchBarData, metrics, comparisons, loading, error, lastUpdated, refresh, exportCSV, exportJSON, snapshot } as const;');
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
