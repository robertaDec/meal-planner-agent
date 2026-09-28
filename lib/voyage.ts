import { VoyageAIClient } from "voyageai";

if (!process.env.VOYAGE_API_KEY) {
  throw new Error("Missing VOYAGE_API_KEY in enviroment");
}

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export const EMBED_MODEL = "voyage-3";

/**
 * 'inputType' matters for retrieval quality:
 *      - 'document' for recipes that are indexing
 *      - 'query' for user search queries
 * Voyage tunes the embedding slightly differently depending on which side of the search it is on
 */
export async function embed(
  texts: string[],
  inputType: "document" | "query" = "document",
): Promise<number[][]> {
  const result = await voyage.embed({
    input: texts,
    model: EMBED_MODEL,
    inputType,
  });

  if (!result.data) throw new Error("Voyage returned no embeddings");
  return result.data.map((d) => d.embedding as number[]);
}

export async function embedOne(
  text: string,
  inputType: "document" | "query" = "document",
): Promise<number[]> {
  const [vec] = await embed([text], inputType);
  return vec;
}
