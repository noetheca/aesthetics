import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const source = z.union([
  z.url(),
  z.object({
    title: z.string().min(1),
    url: z.url(),
    note: z.string().optional(),
  }),
]);

const concepts = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./concepts",
    deferRender: true,
  }),
  schema: z.object({
    locale: z.string().min(2),
    title: z.string().min(1),
    summary: z.string().min(1),
    sources: z.array(source),
    status: z.enum(["draft", "review", "published"]),
  }),
});

export const collections = { concepts };
