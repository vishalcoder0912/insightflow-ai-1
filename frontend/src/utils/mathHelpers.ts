export const mean = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const variance = (values: number[]) => {
  if (!values.length) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
};

export const std = (values: number[]) => Math.sqrt(variance(values));

export interface RegressionPoint {
  x: number;
  y: number;
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export const linearRegression = (points: RegressionPoint[]): LinearRegressionResult | null => {
  if (points.length < 2) return null;

  const meanX = mean(points.map((point) => point.x));
  const meanY = mean(points.map((point) => point.y));

  let numerator = 0;
  let denominator = 0;

  points.forEach((point) => {
    const dx = point.x - meanX;
    numerator += dx * (point.y - meanY);
    denominator += dx * dx;
  });

  if (!denominator) return null;

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  points.forEach((point) => {
    const predicted = slope * point.x + intercept;
    ssRes += (point.y - predicted) ** 2;
    ssTot += (point.y - meanY) ** 2;
  });

  const rSquared = ssTot ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  return { slope, intercept, rSquared };
};
