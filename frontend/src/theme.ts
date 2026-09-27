import type { MantineColorsTuple } from "@mantine/core";

export const actionLogo = new URL("./action-logo-transparent.png", import.meta.url).href;

export const actionRed: MantineColorsTuple = [
  "#fff0f2", "#ffe0e4", "#ffc1cb", "#ff9baa", "#f46b83",
  "#e9415e", "#d20a2e", "#b90a29", "#960821", "#79071c",
];

export const actionTheme = {
  fontFamily:
    '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
  primaryColor: "red",
  colors: { red: actionRed, blue: actionRed },
  defaultRadius: "md",
  radius: {
    xs: "6px",
    sm: "10px",
    md: "16px",
    lg: "20px",
    xl: "24px",
  },
  headings: {
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "30px", lineHeight: "1.15" },
      h2: { fontSize: "21px", lineHeight: "1.25" },
      h3: { fontSize: "17px", lineHeight: "1.3" },
    },
  },
};
