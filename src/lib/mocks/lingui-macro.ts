// Simple passthrough for t template literal
type TObj = { message: string; context?: string };
export function t(stringsOrObj: TemplateStringsArray | TObj, ...expr: unknown[]) {
  if (Array.isArray(stringsOrObj)) {
    return stringsOrObj.reduce((acc, s, i) => acc + s + (i < expr.length ? String(expr[i]) : ""), "");
  }
  const obj = stringsOrObj as TObj;
  return obj.message;
}

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
