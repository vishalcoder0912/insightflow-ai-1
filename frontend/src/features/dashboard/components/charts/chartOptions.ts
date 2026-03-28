export type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "composed";

export const PRESET_PALETTES: Record<string, string[]> = {
  Cyan: ["hsl(187,85%,53%)", "hsl(200,80%,55%)", "hsl(170,70%,50%)", "hsl(210,75%,60%)", "hsl(195,80%,45%)"],
  Amber: ["hsl(38,92%,60%)", "hsl(25,90%,55%)", "hsl(45,88%,52%)", "hsl(15,85%,58%)", "hsl(50,80%,48%)"],
  Emerald: ["hsl(160,70%,45%)", "hsl(145,65%,50%)", "hsl(170,60%,40%)", "hsl(135,55%,55%)", "hsl(180,65%,42%)"],
  Rose: ["hsl(350,80%,60%)", "hsl(340,75%,55%)", "hsl(0,70%,58%)", "hsl(330,72%,52%)", "hsl(10,78%,56%)"],
  Mixed: ["hsl(187,85%,53%)", "hsl(38,92%,60%)", "hsl(160,70%,45%)", "hsl(350,80%,60%)", "hsl(270,70%,60%)"],
};

export const resolvePaletteName = (palette?: string) => {
  if (!palette) return "Mixed";

  const normalized = palette.trim().toLowerCase();
  if (!normalized) return "Mixed";
  if (normalized === "default" || normalized === "mixed" || normalized === "violet" || normalized === "purple") {
    return "Mixed";
  }
  if (normalized === "cyan" || normalized === "blue") {
    return "Cyan";
  }
  if (normalized === "amber" || normalized === "orange") {
    return "Amber";
  }
  if (normalized === "emerald" || normalized === "green") {
    return "Emerald";
  }
  if (normalized === "rose" || normalized === "pink" || normalized === "red") {
    return "Rose";
  }

  return Object.keys(PRESET_PALETTES).find((key) => key.toLowerCase() === normalized) || "Mixed";
};

export const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "scatter", label: "Scatter" },
  { value: "radar", label: "Radar" },
  { value: "composed", label: "Composed" },
];
