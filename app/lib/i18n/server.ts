import { languageFiles } from "./i18n";

export async function getDictionary(lang: string) {
  const en = await languageFiles["en"]?.();
  const current = await languageFiles[lang]?.();

  return {
    ...(en?.default || {}),
    ...(current?.default || {}),
  };
}
