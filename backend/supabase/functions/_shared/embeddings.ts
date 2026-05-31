import { createGeminiClient, withGeminiRetry } from "./gemini.ts";

export interface EmbedOptions {
  model?: string;
}

const getEmbeddingModel = (options?: EmbedOptions): string => {
  if (options?.model) return options.model;
  
  // Safe Deno environment check (runs in Edge Functions)
  try {
    return Deno.env.get("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-2";
  } catch {
    return "gemini-embedding-2"; // Fallback for local testing if env is not accessible
  }
};

/**
 * Clean text to prevent empty inputs and limit size.
 */
function cleanTextForEmbedding(text: string): string {
  const cleaned = (text || "").trim();
  if (!cleaned) return "empty";
  // Limit to roughly 8k characters to prevent overflow
  return cleaned.slice(0, 8000);
}

/**
 * Generate a 768-dimension vector embedding for a single text fragment.
 */
export async function embedText(text: string, options?: EmbedOptions): Promise<number[]> {
  const cleaned = cleanTextForEmbedding(text);
  const model = getEmbeddingModel(options);
  const ai = createGeminiClient();

  return withGeminiRetry(async () => {
    const response = await ai.models.embedContent({
      model,
      contents: cleaned,
      config: {
        outputDimensionality: 768,
      },
    });

    if (Array.isArray(response?.embeddings) && response.embeddings[0]?.values) {
      return response.embeddings[0].values;
    }

    if (!response?.embedding?.values) {
      throw new Error(`Invalid response structure from Gemini embedContent: ${JSON.stringify(response)}`);
    }

    return response.embedding.values;
  });
}

/**
 * Generate embeddings for a batch of text fragments.
 */
export async function embedBatch(texts: string[], options?: EmbedOptions): Promise<number[][]> {
  if (!texts.length) return [];
  const model = getEmbeddingModel(options);
  const ai = createGeminiClient();

  // Process in small batches of 20 to prevent hitting size limits in a single call
  const batchSize = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize).map(cleanTextForEmbedding);

    const chunkResults = await withGeminiRetry(async () => {
      // In the @google/genai SDK, embedContent can take a string or string[]
      const response = await ai.models.embedContent({
        model,
        contents: slice,
        config: {
          outputDimensionality: 768,
        },
      });

      // If batch output, values might be nested, or returned as an array of embeddings
      if (Array.isArray(response?.embeddings)) {
        return response.embeddings.map((emb: any) => emb.values);
      } else if (response?.embedding?.values) {
        return [response.embedding.values];
      }
      throw new Error(`Invalid response structure from Gemini embedContent batch: ${JSON.stringify(response)}`);
    });

    results.push(...chunkResults);
  }

  return results;
}
