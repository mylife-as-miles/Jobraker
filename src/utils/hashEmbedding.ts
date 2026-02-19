// Deterministic pseudo-embedding for development (NOT semantic quality)
// Maps text to fixed-length numeric vector using hashing.

export function hashEmbedding(text: string, dim = 256): number[] {
  const vec = new Array(dim).fill(0);
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
    vec[h % dim] += 1;
  }
  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}
