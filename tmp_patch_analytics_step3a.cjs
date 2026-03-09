const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace('        setBarData([]);\n        setDonutData([]);\n        setMatchBarData([]);', '        setBarData([]);\n        setDonutData([]);\n        setMatchBarData([]);\n        setSourceBreakdown([]);');
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
