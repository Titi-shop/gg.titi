"use client";

import { useState, useEffect } from "react";
import { languageFiles, availableLanguages } from "../i18n";

type TranslationMap = Record<string, string>;

export function useTranslationClient() {
  /* ================= INIT LANG (AUTO DETECT) ================= */

  const [lang, setLang] = useState<string>(() => {
    if (typeof window === "undefined") return "en";

    // 1. user đã chọn
    const saved = localStorage.getItem("lang");
    if (saved && saved in availableLanguages) {
      return saved;
    }

    // 2. detect từ Pi Browser / device
    const browserLang = navigator.language.toLowerCase();

    const matched = Object.keys(availableLanguages).find((key) =>
      browserLang.startsWith(key)
    );

    return matched || "en";
  });

  const [t, setT] = useState<TranslationMap>({});

  /* ================= LOAD TRANSLATION ================= */

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const loader = languageFiles[lang];
        const enLoader = languageFiles["en"];

        if (!enLoader) return;

        // ✅ load EN fallback
        const enMod = await enLoader();
        const enData = enMod.default || {};

        // ✅ load current language
        let langData: TranslationMap = {};

        if (loader) {
          const mod = await loader();
          langData = mod.default || {};
        }

        // ✅ merge fallback
        const merged: TranslationMap = {
          ...enData,
          ...langData,
        };

        if (active) {
          setT(merged);
        }
      } catch (err) {
        console.error("[i18n] load error", err);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [lang]);

  /* ================= LISTEN CHANGE EVENT ================= */

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (typeof custom.detail === "string") {
        setLang(custom.detail);
      }
    };

    window.addEventListener("language-change", handler);

    return () => {
      window.removeEventListener("language-change", handler);
    };
  }, []);

  /* ================= CHANGE LANGUAGE ================= */

  const setLanguage = (newLang: string) => {
    if (typeof window === "undefined") return;

    if (!(newLang in availableLanguages)) return;

    localStorage.setItem("lang", newLang);
    setLang(newLang);

    window.dispatchEvent(
      new CustomEvent("language-change", { detail: newLang })
    );
  };

  return {
    t,
    lang,
    setLang: setLanguage,
  };
}
