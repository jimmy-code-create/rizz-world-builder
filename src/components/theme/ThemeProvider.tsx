import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { applyTheme, type ThemePreset, type ThemeMode, type Density } from "@/lib/theme";
import { readLocalStorage, writeLocalStorage } from "@/lib/safe-storage";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  useEffect(() => {
    // Read from profile or localStorage fallback
    const preset = (profile?.theme_preset as ThemePreset) || (readLocalStorage("rizz.theme") as ThemePreset) || "nightclub";
    const mode = (profile?.theme_mode as ThemeMode) || (readLocalStorage("rizz.mode") as ThemeMode) || "auto";
    const density = (profile?.ui_density as Density) || (readLocalStorage("rizz.density") as Density) || "comfy";
    const reduced = profile?.reduced_motion ?? (readLocalStorage("rizz.reduced") === "1");
    applyTheme(preset, mode, density, reduced);
    writeLocalStorage("rizz.theme", preset);
    writeLocalStorage("rizz.mode", mode);
    writeLocalStorage("rizz.density", density);
    writeLocalStorage("rizz.reduced", reduced ? "1" : "0");
  }, [profile?.theme_preset, profile?.theme_mode, profile?.ui_density, profile?.reduced_motion]);

  return <>{children}</>;
}