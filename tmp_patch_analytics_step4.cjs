const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace(
  '      rows.push("\");\n      // Bar data\n      push(["Bar Name","Value","Color"]);\n      for (const b of barData) push([b.name, b.value, b.color]);\n      rows.push("\");\n      // Donut data\n      push(["Status","Percent","Color"]);\n      for (const d of donutData) push([d.name, d.value, d.color]);',
  '      rows.push("\");\n      push(["Bar Name","Value","Color"]);\n      for (const b of barData) push([b.name, b.value, b.color]);\n      rows.push("\");\n      push(["Source","Count","Color"]);\n      for (const source of sourceBreakdown) push([source.name, source.value, source.color]);\n      rows.push("\");\n      push(["Status","Count","Share %","Color"]);\n      for (const d of donutData) push([d.name, d.value, d.share ?? 0, d.color]);'
);
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
