import { GoogleGenAI } from "@google/genai";

const apiKey = "AIzaSyCI_7VFzKKJdebu5TiK3rf_iTwT5Z4FGBE";

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
