// Simple passthrough for t template literal
export const t = (strings: TemplateStringsArray, ...expr: unknown[]) =>
  strings.reduce((acc, s, i) => acc + s + (i < expr.length ? String(expr[i]) : ""), "");

// msg tag behaves like identity for template literals
export const msg = (strings: TemplateStringsArray, ...expr: unknown[]) =>
  strings.reduce((acc, s, i) => acc + s + (i < expr.length ? String(expr[i]) : ""), "");

// Minimal Trans component stub: returns children as-is
export function Trans(props: { children?: any }) {
  return (props && (props as any).children) ?? null;
}

// Minimal plural helper that returns a resolved string for display
export function plural(value: number, forms: { one: string; other: string }) {
  return value === 1 ? forms.one : forms.other;
}
