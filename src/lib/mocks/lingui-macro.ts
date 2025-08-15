// Simple passthrough for t template literal
export const t = (strings: TemplateStringsArray, ...expr: unknown[]) =>
  strings.reduce((acc, s, i) => acc + s + (i < expr.length ? String(expr[i]) : ""), "");
