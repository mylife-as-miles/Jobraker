const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INVISIBLE_UNICODE_REGEX = /[\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const SUSPICIOUS_MARKUP_REGEX =
  /<\s*(script|iframe|object|embed|svg|math|meta|link|style)\b|on\w+\s*=|javascript:|vbscript:|data:text\/html|expression\s*\(/i;

const DEFAULT_SINGLE_LINE_MAX_LENGTH = 4_000;
const DEFAULT_MULTILINE_MAX_LENGTH = 50_000;

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const DROP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "meta",
  "link",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
]);
const ALLOWED_HTML_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "u",
  "ul",
]);

const LARGE_TEXT_KEY_REGEX =
  /(about|bio|body|content|cover|description|html|markdown|message|note|prompt|resume|summary|text)/i;
const SENSITIVE_KEY_REGEX =
  /(api[-_]?key|authorization|cookie|pass(word)?|refresh[-_]?token|secret|token)/i;
const URLISH_FIELD_REGEX =
  /(apply|callback|github|href|link|linkedin|portfolio|redirect|return|url|website|webhook)/i;

export type TextSanitizeOptions = {
  maxLength?: number;
  multiline?: boolean;
  trim?: boolean;
};

export type TextSanitizeResult = {
  changed: boolean;
  suspiciousMarkup: boolean;
  value: string;
};

export type TextControlElement = HTMLInputElement | HTMLTextAreaElement;

function normalizeUnicode(value: string) {
  try {
    return value.normalize("NFKC");
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function looksLikeTextAreaFieldName(fieldName?: string | null) {
  return LARGE_TEXT_KEY_REGEX.test(String(fieldName || ""));
}

function getTextMaxLength(fieldName?: string | null, multiline = false) {
  if (multiline || looksLikeTextAreaFieldName(fieldName)) {
    return DEFAULT_MULTILINE_MAX_LENGTH;
  }

  return DEFAULT_SINGLE_LINE_MAX_LENGTH;
}

function hasSafeExternalProtocol(value: string) {
  const protocolMatch = value.match(/^([a-z][a-z0-9+.-]*:)/i);
  if (!protocolMatch) return false;
  return ALLOWED_EXTERNAL_PROTOCOLS.has(protocolMatch[1].toLowerCase());
}

export function sanitizeTextValue(
  value: unknown,
  options: TextSanitizeOptions = {},
): TextSanitizeResult {
  const original = typeof value === "string" ? value : String(value ?? "");
  const multiline = Boolean(options.multiline);
  const maxLength =
    typeof options.maxLength === "number" && Number.isFinite(options.maxLength)
      ? Math.max(0, Math.floor(options.maxLength))
      : multiline
        ? DEFAULT_MULTILINE_MAX_LENGTH
        : DEFAULT_SINGLE_LINE_MAX_LENGTH;

  let sanitized = normalizeUnicode(original)
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS_REGEX, "")
    .replace(INVISIBLE_UNICODE_REGEX, "")
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/\t/g, " ");

  if (!multiline) {
    sanitized = sanitized.replace(/\n+/g, " ");
  } else {
    sanitized = sanitized.replace(/\n{5,}/g, "\n\n\n\n");
  }

  if (options.trim) {
    sanitized = multiline
      ? sanitized
          .split("\n")
          .map((line) => line.trimEnd())
          .join("\n")
          .trim()
      : sanitized.trim();
  }

  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return {
    value: sanitized,
    changed: sanitized !== original,
    suspiciousMarkup: SUSPICIOUS_MARKUP_REGEX.test(sanitized),
  };
}

export function getSafeExternalHref(value: unknown) {
  const sanitized = sanitizeTextValue(value, {
    maxLength: DEFAULT_SINGLE_LINE_MAX_LENGTH,
    trim: true,
  }).value;

  if (!sanitized) return "";

  if (/^www\./i.test(sanitized)) {
    return `https://${sanitized}`;
  }

  if (!hasSafeExternalProtocol(sanitized)) {
    return "";
  }

  try {
    const parsed = new URL(sanitized);
    return ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function isSensitivePathSegment(path: string) {
  return SENSITIVE_KEY_REGEX.test(path);
}

function sanitizePayloadString(value: string, path: string) {
  return sanitizeTextValue(value, {
    maxLength: getTextMaxLength(path, looksLikeTextAreaFieldName(path)),
    multiline: looksLikeTextAreaFieldName(path),
    trim: true,
  }).value;
}

export function sanitizeStructuredPayload(
  value: unknown,
  path = "",
): unknown {
  if (typeof value === "string") {
    if (isSensitivePathSegment(path)) {
      return value;
    }
    return sanitizePayloadString(value, path);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeStructuredPayload(item, path ? `${path}[${index}]` : `[${index}]`),
    );
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      const nextPath = path ? `${path}.${key}` : key;
      return [
        key,
        isSensitivePathSegment(nextPath)
          ? entryValue
          : sanitizeStructuredPayload(entryValue, nextPath),
      ];
    }),
  );
}

