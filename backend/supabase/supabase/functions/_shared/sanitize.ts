import xss from "npm:xss";

export const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

export async function parseAndSanitize(req: Request, maxBytes = MAX_PAYLOAD_SIZE): Promise<any> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error(`Payload too large (exceeds ${maxBytes} bytes)`);
  }

  const text = await req.text();
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > maxBytes) {
    throw new Error(`Payload too large (exceeds ${maxBytes} bytes)`);
  }

  if (!text) {
    return {};
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("Malformed JSON payload");
  }

  return sanitizeObject(parsed);
}

function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return xss(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  } else if (obj !== null && typeof obj === "object") {
    const newObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = sanitizeObject(value);
    }
    return newObj;
  }
  return obj;
}
