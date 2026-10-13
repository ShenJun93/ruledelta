// Shared pure MIT-licensed cosine implementation from the same Week 2 author.
export function cosine(a, b) {
  if (!Array.isArray(a) && !ArrayBuffer.isView(a)) throw new TypeError('Invalid first embedding');
  if (!Array.isArray(b) && !ArrayBuffer.isView(b)) throw new TypeError('Invalid second embedding');
  if (a.length === 0 || a.length !== b.length) throw new TypeError('Embeddings have different dimensions');
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = Number(a[i]), bv = Number(b[i]);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) throw new TypeError('Nonfinite embedding');
    dot += av * bv; na += av * av; nb += bv * bv;
  }
  if (na === 0 || nb === 0) throw new TypeError('Zero-norm embedding');
  return Math.max(-1, Math.min(1, dot / Math.sqrt(na * nb)));
}
