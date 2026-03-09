const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace('.select("id, applied_date, created_at, status, updated_at, user_id")', '.select("id, applied_date, created_at, status, updated_at, user_id, match_score, notes")');
text = text.replace('.select("id, created_at, source_type, user_id, title, company, raw_data")', '.select("id, created_at, source_type, apply_url, user_id, title, company, raw_data")');
text = text.replace('    barData,\n    donutData,\n    matchBarData,', '    barData,\n    sourceBreakdown,\n    donutData,\n    matchBarData,');
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
