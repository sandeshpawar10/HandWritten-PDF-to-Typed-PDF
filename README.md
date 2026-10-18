# TypedDoc: Handwritten Notes to Digital Markdown & Formatted Documents

TypedDoc is an AI-powered web application that transcribes handwritten notes, university problem sets, lecture boards, and scanned PDFs into clean, publication-ready GitHub-flavored Markdown, LaTeX mathematics, DOCX, and formatted PDFs.

Powered by **Google Gemini Multimodal AI** with a 6-key parallel rotation pool and two-pass verification, TypedDoc intelligently reconstructs complex derivations, multi-step algebraic formulas, algorithms, truth tables, and technical ASCII diagrams with zero silent omissions.

---

## ✨ Features

- **Gemini Vision OCR Pipeline**: High-accuracy multimodal transcription powered by `gemini-3.8-flash` with automatic fallback tiers (`gemini-3.5-flash`, `gemini-3.5-flash-lite`).
- **Parallel Multi-Key KeyPool**: Dynamically distributes multi-page PDF processing across up to 6 Gemini API keys with per-key RPM pacing and independent quota tracking.
- **Authoritative Document Generation**: Produces identical structured outputs for live Markdown preview, formatted Word documents (`.docx`), and styled academic PDFs (`.pdf`).
- **Structured OCR AST & Two-Pass Verification**: Validates LaTeX mathematics balance (`$$`), Markdown table column consistency, code indentation, and diagram bounds with confidence scoring.
- **Content-Addressed Safe Caching**: SHA-256 caching with atomic temp-file renaming ensures instant resumption and zero duplicated API spend if interrupted.
- **Browser Fallback Mode**: Automatically falls back to in-browser client-side OCR (`Tesseract.js` + `PDF.js`) if network or server connection is interrupted.
- **Interactive Document Editor**: Split-view and full-preview modes, debounced autosave, snapshot version control, live stats, and keyboard shortcuts (`Ctrl+S`).
- **Cloud Storage**: Secure Firebase Authentication and Firestore document synchronization.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 with Vite 6
- **Styling**: Tailwind CSS & Motion animations
- **Math Rendering**: KaTeX
- **Persistence**: Firebase SDK (Auth & Firestore)
- **Icons**: Lucide React

### Backend
- **Server**: Node.js & Express 5
- **Multimodal AI**: Google Gemini API (`@google/genai`)
- **PDF Generation**: `pdf-lib` (pure JS, low-memory footprint <30MB)
- **DOCX Generation**: `docx` library
- **Security & Reliability**: Helmet, Compression, and user-aware rate limiting

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20.0.0
- npm ≥ 9.0.0
- One or more Google Gemini API keys ([Get your free API keys from Google AI Studio](https://aistudio.google.com/))
- Firebase project credentials

### 1. Installation
```bash
git clone https://github.com/sandeshpawar10/HandWritten-PDF-to-Typed-PDF.git
cd typed-document-v2
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your Gemini API key(s) in `.env`:
```env
# Single key or comma-separated list:
GEMINI_API_KEY=your_gemini_key_1,your_gemini_key_2

# Or named individual keys (supports up to 6 or more):
GEMINI_KEY_01=your_key_1
GEMINI_KEY_02=your_key_2

# Active model tiers:
GEMINI_MODEL_PRIMARY=gemini-3.8-flash
GEMINI_MODEL_FAST=gemini-3.5-flash
GEMINI_MODEL_VERIFY=gemini-3.8-flash
GEMINI_MODEL_FALLBACK=gemini-3.5-flash-lite

# Concurrency (matches active keys):
OCR_CONCURRENCY=6

PORT=3001
NODE_ENV=development
```

### 3. Run Development Server
Run frontend and backend concurrently:
```bash
npm run dev:all
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

Run test suite in watch mode:
```bash
npm run test:watch
```

Run linter:
```bash
npm run lint
```

Build production bundle:
```bash
npm run build
```

---

## 📄 License
MIT License.
