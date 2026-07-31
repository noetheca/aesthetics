import {
  loadKnowledgeBase,
  type Concept,
  type ConceptTranslation,
} from "@noetheca/knowledge-engine";
import {
  getCollection,
  type CollectionEntry,
} from "astro:content";
import { normalize, resolve } from "node:path";

export interface ConceptEntry {
  entry: CollectionEntry<"concepts">;
  concept: Concept;
  translation: ConceptTranslation;
}

function sourceKey(filePath: string): string {
  const absolutePath = normalize(resolve(filePath));
  return process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;
}

export async function loadConceptEntries(): Promise<ConceptEntry[]> {
  const [entries, knowledgeBase] = await Promise.all([
    getCollection("concepts"),
    loadKnowledgeBase(resolve("concepts")),
  ]);
  const errors = knowledgeBase.issues.filter(
    ({ severity }) => severity === "error",
  );
  if (errors.length > 0) {
    throw new Error(
      `Knowledge validation failed before route generation:\n${errors
        .map(({ code, message }) => `[${code}] ${message}`)
        .join("\n")}`,
    );
  }

  const translations = new Map<
    string,
    { concept: Concept; translation: ConceptTranslation }
  >();
  for (const concept of knowledgeBase.concepts) {
    for (const translation of concept.translations.values()) {
      const key = sourceKey(translation.filePath);
      if (translations.has(key)) {
        throw new Error(`Duplicate translation source file: ${translation.filePath}`);
      }
      translations.set(key, { concept, translation });
    }
  }

  const matched = new Set<string>();
  const records = entries.map((entry) => {
    if (!entry.filePath) {
      throw new Error(`Content entry "${entry.id}" has no source file path.`);
    }
    const key = sourceKey(entry.filePath);
    const record = translations.get(key);
    if (!record) {
      throw new Error(`No concept metadata found for "${entry.filePath}".`);
    }
    if (record.translation.metadata.locale !== entry.data.locale) {
      throw new Error(`Locale mismatch for "${entry.filePath}".`);
    }
    matched.add(key);
    return { entry, ...record };
  });

  const unmatched = [...translations.keys()].filter((key) => !matched.has(key));
  if (unmatched.length > 0) {
    throw new Error(
      `Astro did not load ${unmatched.length} validated translation file(s).`,
    );
  }
  return records;
}
