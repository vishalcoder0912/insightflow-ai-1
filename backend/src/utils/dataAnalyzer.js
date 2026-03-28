const MAX_CATEGORY_POINTS = 10;
const MAX_PREVIEW_ROWS = 12;

const normalizeText = (value) => String(value ?? "").trim();

const normalizeKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const toNumber = (value) => {
  const raw = normalizeText(value).replace(/,/g, "");
  if (!raw) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const toTimestamp = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (/^\d{4}$/.test(raw)) {
    return Date.UTC(Number(raw), 0, 1);
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
};

const buildRecords = (dataset) => {
  if (Array.isArray(dataset.records) && dataset.records.length) {
    return dataset.records;
  }

  if (!Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) {
    return [];
  }

  return dataset.rows.map((row) =>
    Object.fromEntries(
      dataset.headers.map((header, index) => [header, row?.[index] ?? ""]),
    ),
  );
};

const inferColumnType = ({ numericValues, timestampValues, values, uniqueCount }) => {
  if (numericValues.length && numericValues.length >= values.length * 0.85) {
    return "numeric";
  }

  if (timestampValues.length && timestampValues.length >= values.length * 0.75) {
    return "datetime";
  }

  if (uniqueCount <= Math.max(12, Math.ceil(values.length * 0.2))) {
    return "categorical";
  }

  return "text";
};

const inferColumnRole = (name, detectedType, uniqueCount, rowCount) => {
  const key = normalizeKey(name);

  if (/(^|_)(id|uuid|code|index)(_|$)/.test(key)) {
    return "identifier";
  }

  if (detectedType === "numeric") {
    return uniqueCount >= Math.max(8, Math.ceil(rowCount * 0.15)) ? "measure" : "dimension";
  }

  if (detectedType === "datetime") {
    return "time";
  }

  return "dimension";
};

const summarizeColumn = (name, values, rowCount) => {
  const filledValues = values.filter((value) => normalizeText(value) !== "");
  const numericValues = filledValues.map(toNumber).filter((value) => value !== null);
  const timestampValues = filledValues.map(toTimestamp).filter((value) => value !== null);
  const uniqueValues = [...new Set(filledValues.map((value) => normalizeText(value)))];
  const detectedType = inferColumnType({
    numericValues,
    timestampValues,
    values: filledValues,
    uniqueCount: uniqueValues.length,
  });
  const role = inferColumnRole(name, detectedType, uniqueValues.length, rowCount);
  const categoryCounts = new Map();

  filledValues.forEach((value) => {
    const key = normalizeText(value) || "Unknown";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  });

  const topValues = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([value, count]) => ({ value, count }));

  const numericStats = numericValues.length
    ? {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        average: Number(average(numericValues).toFixed(2)),
        sum: Number(numericValues.reduce((total, value) => total + value, 0).toFixed(2)),
      }
    : {};

  return {
    name,
    key: normalizeKey(name),
    filled: filledValues.length,
    empty: Math.max(rowCount - filledValues.length, 0),
    unique: uniqueValues.length,
    sampleValues: uniqueValues.slice(0, 5),
    numeric: detectedType === "numeric",
    detectedType,
    role,
    topValues,
    ...numericStats,
  };
};

