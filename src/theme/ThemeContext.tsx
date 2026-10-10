import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors } from "./colors";

type Theme = "dark" | "light" | "system";
type ColorSet = typeof darkColors;

interface ThemeContextValue {
  theme: Theme;
  colors: ColorSet;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: true,
});

const STORAGE_KEY = "vimox_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "dark" || saved === "light" || saved === "system") {
        setThemeState(saved);
      }
    });
  }, []);

  async function setTheme(t: Theme) {
    setThemeState(t);
    await AsyncStorage.setItem(STORAGE_KEY, t);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const isDark =
    theme === "system" ? systemScheme === "dark" : theme === "dark";
  const activeColors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{ theme, colors: activeColors, toggleTheme, setTheme, isDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
