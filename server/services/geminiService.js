import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Server configuration error: GEMINI_API_KEY is missing in .env");
  return key;
};

// We use the new Gemini Vision capabilities
export const runGeminiOCR = async (body) => {
  const genAI = new GoogleGenerativeAI(getApiKey());
  
  // Use a capable model for document understanding
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  let mimeType = 'image/jpeg';
  let base64Data = '';

  if (body.type === 'document_url' && body.document_url) {
    const parts = body.document_url.split(',');
    mimeType = parts[0].split(':')[1].split(';')[0];
    base64Data = parts[1];
  } else if (body.type === 'image_url' && body.image_url) {
    const parts = body.image_url.split(',');
    mimeType = parts[0].split(':')[1].split(';')[0];
    base64Data = parts[1];
  } else {
    throw new Error('Invalid input format');
  }

  const prompt = `You are a Markdown formatting expert. I am giving you a handwritten document.

Your job is to REFORMAT it and transcribe it perfectly:

## 1. MATHEMATICS (MOST IMPORTANT)
- Every mathematical expression MUST be wrapped in LaTeX delimiters:
  - Inline math: $expression$ — e.g. $x^2 + y^2 = r^2$, $\\frac{a}{b}$
  - Block/display math: $$ expression $$ — for equations on their own line
- DO NOT wrap Markdown headers (##, ###) or plain text paragraphs inside $$...$$.

## 2. HEADINGS & BOLD TEXT
- Detect main titles, chapters, and subsections and format them with #, ##, ###.
- Bold key terms, definitions, and labels (e.g., **Theorem:**, **Note:**).

## 3. DIAGRAMS & TREES
- If you see a flowchart, logic tree, decision tree, or other diagrams, convert them into Mermaid.js code blocks (\`\`\`mermaid ... \`\`\`). Do not just output scrambled math equations for diagrams.

## 4. TABLES & LAYOUT
- Extract tables correctly.
- Ensure the layout is chronological and logical, matching the visual structure.

## OUTPUT:
- Return ONLY the reformatted Markdown.
- No preamble, no explanation.`;

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType
      }
    },
    prompt
  ]);

  const response = await result.response;
  const text = response.text();

  // Mock Mistral response format so the frontend doesn't break
  return {
    pages: [
      { markdown: text }
    ]
  };
};
