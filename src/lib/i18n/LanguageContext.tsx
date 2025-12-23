"use client";

import { createContext, useContext, useState, useSyncExternalStore, ReactNode, useCallback } from "react";
import { translations, Language, Translations } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "stand-analyzer-language";

// Get language from localStorage (client-side only)
function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "pt";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "pt" || saved === "en") return saved;
  return "pt";
}

// Subscribe to storage events for cross-tab sync
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

// Server snapshot always returns "pt"
function getServerSnapshot(): Language {
  return "pt";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Use useSyncExternalStore to properly sync with localStorage
  const storedLanguage = useSyncExternalStore(
    subscribeToStorage,
    getStoredLanguage,
    getServerSnapshot
  );

  // Local state for immediate updates (before storage event fires)
  const [localLanguage, setLocalLanguage] = useState<Language | null>(null);

  // Use local state if set, otherwise use stored language
  const language = localLanguage ?? storedLanguage;

  const setLanguage = useCallback((lang: Language) => {
    setLocalLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

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
