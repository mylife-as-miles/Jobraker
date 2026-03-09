const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace('      setChartDataJobs(jobsSeries);\n      setBarData(bar);\n      setDonutData(donut);', '      setChartDataJobs(jobsSeries);\n      setBarData(bar);\n      setSourceBreakdown(sourceBreakdownData);\n      setDonutData(donut);');
text = text.replace('        barData: bar,\n        donutData: donut,', '        barData: bar,\n        sourceBreakdown: sourceBreakdownData,\n        donutData: donut,');
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