function isTextInputType(inputType: string) {
  return ["email", "search", "tel", "text", "url"].includes(inputType);
}

export function isSecuredTextControl(
  target: EventTarget | null,
): target is TextControlElement {
  if (typeof HTMLInputElement !== "undefined" && target instanceof HTMLInputElement) {
    const inputType = target.type.toLowerCase();
    return isTextInputType(inputType || "text");
  }

  return typeof HTMLTextAreaElement !== "undefined" && target instanceof HTMLTextAreaElement;
}

function getControlMaxLength(control: TextControlElement) {
  if (typeof control.maxLength === "number" && control.maxLength > 0) {
    return control.maxLength;
  }

  if (control instanceof HTMLTextAreaElement) {
    return getTextMaxLength(control.name || control.id, true);
  }

  return getTextMaxLength(
    control.name || control.id || control.placeholder,
    false,
  );
}

function setNativeControlValue(control: TextControlElement, value: string) {
  if (control instanceof HTMLTextAreaElement) {
    const textareaSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;

    if (textareaSetter) {
      textareaSetter.call(control, value);
      return;
    }
  }

  const inputSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  if (inputSetter) {
    inputSetter.call(control, value);
    return;
  }

  control.value = value;
}

function getControlValidationMessage(control: TextControlElement, value: string) {
  const identity = `${control.name} ${control.id} ${control.placeholder}`.trim();
  const isUrlField =
    (control instanceof HTMLInputElement && control.type.toLowerCase() === "url") ||
    URLISH_FIELD_REGEX.test(identity);

  if (!isUrlField || !value) {
    return "";
  }

  return getSafeExternalHref(value)
    ? ""
    : "Use a valid URL starting with http://, https://, mailto:, or tel:.";
}

export function secureTextControl(
  control: TextControlElement,
  options: Pick<TextSanitizeOptions, "trim"> = {},
) {
  const sanitized = sanitizeTextValue(control.value, {
    maxLength: getControlMaxLength(control),
    multiline: control instanceof HTMLTextAreaElement,
    trim: options.trim,
  });

  if (sanitized.changed) {
    const start = control.selectionStart;
    const end = control.selectionEnd;

    setNativeControlValue(control, sanitized.value);

    if (typeof start === "number" && typeof end === "number") {
      const safeCursor = Math.min(sanitized.value.length, start);
      const safeSelectionEnd = Math.min(sanitized.value.length, end);

      try {
        control.setSelectionRange(safeCursor, safeSelectionEnd);
      } catch {
        // Some input types (for example email) do not support manual selection ranges.
      }
    }
  }

  const validationMessage = getControlValidationMessage(control, sanitized.value);
  control.setCustomValidity(validationMessage);
  control.toggleAttribute("data-input-security-invalid", Boolean(validationMessage));
  control.toggleAttribute(
    "data-input-security-suspicious",
    sanitized.suspiciousMarkup,
  );

  return {
    ...sanitized,
    validationMessage,
  };
}

function sanitizeHtmlNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = node as HTMLElement;
  for (const child of Array.from(element.childNodes)) {
    sanitizeHtmlNode(child);
  }

  const tagName = element.tagName.toLowerCase();
  const originalHref = tagName === "a" ? element.getAttribute("href") : null;

  if (DROP_CONTENT_TAGS.has(tagName)) {
    element.remove();
    return;
  }

  if (!ALLOWED_HTML_TAGS.has(tagName)) {
    const parent = element.parentNode;
    if (!parent) {
      element.remove();
      return;
    }

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
    return;
  }

  for (const attribute of Array.from(element.attributes)) {
    element.removeAttribute(attribute.name);
  }

  if (tagName === "a") {
    const href = getSafeExternalHref(originalHref);
    if (href) {
      element.setAttribute("href", href);
      if (/^https?:/i.test(href)) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer");
      }
    }
  }
}

export function sanitizeHtmlFragment(value: unknown) {
  const sanitized = sanitizeTextValue(value, {
    maxLength: DEFAULT_MULTILINE_MAX_LENGTH,
    multiline: true,
    trim: false,
  }).value;

  if (!sanitized) return "";

  if (
    typeof DOMParser === "undefined" ||
    typeof document === "undefined" ||
    typeof Node === "undefined"
  ) {
    return escapeHtml(sanitized).replace(/\n/g, "<br />");
  }

  const documentFragment = new DOMParser().parseFromString(
    `<div>${sanitized}</div>`,
    "text/html",
  );
  const root = documentFragment.body.firstElementChild as HTMLDivElement | null;
  if (!root) return "";

  for (const child of Array.from(root.childNodes)) {
    sanitizeHtmlNode(child);
  }

  return root.innerHTML;
}
