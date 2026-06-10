import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const port = Number(process.env.PORT || 8080);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const model = process.env.OLLAMA_MODEL || "llama3.2";
const apiModel = getApiModelName(model, ollamaBaseUrl);
const think = process.env.OLLAMA_THINK || "";
const ollamaApiKey = process.env.OLLAMA_API_KEY || "";
const hasOllamaApiKey =
  Boolean(ollamaApiKey) && !ollamaApiKey.toLowerCase().includes("paste");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/health", async (_request, response) => {
  const ollama = await getOllamaStatus();
  const modelAvailable = ollama.models.includes(model) || ollama.models.includes(apiModel);

  response.json({
    ok: true,
    aiProvider: "ollama",
    aiConfigured: ollama.available && modelAvailable,
    ollamaBaseUrl,
    model,
    apiModel,
    think: think || null,
    modelAvailable,
    ollama,
  });
});

app.post("/api/predict-cumlaude", async (request, response) => {
  const payload = normalizePayload(request.body);
  const projection = calculateProjection(payload);

  try {
    const chatPayload = {
      model: apiModel,
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "Anda adalah penasihat akademik kampus. Beri analisis singkat, objektif, dan mudah dipahami dalam bahasa Indonesia. Jelaskan bahwa keputusan cumlaude resmi tetap mengikuti aturan kampus.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Prediksi peluang mahasiswa mendapatkan gelar cumlaude.",
              rules: {
                cumlaudeMinimumGpa: payload.settings.cumlaudeLimit,
                note: "Syarat lain seperti masa studi, nilai minimal, pelanggaran akademik, dan aturan fakultas dapat berbeda antar kampus.",
              },
              studentData: payload,
              deterministicProjection: projection,
              expectedOutput:
                "Berikan hasil dalam 4 bagian: Prediksi, Alasan, Target Nilai, dan Saran. Maksimal 220 kata.",
            },
            null,
            2,
          ),
        },
      ],
    };

    if (think) {
      chatPayload.think = think;
    }

    const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: getOllamaHeaders(),
      body: JSON.stringify(chatPayload),
    });

    const result = await parseOllamaJson(ollamaResponse);

    if (!ollamaResponse.ok) {
      response.status(ollamaResponse.status).json({
        message: formatOllamaError(ollamaResponse.status, result),
        status: ollamaResponse.status,
      });
      return;
    }

    response.json({
      analysis: result.message?.content || "Ollama tidak mengembalikan teks analisis.",
      projection,
      model,
      apiModel,
      provider: "ollama",
    });
  } catch (error) {
    response.status(500).json({
      message:
        "Gagal menghubungi Ollama. Pastikan Ollama sudah berjalan di komputer Anda dan model sudah di-pull.",
      detail: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Aplikasi IPK AI Ollama berjalan di http://localhost:${port}`);
  console.log(`Ollama target: ${ollamaBaseUrl} dengan model ${model}`);
  if (apiModel !== model) {
    console.log(`Ollama API model: ${apiModel}`);
  }
  if (think) {
    console.log(`Ollama think/effort: ${think}`);
  }
});

async function getOllamaStatus() {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      headers: getOllamaHeaders(false),
    });
    const data = await parseOllamaJson(response);

    return {
      available: response.ok,
      status: response.status,
      models: Array.isArray(data.models) ? data.models.map((item) => item.name) : [],
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      models: [],
    };
  }
}

function getApiModelName(configuredModel, baseUrl) {
  if (baseUrl.includes("ollama.com") && configuredModel.endsWith(":cloud")) {
    return configuredModel.replace(/:cloud$/, "");
  }

  return configuredModel;
}

function getOllamaHeaders(includeContentType = true) {
  const headers = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (hasOllamaApiKey) {
    headers.Authorization = `Bearer ${ollamaApiKey}`;
  }

  return headers;
}

async function parseOllamaJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text,
    };
  }
}

function formatOllamaError(status, result) {
  const detail = result.error ? ` Detail: ${result.error}` : "";

  if (status === 404) {
    return `Model Ollama tidak ditemukan. Jalankan: ollama pull ${model}.${detail}`;
  }

  return `Ollama mengembalikan error status ${status}.${detail}`;
}

function normalizePayload(body) {
  const courses = Array.isArray(body?.courses) ? body.courses : [];
  const settings = body?.settings || {};
  const summary = body?.summary || {};

  return {
    courses: courses.map((course) => ({
      name: String(course.name || "Mata kuliah tanpa nama"),
      sks: clamp(Number(course.sks), 0, 24),
      score: clamp(Number(course.score), 0, 100),
      letter: String(course.letter || "-"),
      weight: clamp(Number(course.weight), 0, 4),
      qualityPoint: clamp(Number(course.qualityPoint), 0, 96),
    })),
    summary: {
      totalSks: clamp(Number(summary.totalSks), 0, 250),
      totalQualityPoint: clamp(Number(summary.totalQualityPoint), 0, 1000),
      currentGpa: clamp(Number(summary.currentGpa), 0, 4),
    },
    settings: {
      targetGraduationSks: clamp(Number(settings.targetGraduationSks), 1, 250),
      plannedRemainingWeight: clamp(Number(settings.plannedRemainingWeight), 0, 4),
      cumlaudeLimit: clamp(Number(settings.cumlaudeLimit), 0, 4),
      studentNote: String(settings.studentNote || "").slice(0, 300),
    },
  };
}

function calculateProjection(payload) {
  const totalSks = payload.summary.totalSks;
  const totalQualityPoint = payload.summary.totalQualityPoint;
  const targetGraduationSks = payload.settings.targetGraduationSks;
  const remainingSks = Math.max(targetGraduationSks - totalSks, 0);
  const projectedQualityPoint =
    totalQualityPoint + remainingSks * payload.settings.plannedRemainingWeight;
  const projectedGpa =
    targetGraduationSks > 0 ? projectedQualityPoint / targetGraduationSks : 0;
  const neededQualityPoint =
    payload.settings.cumlaudeLimit * targetGraduationSks - totalQualityPoint;
  const neededAverageWeight =
    remainingSks > 0 ? neededQualityPoint / remainingSks : payload.summary.currentGpa;

  return {
    remainingSks,
    projectedGpa: Number(clamp(projectedGpa, 0, 4).toFixed(2)),
    neededAverageWeight: Number(clamp(neededAverageWeight, 0, 4).toFixed(2)),
    canStillReachByGpa:
      remainingSks === 0
        ? payload.summary.currentGpa >= payload.settings.cumlaudeLimit
        : neededAverageWeight <= 4,
  };
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
