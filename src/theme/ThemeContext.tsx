import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors } from "./colors";

type Theme = "dark" | "light";
type ColorSet = typeof darkColors;

interface ThemeContextValue {
  theme: Theme;
  colors: ColorSet;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  colors: darkColors,
  toggleTheme: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(
    systemScheme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    if (systemScheme) setTheme(systemScheme);
  }, [systemScheme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  const activeColors = theme === "dark" ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors: activeColors,
        toggleTheme,
        isDark: theme === "dark",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
