import { resolve } from 'node:path';

let extractorPromise;
/**
 * Lazy CPU-only real ONNX model inference. Never replace with toy embeddings.
 * Model weights download from Hugging Face on the first run; then cache locally.
 */
export async function embedWithMiniLM(sentences) {
  if (!Array.isArray(sentences) || !sentences.every(s=>typeof s==='string'))
    throw new TypeError('Text batch required');
  if (!extractorPromise) {
    extractorPromise = (async()=>{
      const { env, pipeline } = await import('@huggingface/transformers');
      env.cacheDir = resolve('.cache');
      env.allowRemoteModels = true;
      return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        device:'cpu', dtype:'q8'
      });
    })();
  }
  const extractor = await extractorPromise;
  const tensor = await extractor(sentences,{pooling:'mean',normalize:true});
  const vectors = tensor.tolist();
  if (!Array.isArray(vectors) || vectors.length !== sentences.length ||
      vectors.some(row=>!Array.isArray(row)||row.length!==384)) {
    throw new Error('Unexpected model tensor shape');
  }
  return vectors;
}
