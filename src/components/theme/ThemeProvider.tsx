import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { applyTheme, type ThemePreset, type ThemeMode, type Density } from "@/lib/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  useEffect(() => {
    // Read from profile or localStorage fallback
    const preset = (profile?.theme_preset as ThemePreset) || (localStorage.getItem("rizz.theme") as ThemePreset) || "nightclub";
    const mode = (profile?.theme_mode as ThemeMode) || (localStorage.getItem("rizz.mode") as ThemeMode) || "dark";
    const density = (profile?.ui_density as Density) || (localStorage.getItem("rizz.density") as Density) || "comfy";
    const reduced = profile?.reduced_motion ?? (localStorage.getItem("rizz.reduced") === "1");
    applyTheme(preset, mode, density, reduced);
    localStorage.setItem("rizz.theme", preset);
    localStorage.setItem("rizz.mode", mode);
    localStorage.setItem("rizz.density", density);
    localStorage.setItem("rizz.reduced", reduced ? "1" : "0");
  }, [profile?.theme_preset, profile?.theme_mode, profile?.ui_density, profile?.reduced_motion]);

  return <>{children}</>;
}