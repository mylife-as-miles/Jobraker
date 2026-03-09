const fs = require("fs");
let text = fs.readFileSync("src/hooks/useAnalyticsData.ts", "utf8");
text = text.replace(
  "  const [donutData, setDonutData] = useState<{ name: string; value: number; color: string }[]>([]);\n  const [matchBarData, setMatchBarData] = useState<Array<{ name: string; value: number; color: string; summary?: string | null; company?: string | null }>>([]);",
  "  const [donutData, setDonutData] = useState<{ name: string; value: number; color: string; share?: number }[]>([]);\n  const [matchBarData, setMatchBarData] = useState<Array<{ name: string; value: number; color: string; summary?: string | null; company?: string | null }>>([]);\n  const [sourceBreakdown, setSourceBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);",
);
fs.writeFileSync("src/hooks/useAnalyticsData.ts", text);
