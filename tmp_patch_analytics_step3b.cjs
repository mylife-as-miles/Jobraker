const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace('          setBarData(cached.barData || []);\n          setDonutData(cached.donutData || []);\n          setMatchBarData(cached.matchBarData || []);', '          setBarData(cached.barData || []);\n          setDonutData(cached.donutData || []);\n          setMatchBarData(cached.matchBarData || []);\n          setSourceBreakdown(cached.sourceBreakdown || []);');
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
