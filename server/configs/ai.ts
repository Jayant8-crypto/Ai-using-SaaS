import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    if (!_ai) {
      _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY });
    }
    return (_ai as any)[prop];
  }
});

export default ai;