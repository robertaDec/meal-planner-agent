/**
 * Recipe ingestion script.
 *
 * Reads every *.json file in data/recipes/, upserts each recipe into Postgres,
 * generates English + Italian embeddings via Voyage, and stores them.
 *
 * Safe to re-run: recipes are upserted by slug, and embeddings are deleted
 * and re-inserted per recipe, so re-running produces the same clean state.
 *
 * Usage:
 *   npx tsx scripts/ingest-recipes.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { supabase } from "../lib/supabase";
import { embed, EMBED_MODEL } from "../lib/voyage";

type RecipeFile = {
  slug: string;
  title_en: string;
  title_it: string;
  description_en?: string;
  description_it?: string;
  ingredients: Array<{
    name_en: string;
    name_it: string;
    amount: number | null;
    unit: string | null;
    optional?: boolean;
  }>;
  steps_en: string[];
  steps_it: string[];
  total_minutes?: number;
  active_minutes?: number;
  servings?: number;
  tags?: string[];
  source?: string[];
};

/**
 * Build the text we actually embed for a recipe in a given language.
 * Includes title, description, ingredient names, and tags — the fields that
 * matter for retrieval. NOT the full step-by-step instructions, because they
 * add length without helping search quality much.
 */
function buildEmbedText(r: RecipeFile, language: "en" | "it"): string {
  const title = language === "en" ? r.title_en : r.title_it;
  const description = language === "en" ? r.description_en : r.description_it;
  const ingredients = r.ingredients
    .map((i) => (language === "en" ? i.name_en : i.name_it))
    .join(", ");
  const tags = (r.tags ?? []).join(", ");

  return [
    title,
    description ?? "",
    `Ingredients: ${ingredients}`,
    `Tags: ${tags}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const dir = join(process.cwd(), "data", "recipes");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No recipe JSON files found in data/recipes/");
    return;
  }

  console.log(`Ingesting ${files.length} recipe file(s)...\n`);

  for (const [index, file] of files.entries()) {
    if (index > 0) {
      await new Promise((r) => setTimeout(r, 21_000));
    }
    const raw = await readFile(join(dir, file), "utf-8");
    const recipe = JSON.parse(raw) as RecipeFile;

    // 1. Upsert the recipe row (create if new, update if existing).
    const { data: upserted, error: upserErr } = await supabase
      .from("recipes")
      .upsert(
        {
          slug: recipe.slug,
          title_en: recipe.title_en,
          title_it: recipe.title_it,
          description_en: recipe.description_en ?? null,
          description_it: recipe.description_it ?? null,
          ingredients: recipe.ingredients,
          steps_en: recipe.steps_en,
          steps_it: recipe.steps_it,
          total_minutes: recipe.total_minutes,
          active_minutes: recipe.active_minutes ?? null,
          servings: recipe.servings ?? 4,
          tags: recipe.tags ?? [],
          source: recipe.source ?? "personal",
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (upserErr || !upserted) {
      console.error(` ✗${recipe.slug}: ${upserErr?.message}`);
      continue;
    }

    const recipeId = upserted.id as string;

    // 2. Generate both language embeddings in ONE Voyage call.
    const [enVec, itVec] = await embed([
      buildEmbedText(recipe, "en"),
      buildEmbedText(recipe, "it"),
    ]);

    // 3. Wipe existing embeddings for this recipe + model, then re-insert.
    // This makes the script idempotent — safe to re-run without duplicates.
    await supabase
      .from("recipe_embeddings")
      .delete()
      .eq("recipe_id", recipeId)
      .eq("model", EMBED_MODEL);

    const { error: embErr } = await supabase.from("recipe_embeddings").insert([
      {
        recipe_id: recipeId,
        language: "en",
        embedding: enVec,
        embed_text: buildEmbedText(recipe, "en"),
        model: EMBED_MODEL,
      },
      {
        recipe_id: recipeId,
        language: "it",
        embedding: itVec,
        embed_text: buildEmbedText(recipe, "it"),
        model: EMBED_MODEL,
      },
    ]);

    if (embErr) {
      console.error(`  ✗ ${recipe.slug} embeddings: ${embErr.message}`);
    } else {
      console.log(`  ✓ ${recipe.slug}`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
