import { createContext, useContext, useState, useEffect } from "react";

interface ThemeContextType {
  darkMode: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ darkMode: false, toggleDark: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDark: () => setDarkMode((d) => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
