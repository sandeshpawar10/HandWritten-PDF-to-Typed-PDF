# TypedDoc: Handwritten Notes to Digital Markdown

TypedDoc is an advanced, AI-powered web application designed to digitize handwritten Computer Science notes, assignments, and scanned PDFs into clean, beautifully formatted Markdown and LaTeX. 

Unlike traditional OCR scanners that scramble math equations and code blocks, TypedDoc uses a dual-AI pipeline powered by **Mistral AI** to intelligently reconstruct complex algorithms, formulas, and layouts.

---

## ✨ Features

- **AI-Powered OCR**: Uses Mistral OCR to accurately extract handwritten text, diagrams, and math from PDFs and images.
- **Intelligent Formatting Engine**: Uses Mistral Large to post-process raw OCR data. It acts as an elite Computer Science proofreader that:
  - Autocorrects OCR typos (e.g. `scarf` -> `scanf`, `Trautable` -> `Tractable`).
  - Fixes broken C/C++ code syntax and restores proper indentation.
  - Mathematically reconstructs scrambled equations (like Time Complexity bounds or Stirling's approximation) using context.
- **Live LaTeX & Markdown Rendering**: Real-time, side-by-side rendering with full support for KaTeX math (`$inline$` and `$$display$$`).
- **Cloud Storage**: Secure Google Authentication and database sync powered by Firebase.
- **Professional Exports**: Download your digitized notes as styled PDFs or DOCX files for easy sharing.
- **Dynamic UI**: A premium, responsive "glassmorphism" interface built with Tailwind CSS.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** (via Vite)
- **Tailwind CSS** (for modern, responsive styling)
- **KaTeX** (for high-performance LaTeX math rendering)
- **Firebase SDK** (Auth & Firestore)
- **html2pdf.js / docx** (for document export)

### Backend
- **Node.js & Express**
- **Mistral AI SDK** (Vision OCR & Mistral-Large APIs)
- **CORS & dotenv** (for security and environment management)

---

## 🚀 How It Works

1. **Upload**: Drag and drop a handwritten PDF or image.
2. **Vision OCR**: The Node.js backend sends the document to Mistral OCR to extract the raw text and images.
3. **Smart Post-Processing**: The extracted text is chunked and sent to `mistral-large-latest` with a highly-tuned prompt that reconstructs math, fixes code, and removes empty spaces.
4. **Review & Edit**: The user can preview the beautifully rendered Markdown/LaTeX and make any final tweaks in the live editor.
5. **Export**: Export the final document as a Typed PDF or DOCX.

---

## 💻 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/sandeshpawar10/HandWritten-PDF-to-Typed-PDF.git
cd HandWritten-PDF-to-Typed-PDF
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your keys:
```env
MISTRAL_API_KEY=your_mistral_api_key_here
```

### 4. Run Locally
To run both the Vite frontend and the Express backend concurrently:
```bash
npm run dev:all
```
The app will be available at `http://localhost:3000`.

---

## ☁️ Deployment

- **Backend**: Hosted on Render as a Node.js Web Service.
- **Frontend**: The Vite build is statically served by the Express backend on Render.

---

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Sandesh Pawar**  
GitHub: [sandeshpawar10](https://github.com/sandeshpawar10)