const buildCategoryMetricChart = (records, dimension, measure, metric = "sum", chartType = "bar") => {
  if (!dimension) return null;

  const grouped = new Map();

  records.forEach((record) => {
    const label = normalizeText(record[dimension.name]) || "Unknown";
    const metricValue = measure ? toNumber(record[measure.name]) : null;
    const current = grouped.get(label) || { count: 0, total: 0 };

    current.count += 1;
    current.total += metricValue ?? 0;
    grouped.set(label, current);
  });

  const data = [...grouped.entries()]
    .map(([label, values]) => ({
      name: label,
      value: Number((metric === "count" ? values.count : values.total).toFixed(2)),
      x: label,
      label,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, MAX_CATEGORY_POINTS);

  if (!data.length) return null;

  return {
    title: measure
      ? `${measure.name} by ${dimension.name}`
      : `${dimension.name} distribution`,
    type: chartType,
    xKey: "name",
    dataKey: "value",
    data,
    config: {
      xLabel: dimension.name,
      yLabel: measure ? measure.name : "Count",
      showGrid: chartType !== "pie",
      showLegend: chartType === "pie",
      curved: chartType === "line" || chartType === "area",
      palette: "cyan",
    },
  };
};

const buildTimeSeriesChart = (records, timeColumn, measure) => {
  if (!timeColumn || !measure) return null;

  const grouped = new Map();

  records.forEach((record) => {
    const timestamp = toTimestamp(record[timeColumn.name]);
    const numericValue = toNumber(record[measure.name]);

    if (timestamp === null || numericValue === null) {
      return;
    }

    const date = new Date(timestamp);
    const bucket = timeColumn.detectedType === "datetime"
      ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
      : String(record[timeColumn.name]);

    grouped.set(bucket, (grouped.get(bucket) || 0) + numericValue);
  });

  const data = [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(0, MAX_PREVIEW_ROWS)
    .map(([label, value]) => ({
      name: label,
      value: Number(value.toFixed(2)),
      x: label,
      label,
    }));

  if (data.length < 2) return null;

  return {
    title: `${measure.name} over ${timeColumn.name}`,
    type: "line",
    xKey: "name",
    dataKey: "value",
    data,
    config: {
      xLabel: timeColumn.name,
      yLabel: measure.name,
      showGrid: true,
      showLegend: false,
      curved: true,
      palette: "emerald",
    },
  };
};

const buildScatterChart = (records, firstMeasure, secondMeasure) => {
  if (!firstMeasure || !secondMeasure) return null;

  const data = records
    .slice(0, MAX_PREVIEW_ROWS)
    .map((record, index) => {
      const xValue = toNumber(record[firstMeasure.name]);
      const yValue = toNumber(record[secondMeasure.name]);

      if (xValue === null || yValue === null) {
        return null;
      }

      return {
        name: `Row ${index + 1}`,
        value: yValue,
        x: xValue,
        y: yValue,
        label: `Row ${index + 1}`,
      };
    })
    .filter((point) => point !== null);

  if (data.length < 3) return null;

  return {
    title: `${firstMeasure.name} vs ${secondMeasure.name}`,
    type: "scatter",
    xKey: "x",
    dataKey: "y",
    data,
    config: {
      xLabel: firstMeasure.name,
      yLabel: secondMeasure.name,
      showGrid: true,
      showLegend: false,
      palette: "amber",
    },
  };
};

const buildPatterns = (columns, rowCount) => {
  const patterns = [];
  const measures = columns.filter((column) => column.role === "measure");
  const dimensions = columns.filter((column) => column.role === "dimension");
  const temporal = columns.filter((column) => column.role === "time");

  if (measures[0]) {
    patterns.push({
      type: "measure",
      message: `${measures[0].name} averages ${measures[0].average ?? 0} across ${rowCount} rows.`,
      confidence: 0.72,
    });
  }

  if (dimensions[0]?.topValues?.length) {
    const leader = dimensions[0].topValues[0];
    patterns.push({
      type: "distribution",
      message: `${dimensions[0].name} is led by ${leader.value} with ${leader.count} rows.`,
      confidence: 0.68,
    });
  }

  if (temporal[0] && measures[0]) {
    patterns.push({
      type: "trend",
      message: `${temporal[0].name} can be used to chart ${measures[0].name} over time.`,
      confidence: 0.74,
    });
  }

  return patterns;
};

export const buildTablePayload = (headers, rows) => ({
  columns: headers,
  rows: rows.map((row) =>
    Object.fromEntries(headers.map((header) => [header, row[header] ?? ""])),
  ),
});

export const buildDatasetFeatures = (dataset) => {
  const records = buildRecords(dataset);
  const rowCount = records.length;
  const headers = Array.isArray(dataset.headers) ? dataset.headers : [];
  const columns = headers.map((header) =>
    summarizeColumn(
      header,
      records.map((record) => record?.[header] ?? ""),
      rowCount,
    ),
  );
  const dimensions = columns.filter((column) => column.role === "dimension");
  const measures = columns.filter((column) => column.role === "measure");
  const temporalColumns = columns.filter((column) => column.role === "time");
  const chartSuggestions = [
    buildTimeSeriesChart(records, temporalColumns[0], measures[0]),
    buildCategoryMetricChart(records, dimensions[0], measures[0], "sum", "bar"),
    dimensions[0] ? buildCategoryMetricChart(records, dimensions[0], null, "count", "pie") : null,
    buildScatterChart(records, measures[0], measures[1]),
  ].filter((chart) => chart !== null);
  const patterns = buildPatterns(columns, rowCount);

  return {
    datasetId: String(dataset.id ?? "current"),
    fileName: dataset.fileName,
    rowCount,
    columnCount: headers.length,
    schema: columns.map((column) => `${column.name}:${column.detectedType}/${column.role}`).join(", "),
    headers,
    columns,
    dimensions,
    measures,
    temporalColumns,
    chartSuggestions,
    patterns,
    availableChartTypes: ["bar", "line", "pie", "scatter", "area"],
    previewTable: buildTablePayload(headers, records.slice(0, Math.min(MAX_PREVIEW_ROWS, rowCount))),
  };
};

export const detectMentionedColumns = (message, columns) => {
  const normalizedMessage = normalizeKey(message);

  return columns.filter((column) => {
    const normalizedName = normalizeKey(column.name);
    return normalizedMessage.includes(normalizedName) || normalizedMessage.includes(normalizedName.replace(/_/g, ""));
  });
};

export const detectFilters = (message, features, records) => {
  const normalizedMessage = normalizeText(message).toLowerCase();
  const filters = [];

  features.dimensions
    .filter((column) => column.unique <= 24)
    .forEach((column) => {
      const values = [...new Set(records.map((record) => normalizeText(record[column.name])).filter(Boolean))];
      const matchedValue = values.find((value) => normalizedMessage.includes(value.toLowerCase()));

      if (matchedValue) {
        filters.push({
          column: column.name,
          operator: "eq",
          value: matchedValue,
        });
      }
    });

  return filters;
};

export const applyFilters = (records, filters) =>
  records.filter((record) =>
    filters.every((filter) => {
      const rawValue = record[filter.column];

      if (filter.operator === "eq") {
        return normalizeText(rawValue).toLowerCase() === normalizeText(filter.value).toLowerCase();
      }

      const numericValue = toNumber(rawValue);
      const targetValue = toNumber(filter.value);
      if (numericValue === null || targetValue === null) {
        return false;
      }

      if (filter.operator === "gt") return numericValue > targetValue;
      if (filter.operator === "gte") return numericValue >= targetValue;
      if (filter.operator === "lt") return numericValue < targetValue;
      if (filter.operator === "lte") return numericValue <= targetValue;
      return false;
    }),
  );

export const aggregateRecords = ({
  records,
  dimension,
  measure,
  metric = "count",
  limit = MAX_CATEGORY_POINTS,
  sortDirection = "desc",
}) => {
  const grouped = new Map();

  records.forEach((record) => {
    const key = dimension ? normalizeText(record[dimension]) || "Unknown" : "Result";
    const numericValue = measure ? toNumber(record[measure]) : null;
    const current = grouped.get(key) || {
      count: 0,
      total: 0,
      max: Number.NEGATIVE_INFINITY,
      min: Number.POSITIVE_INFINITY,
    };

    current.count += 1;

    if (numericValue !== null) {
      current.total += numericValue;
      current.max = Math.max(current.max, numericValue);
      current.min = Math.min(current.min, numericValue);
    }

    grouped.set(key, current);
  });

  const rows = [...grouped.entries()].map(([label, stats]) => {
    if (metric === "sum") {
      return { label, value: Number(stats.total.toFixed(2)) };
    }

    if (metric === "average") {
      return { label, value: Number((stats.total / Math.max(stats.count, 1)).toFixed(2)) };
    }

    if (metric === "min") {
      return { label, value: Number.isFinite(stats.min) ? stats.min : stats.count };
    }

    if (metric === "max") {
      return { label, value: Number.isFinite(stats.max) ? stats.max : stats.count };
    }

    return { label, value: stats.count };
  });

  rows.sort((left, right) =>
    sortDirection === "asc" ? left.value - right.value : right.value - left.value,
  );

  return rows.slice(0, limit);
};

export const buildChartFromAggregation = ({
  title,
  chartType,
  dimension,
  measureLabel,
  rows,
}) => {
  if (!rows.length) return null;

  return {
    title,
    type: chartType,
    xKey: "name",
    dataKey: "value",
    data: rows.map((row) => ({
      name: row.label,
      value: Number(row.value),
      x: row.label,
      label: row.label,
    })),
    config: {
      xLabel: dimension || "Result",
      yLabel: measureLabel || "Value",
      showGrid: chartType !== "pie",
      showLegend: chartType === "pie",
      curved: chartType === "line" || chartType === "area",
      palette: "cyan",
    },
  };
};

export const buildQueryTable = (dimension, rows) =>
  buildTablePayload(
    dimension ? [dimension, "value"] : ["value"],
    rows.map((row) => (dimension ? { [dimension]: row.label, value: row.value } : { value: row.value })),
  );
