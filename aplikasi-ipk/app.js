const STORAGE_KEY = "kalkulator-ipk-courses";
const SETTINGS_KEY = "kalkulator-ipk-ai-settings";

const gradeScale = [
  { min: 85, letter: "A", weight: 4.0 },
  { min: 80, letter: "A-", weight: 3.7 },
  { min: 75, letter: "B+", weight: 3.3 },
  { min: 70, letter: "B", weight: 3.0 },
  { min: 65, letter: "B-", weight: 2.7 },
  { min: 60, letter: "C+", weight: 2.3 },
  { min: 55, letter: "C", weight: 2.0 },
  { min: 45, letter: "D", weight: 1.0 },
  { min: 0, letter: "E", weight: 0.0 },
];

const sampleCourses = [
  { name: "Sistem Pendukung Keputusan", sks: 3, score: 88 },
  { name: "Basis Data", sks: 3, score: 81 },
  { name: "Pemrograman Web", sks: 4, score: 76 },
  { name: "Statistika", sks: 2, score: 69 },
  { name: "Etika Profesi", sks: 2, score: 91 },
];

let courses = loadCourses();

const rowsElement = document.querySelector("#courseRows");
const emptyState = document.querySelector("#emptyState");
const ipkValue = document.querySelector("#ipkValue");
const totalSks = document.querySelector("#totalSks");
const totalMutu = document.querySelector("#totalMutu");
const totalMatkul = document.querySelector("#totalMatkul");
const statusText = document.querySelector("#statusText");
const gradeRules = document.querySelector("#gradeRules");
const predictButton = document.querySelector("#predictButton");
const aiResult = document.querySelector("#aiResult");
const targetSksInput = document.querySelector("#targetSksInput");
const plannedWeightInput = document.querySelector("#plannedWeightInput");
const cumlaudeLimitInput = document.querySelector("#cumlaudeLimitInput");
const studentNoteInput = document.querySelector("#studentNoteInput");

document.querySelector("#addButton").addEventListener("click", addCourse);
document.querySelector("#sampleButton").addEventListener("click", useSampleData);
document.querySelector("#resetButton").addEventListener("click", resetData);
predictButton.addEventListener("click", predictCumlaude);
[targetSksInput, plannedWeightInput, cumlaudeLimitInput, studentNoteInput].forEach((input) => {
  input.addEventListener("change", saveAiSettings);
});

loadAiSettings();
renderGradeRules();
render();

function loadCourses() {
  const storedCourses = localStorage.getItem(STORAGE_KEY);

  if (!storedCourses) {
    return [{ name: "", sks: 3, score: 0 }];
  }

  try {
    const parsedCourses = JSON.parse(storedCourses);
    return Array.isArray(parsedCourses) ? parsedCourses : [];
  } catch {
    return [];
  }
}

function saveCourses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

function loadAiSettings() {
  const storedSettings = localStorage.getItem(SETTINGS_KEY);

  if (!storedSettings) {
    return;
  }

  try {
    const settings = JSON.parse(storedSettings);
    targetSksInput.value = settings.targetSks ?? targetSksInput.value;
    plannedWeightInput.value = settings.plannedWeight ?? plannedWeightInput.value;
    cumlaudeLimitInput.value = settings.cumlaudeLimit ?? cumlaudeLimitInput.value;
    studentNoteInput.value = settings.studentNote ?? "";
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
}

function saveAiSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      targetSks: targetSksInput.value,
      plannedWeight: plannedWeightInput.value,
      cumlaudeLimit: cumlaudeLimitInput.value,
      studentNote: studentNoteInput.value,
    }),
  );
}

function addCourse() {
  courses.push({ name: "", sks: 3, score: 0 });
  saveCourses();
  render();

  const lastInput = rowsElement.querySelector("tr:last-child input");
  if (lastInput) {
    lastInput.focus();
  }
}

function useSampleData() {
  courses = sampleCourses.map((course) => ({ ...course }));
  saveCourses();
  render();
}

function resetData() {
  courses = [];
  saveCourses();
  render();
}

function updateCourse(index, field, value) {
  if (!courses[index]) {
    return;
  }

  if (field === "name") {
    courses[index].name = value;
  } else if (field === "sks") {
    courses[index].sks = clampNumber(value, 0, 24);
  } else if (field === "score") {
    courses[index].score = clampNumber(value, 0, 100);
  }

  saveCourses();
  render();
}

function deleteCourse(index) {
  courses.splice(index, 1);
  saveCourses();
  render();
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
}

function getGrade(score) {
  const numericScore = clampNumber(score, 0, 100);
  return gradeScale.find((grade) => numericScore >= grade.min) || gradeScale.at(-1);
}

function getIpkStatus(ipk, sks) {
  if (sks === 0) {
    return "Belum ada data";
  }

  if (ipk >= 3.5) {
    return "Sangat baik";
  }

  if (ipk >= 3) {
    return "Baik";
  }

  if (ipk >= 2.5) {
    return "Cukup";
  }

  return "Perlu evaluasi";
}

