import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang, translations, Translations } from '@/i18n/translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('fg_lang') as Lang) || 'en';
  });

  const setLang = (l: Lang) => {
    localStorage.setItem('fg_lang', l);
    setLangState(l);
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    if (lang === 'ar') {
      document.documentElement.classList.add('lang-ar');
    } else {
      document.documentElement.classList.remove('lang-ar');
    }
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
