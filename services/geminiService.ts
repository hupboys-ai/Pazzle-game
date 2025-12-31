
import { GoogleGenAI, Type } from "@google/genai";
import { DrawingLevel } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const LEVEL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER }
        },
        required: ["id", "x", "y"]
      }
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.INTEGER },
          to: { type: Type.INTEGER }
        },
        required: ["from", "to"]
      }
    }
  },
  required: ["title", "nodes", "edges"]
};

export const generateDrawingLevel = async (levelNum: number): Promise<DrawingLevel> => {
  try {
    const complexity = Math.min(4 + Math.floor(levelNum / 2), 12);
    const prompt = `Generate a one-line drawing puzzle level for an IQ game.
    Level Number: ${levelNum}
    Number of Nodes: ${complexity}
    Rules:
    1. The graph MUST contain an Eulerian Path (connect all edges with one stroke).
    2. Coordinates must be between 50 and 350 for a 400x400 area.
    3. Ensure the shape looks aesthetically pleasing (star-like, geometric, or abstract).
    4. Return valid JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: LEVEL_SCHEMA,
      }
    });
    
    const parsed = JSON.parse(response.text || '{}');
    return { 
      ...parsed, 
      id: levelNum, 
      edges: (parsed.edges || []).map((e: any) => ({ ...e, used: false })) 
    } as DrawingLevel;
  } catch (e) {
    // Robust fallback shape
    return {
      id: levelNum,
      title: "Crystal Core",
      nodes: [
        { id: 0, x: 200, y: 50 },
        { id: 1, x: 50, y: 200 },
        { id: 2, x: 200, y: 350 },
        { id: 3, x: 350, y: 200 },
        { id: 4, x: 200, y: 200 }
      ],
      edges: [
        { from: 0, to: 1, used: false },
        { from: 1, to: 2, used: false },
        { from: 2, to: 3, used: false },
        { from: 3, to: 0, used: false },
        { from: 0, to: 4, used: false },
        { from: 4, to: 2, used: false }
      ]
    };
  }
};
