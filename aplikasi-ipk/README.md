# Kalkulator Nilai, IPK, dan Prediksi Cumlaude AI

Aplikasi web untuk membantu dosen atau bagian akademik menghitung nilai
mahasiswa secara cepat. Versi ini juga mendukung AI generatif untuk memprediksi
peluang cumlaude menggunakan Ollama lokal.

## Fitur

- Input mata kuliah, SKS, dan nilai angka.
- Konversi nilai angka ke nilai huruf.
- Perhitungan bobot nilai dan mutu berdasarkan SKS.
- Rekap total SKS, total mutu, jumlah mata kuliah, dan IPK.
- Simpan otomatis di browser menggunakan `localStorage`.
- Tombol contoh data dan reset.
- Prediksi cumlaude dengan Ollama melalui backend lokal.

## Cara Menjalankan

1. Pilih mode Ollama.

Mode lokal tanpa key:

Download dari `https://ollama.com`, lalu pull model yang ingin dipakai:

```powershell
ollama pull qwen3.5:9b
```

Gunakan `.env.local`:

```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:9b
PORT=8080
```

Mode Ollama Cloud/API dengan key:

```env
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=minimax-m3:cloud
OLLAMA_THINK=medium
OLLAMA_API_KEY=paste-ollama-key-anda
PORT=8080
```

2. Install dependency aplikasi:

```powershell
npm install
```

3. Jalankan server:

```powershell
npm start
```

Lalu buka `http://localhost:8080`.

Catatan: `.env.local` sudah diabaikan oleh Git melalui `.gitignore`.

## Troubleshooting AI

- `Gagal menghubungi Ollama`: pastikan aplikasi Ollama sedang berjalan.
- `401` atau `403`: jika memakai `https://ollama.com`, pastikan
  `OLLAMA_API_KEY` benar dan akun Ollama Anda punya akses model tersebut.
- `Model Ollama tidak ditemukan`: jalankan `ollama pull qwen3.5:9b`, atau ganti
  `OLLAMA_MODEL` sesuai model yang sudah terpasang.
- Cek model lokal dengan `ollama list`.
- Setelah mengubah `.env.local`, restart server dengan `npm start`.
