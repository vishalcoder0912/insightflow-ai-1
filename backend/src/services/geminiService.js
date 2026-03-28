import { env } from "../config/env.js";

const buildDatasetPrompt = ({ dataset, question }) => {
  const summary = dataset.summary;
  const preview = dataset.previewRows.slice(0, 8);

  return `
You are an expert analytics assistant for CSV datasets. Your role is to:
1. Answer questions about the data accurately
2. Generate SQL queries when relevant
3. Provide actionable insights
4. Return visualizable chart data when appropriate

Dataset file: ${dataset.fileName}
Row count: ${dataset.totalRows}
Columns: ${dataset.headers.join(", ")}

Dataset Summary:
${JSON.stringify(summary, null, 2)}

Preview rows (first 8):
${JSON.stringify(preview, null, 2)}

User question:
${question}

IMPORTANT: You MUST return ONLY a valid JSON object with this EXACT structure:
{
  "answer": "A clear, concise markdown answer to the user's question. Keep it 1-3 sentences.",
  "sql": "Optional SQL query (empty string if not applicable). Use standard SQL syntax.",
  "insights": ["insight1", "insight2", "insight3"],
  "chart": {
    "title": "Descriptive chart title",
    "type": "bar|line|pie|area|scatter",
    "dataKey": "value",
    "data": [
      {
        "name": "Category A",
        "value": 100,
        "x": "Category A",
        "label": "Category A"
      },
      {
        "name": "Category B",
        "value": 150,
        "x": "Category B",
        "label": "Category B"
      }
    ]
  }
}

REQUIREMENTS:
- Return ONLY valid JSON, no markdown formatting
- data array must have 3-8 points
- Each data point MUST have: name, value, x, label (all required)
- All numbers must be valid (not strings)
- Chart type must be one of: bar, line, pie, area, scatter
- If no chart is needed, return null for chart field
- Keep answer concise and data-driven
- Include specific numbers from the data
- Return 2-4 insights, each 1-2 sentences
  `.trim();
};

const validateChart = (chart) => {
  if (!chart || typeof chart !== "object") {
    return null;
  }

  if (!Array.isArray(chart.data) || chart.data.length === 0) {
    return null;
  }

  const validData = chart.data
    .filter((point) => {
      if (!point || typeof point !== "object") return false;

      const hasLabel = point.name || point.label || point.x;
      const hasValidValue = typeof point.value === "number" && !Number.isNaN(point.value);

      return hasLabel && hasValidValue;
    })
    .map((point) => ({
      name: String(point.name || point.label || point.x || "Unknown"),
      value: Number(point.value),
      x: String(point.x || point.name || point.label || "Unknown"),
      label: String(point.label || point.name || point.x || "Unknown"),
    }));

  if (validData.length === 0) {
    return null;
  }

  const validTypes = ["bar", "line", "pie", "area", "scatter"];
  const chartType = String(chart.type || "bar").toLowerCase();

  return {
    title: String(chart.title || "Chart"),
    type: validTypes.includes(chartType) ? chartType : "bar",
    dataKey: String(chart.dataKey || "value"),
    data: validData,
  };
};

const parseGeminiResponse = (payload) => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini response did not include text output.");
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      answer: text,
      sql: "",
      insights: [],
      chart: null,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return {
      answer: text,
      sql: "",
      insights: [],
      chart: null,
    };
  }

  return {
    answer: parsed.answer || "No answer available.",
    sql: typeof parsed.sql === "string" ? parsed.sql : "",
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    chart: validateChart(parsed.chart),
  };
};

const generateFallback = ({ dataset, question }) => {
  const summary = dataset.summary;
  const lowerQuestion = question.toLowerCase();

  const primaryInsight =
    summary.insights?.[0] ||
    `The dataset contains ${dataset.totalRows} rows and ${dataset.headers.length} columns.`;

  const answerText = `${primaryInsight}\n\n${(summary.insights || []).slice(1, 3).join("\n")}`.trim();

  let sql = "";
  if (lowerQuestion.includes("top") || lowerQuestion.includes("highest")) {
    const numericColumn = summary.columns?.find((column) => column.numeric);
    if (numericColumn) {
      sql = `SELECT *\nFROM dataset\nORDER BY "${numericColumn.name}" DESC\nLIMIT 5;`;
    }
  }

  let fallbackChart = null;
  if (Array.isArray(summary.chartSuggestions) && summary.chartSuggestions.length > 0) {
    const suggestion = summary.chartSuggestions[0];
    const chartData = (suggestion.data || [])
      .filter((point) => typeof point.value === "number" && !Number.isNaN(point.value))
      .map((point) => ({
        name: String(point.name || "Unknown"),
        value: Number(point.value),
        x: String(point.x || point.name || "Unknown"),
        label: String(point.label || point.name || "Unknown"),
      }));

    if (chartData.length > 0) {
      fallbackChart = validateChart({
        title: suggestion.title || "Data Visualization",
        type: suggestion.type || "bar",
        dataKey: suggestion.dataKey || "value",
        data: chartData,
      });
    }
  }

  return {
    answer: answerText,
    sql,
    insights: summary.insights || [],
    chart: fallbackChart,
    source: "fallback",
  };
};

export const generateDatasetAnswer = async ({ dataset, question }) => {
  if (!env.geminiApiKey) {
    console.log("No Gemini API key, using fallback response.");
    return generateFallback({ dataset, question });
  }

  try {
    const response = await fetch(
      `${env.geminiApiUrl}/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildDatasetPrompt({ dataset, question }) }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Gemini API error ${response.status}:`, text.slice(0, 200));
      return generateFallback({ dataset, question });
    }

    const payload = await response.json();
    const result = parseGeminiResponse(payload);

    return {
      answer: result.answer || "No answer available.",
      sql: result.sql || "",
      insights: result.insights || [],
      chart: result.chart || null,
      source: "gemini",
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return generateFallback({ dataset, question });
  }
};
