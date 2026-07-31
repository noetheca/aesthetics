import {
  createTranslationFileIndex,
  loadKnowledgeBase,
  normalizeTranslationFilePath,
  type Concept,
  type ConceptTranslation,
} from "@noetheca/knowledge-engine";
import {
  getCollection,
  type CollectionEntry,
} from "astro:content";
import { resolve } from "node:path";

export interface ConceptEntry {
  entry: CollectionEntry<"concepts">;
  concept: Concept;
  translation: ConceptTranslation;
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

  const translationIndex = createTranslationFileIndex(knowledgeBase);
  const matchedFiles = new Set<string>();
  const records = entries.map((entry) => {
    if (!entry.filePath) {
      throw new Error(`Content entry "${entry.id}" has no source file path.`);
    }

    const fileKey = normalizeTranslationFilePath(entry.filePath);
    const record = translationIndex.get(fileKey);
    if (!record) {
      throw new Error(
        `No concept metadata found for content file "${entry.filePath}".`,
      );
    }
    if (record.translation.metadata.locale !== entry.data.locale) {
      throw new Error(
        `Locale mismatch for "${entry.filePath}": Astro loaded ` +
          `"${entry.data.locale}", engine loaded ` +
          `"${record.translation.metadata.locale}".`,
      );
    }
    matchedFiles.add(fileKey);
    return { entry, ...record };
  });

  const unmatched = [...translationIndex.keys()].filter(
    (fileKey) => !matchedFiles.has(fileKey),
  );
  if (unmatched.length > 0) {
    throw new Error(
      `Astro did not load ${unmatched.length} validated translation file(s):\n` +
        unmatched.join("\n"),
    );
  }

  return records;
}
