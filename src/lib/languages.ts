import type { KnowledgeLanguageOption } from "@noetheca/knowledge-engine";

export type SiteLanguageOption = KnowledgeLanguageOption;

export const siteLanguages: readonly SiteLanguageOption[] = [
  {
    id: "JP",
    label: "日本語",
    locale: "ja",
  },
  {
    id: "EN",
    label: "English",
    locale: "en",
  },
];
