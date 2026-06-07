import { languageFiles } from "./i18n";

type TranslationMap = Record<string, string>;

export async function getDictionary(
  lang: string
): Promise<TranslationMap> {
  try {
    const enLoader = languageFiles["en"];
    const currentLoader = languageFiles[lang];

    if (!enLoader) {
      return {};
    }

    // ✅ load EN fallback
    const enMod = await enLoader();
    const enData = enMod.default || {};

    // ✅ load current language
    let langData: TranslationMap = {};

    if (currentLoader) {
      const mod = await currentLoader();
      langData = mod.default || {};
    }

    // ✅ merge fallback
    return {
      ...enData,
      ...langData,
    };
  } catch (err) {
    console.error("[i18n] server load error", err);
    return {};
  }
}