function renderGradeRules() {
  gradeRules.innerHTML = gradeScale
    .map((grade, index) => {
      const nextGrade = gradeScale[index - 1];
      const range = nextGrade ? `${grade.min}-${nextGrade.min - 1}` : `${grade.min}-100`;

      return `
        <div class="rule">
          <strong>${grade.letter}</strong>
          <span>${range}</span>
          <em>${grade.weight.toFixed(1)}</em>
        </div>
      `;
    })
    .join("");
}

function render() {
  emptyState.classList.toggle("visible", courses.length === 0);
  rowsElement.innerHTML = courses.map(renderRow).join("");
  bindRowEvents();
  renderSummary();
}

function renderRow(course, index) {
  const grade = getGrade(course.score);
  const sks = clampNumber(course.sks, 0, 24);
  const score = clampNumber(course.score, 0, 100);
  const mutu = sks * grade.weight;

  return `
    <tr>
      <td>
        <input
          type="text"
          aria-label="Nama mata kuliah"
          data-index="${index}"
          data-field="name"
          value="${escapeHtml(course.name)}"
          placeholder="Contoh: Algoritma"
        />
      </td>
      <td>
        <input
          class="number-input"
          type="number"
          min="0"
          max="24"
          step="1"
          aria-label="Jumlah SKS"
          data-index="${index}"
          data-field="sks"
          value="${sks}"
        />
      </td>
      <td>
        <input
          class="number-input"
          type="number"
          min="0"
          max="100"
          step="0.1"
          aria-label="Nilai angka"
          data-index="${index}"
          data-field="score"
          value="${score}"
        />
      </td>
      <td><span class="pill">${grade.letter}</span></td>
      <td class="muted-cell">${grade.weight.toFixed(1)}</td>
      <td class="muted-cell">${mutu.toFixed(2)}</td>
      <td>
        <button
          class="delete-button"
          type="button"
          aria-label="Hapus mata kuliah"
          data-delete="${index}"
        >
          &times;
        </button>
      </td>
    </tr>
  `;
}

function bindRowEvents() {
  rowsElement.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      const { index, field } = event.target.dataset;
      updateCourse(Number(index), field, event.target.value);
    });
  });

  rowsElement.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", (event) => {
      deleteCourse(Number(event.currentTarget.dataset.delete));
    });
  });
}

function renderSummary() {
  const summary = calculateSummary();

  const ipk = summary.sks > 0 ? summary.mutu / summary.sks : 0;

  ipkValue.textContent = ipk.toFixed(2);
  totalSks.textContent = summary.sks;
  totalMutu.textContent = summary.mutu.toFixed(2);
  totalMatkul.textContent = courses.length;
  statusText.textContent = getIpkStatus(ipk, summary.sks);
}

function calculateSummary() {
  return courses.reduce(
    (result, course) => {
      const grade = getGrade(course.score);
      const sks = clampNumber(course.sks, 0, 24);

      result.sks += sks;
      result.mutu += sks * grade.weight;

      return result;
    },
    { sks: 0, mutu: 0 },
  );
}

async function predictCumlaude() {
  saveAiSettings();

  const summary = calculateSummary();
  const ipk = summary.sks > 0 ? summary.mutu / summary.sks : 0;

  aiResult.classList.remove("error");
  aiResult.classList.add("loading");
  aiResult.textContent = "AI sedang menganalisis peluang cumlaude...";
  predictButton.disabled = true;

  try {
    const response = await fetch("/api/predict-cumlaude", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courses: courses.map((course) => {
          const grade = getGrade(course.score);
          const sks = clampNumber(course.sks, 0, 24);

          return {
            name: course.name || "Mata kuliah tanpa nama",
            sks,
            score: clampNumber(course.score, 0, 100),
            letter: grade.letter,
            weight: grade.weight,
            qualityPoint: sks * grade.weight,
          };
        }),
        summary: {
          totalSks: summary.sks,
          totalQualityPoint: Number(summary.mutu.toFixed(2)),
          currentGpa: Number(ipk.toFixed(2)),
        },
        settings: {
          targetGraduationSks: clampNumber(targetSksInput.value, 1, 200),
          plannedRemainingWeight: clampNumber(plannedWeightInput.value, 0, 4),
          cumlaudeLimit: clampNumber(cumlaudeLimitInput.value, 0, 4),
          studentNote: studentNoteInput.value.trim(),
        },
      }),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "Analisis AI gagal diproses.");
    }

    aiResult.textContent = data.analysis;
  } catch (error) {
    aiResult.classList.add("error");
    aiResult.textContent = error.message;
  } finally {
    aiResult.classList.remove("loading");
    predictButton.disabled = false;
  }
}

async function parseJsonResponse(response) {
  const responseText = await response.text();

  if (!responseText) {
    return {
      message:
        "Server tidak mengembalikan data. Pastikan aplikasi dibuka lewat http://localhost:8080 dan server Node masih berjalan.",
    };
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      message:
        "Server mengembalikan respons yang bukan JSON. Pastikan menjalankan `npm start`, bukan membuka file HTML langsung.",
    };
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
