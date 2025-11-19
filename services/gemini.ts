import { GoogleGenAI, Type } from "@google/genai";
import { FaceMetrics } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeFaceImage = async (base64Image: string): Promise<FaceMetrics> => {
  // Strip the data URL prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          {
            text: `Analyze the facial structure in this image to generate parameters for a 3D procedural mesh.
            
            Return a JSON object with these approximate normalized scalar values suitable for morphing a base mesh:
            - jawWidth: (0.8 narrow, 1.0 avg, 1.2 wide)
            - faceHeight: (0.9 short, 1.0 avg, 1.3 long)
            - cheekboneProminence: (0.1 flat, 0.5 prominent)
            - chinTaper: (0.5 pointy, 1.0 square)
            - description: A very short 1-sentence technical description of the facial topology.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            jawWidth: { type: Type.NUMBER },
            faceHeight: { type: Type.NUMBER },
            cheekboneProminence: { type: Type.NUMBER },
            chinTaper: { type: Type.NUMBER },
            description: { type: Type.STRING },
          },
          required: ["jawWidth", "faceHeight", "cheekboneProminence", "chinTaper", "description"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as FaceMetrics;
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Fallback default data if AI fails (prevents app crash)
    return {
      jawWidth: 1.0,
      faceHeight: 1.1,
      cheekboneProminence: 0.2,
      chinTaper: 0.8,
      description: "Analysis failed, using default topology.",
    };
  }
};