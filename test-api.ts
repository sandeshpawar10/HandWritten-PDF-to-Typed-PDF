import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';

dotenv.config();
const apiKey = process.env.GEMINI_API_KEY;

async function main() {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Hello",
    });
    console.log("Success:", res.text);
  } catch (err: any) {
    console.error("Error status:", err.status);
    console.error("Error message:", err.message);
  }
}

main();
