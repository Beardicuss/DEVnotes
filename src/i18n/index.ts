import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ru from "./ru.json";
import ge from "./ge.json";

// Read saved locale synchronously before init so the first render is already correct
function getSavedLocale(): string {
  try {
    const raw = localStorage.getItem("devnotes_desktop_v2");
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.settings?.locale) return data.settings.locale;
    }
  } catch {}
  return "en";
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      ge: { translation: ge },
    },
    lng: getSavedLocale(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;

export async function setLocale(locale: string): Promise<void> {
  await i18n.changeLanguage(locale);
}
