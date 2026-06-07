
export const availableLanguages: Record<string, string> = {
  en: "🇬🇧 English",
  zh: "🇨🇳 中文",
  vi: "🇻🇳 Tiếng Việt",
  ko: "🇰🇷 한국어",
  th: "🇹🇭 ภาษาไทย",
  fr: "🇫🇷 Français",
  de: "🇩🇪 Deutsch",
  es: "🇪🇸 Español",
  it: "🇮🇹 Italiano",
  pt: "🇵🇹 Português",
  ru: "🇷🇺 Русский",
  tr: "🇹🇷 Türkçe",
  ar: "🇸🇦 العربية",
  fa: "🇮🇷 فارسی",
  hi: "🇮🇳 हिन्दी",
  mr: "🇮🇳 मराठी",
  ja: "🇯🇵 日本語"
};

export const languageFiles: Record<
  string,
  () => Promise<{ default: Record<string, string> }>
> = {
  en: () => import("@/messages/en.json"),
  zh: () => import("@/messages/zh.json"),
  vi: () => import("@/messages/vi.json"),
  ko: () => import("@/messages/ko.json"),
  th: () => import("@/messages/th.json"),
  fr: () => import("@/messages/fr.json"),
  de: () => import("@/messages/de.json"),
  es: () => import("@/messages/es.json"),
  it: () => import("@/messages/it.json"),
  pt: () => import("@/messages/pt.json"),
  ru: () => import("@/messages/ru.json"),
  tr: () => import("@/messages/tr.json"),
  ar: () => import("@/messages/ar.json"),
  fa: () => import("@/messages/fa.json"),
  hi: () => import("@/messages/hi.json"),
  mr: () => import("@/messages/mr.json"),
  ja: () => import("@/messages/ja.json")
};
