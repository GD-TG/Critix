import type { MantineColorsTuple } from "@mantine/core";

export const actionLogo = new URL("./action-logo-transparent.png", import.meta.url).href;

export const actionRed: MantineColorsTuple = [
  "#fff0f2", "#ffe0e4", "#ffc1cb", "#ff9baa", "#f46b83",
  "#e9415e", "#d20a2e", "#b90a29", "#960821", "#79071c",
];

export const actionTheme = {
  fontFamily: "'IBM Plex Sans', sans-serif",
  primaryColor: "red",
  colors: { red: actionRed, blue: actionRed },
};
