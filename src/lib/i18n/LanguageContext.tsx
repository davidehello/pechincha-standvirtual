"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language, Translations } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "stand-analyzer-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with "pt" to match server render
  const [language, setLanguageState] = useState<Language>("pt");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved language from localStorage after mount (client-side only)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pt" || saved === "en") {
      setLanguageState(saved);
    }
    setIsHydrated(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
