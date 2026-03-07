/**
 * i18n setup using react-i18next.
 * Languages: English (primary), Russian (secondary).
 * Add more by creating src/i18n/[locale].json and importing below.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ru from "./ru.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;

/** Apply a locale change at runtime. */
export async function setLocale(locale: string): Promise<void> {
  await i18n.changeLanguage(locale);
}
