// Single source of truth for the FAO suitability class color language used across the
// map (MapView.tsx), the legend, and the Dashboard's run cards/detail view - also matches
// app.css's --class-* tokens and src/xGIS.AddIn/Tools/CropSuitabilityTools.cs's
// ArcGIS Pro renderer, so a result reads the same everywhere it's shown.
export const CLASS_COLORS: Record<string, string> = {
  S1: "#1a9850",
  S2: "#91cf60",
  S3: "#fee08b",
  N: "#d73027",
};

export const CLASS_LABELS: Record<string, string> = {
  S1: "Highly suitable",
  S2: "Moderately suitable",
  S3: "Marginally suitable",
  N: "Not suitable",
};

export const CLASS_ORDER = ["S1", "S2", "S3", "N"];

export function classColor(cls: string): string {
  return CLASS_COLORS[cls] ?? CLASS_COLORS.N;
}

/** The best (lowest-N) class present in a distribution, for a single representative
 * badge on a compact card - e.g. { S1: 40, S2: 5 } -> "S1". */
export function dominantClass(classDistribution: Record<string, number>): string {
  for (const cls of CLASS_ORDER) {
    if ((classDistribution[cls] ?? 0) > 0) return cls;
  }
  return "N";
}
