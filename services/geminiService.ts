
import { GoogleGenAI, Type } from "@google/genai";
import { DrawingLevel, Difficulty } from "../types";

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

export const getDifficultyConfig = (levelNum: number): { difficulty: Difficulty; nodeCount: number } => {
  if (levelNum <= 5) return { difficulty: 'EASY', nodeCount: 5 };
  if (levelNum <= 15) return { difficulty: 'MEDIUM', nodeCount: 7 };
  if (levelNum <= 30) return { difficulty: 'HARD', nodeCount: 10 };
  if (levelNum <= 60) return { difficulty: 'ULTRA HARD', nodeCount: 14 };
  return { difficulty: 'ULTRA PRO HARD', nodeCount: 18 };
};

export const generateProceduralFallback = (levelNum: number): DrawingLevel => {
  const { difficulty, nodeCount } = getDifficultyConfig(levelNum);
  const nodes = [];
  const center = 200;
  const spread = 120;

  // Create a symmetrical star/polygon pattern for instant loading
  for(let i = 0; i < nodeCount - 1; i++) {
    const angle = (i * 2 * Math.PI) / (nodeCount - 1);
    nodes.push({ 
      id: i, 
      x: center + Math.cos(angle) * spread, 
      y: center + Math.sin(angle) * spread 
    });
  }
  nodes.push({ id: nodeCount - 1, x: center, y: center });

  const edges = [];
  for(let i = 0; i < nodeCount - 1; i++) {
    edges.push({ from: i, to: (i + 1) % (nodeCount - 1), used: false });
    edges.push({ from: i, to: nodeCount - 1, used: false });
  }

  return { id: levelNum, title: `Logic Pattern ${levelNum}`, difficulty, nodes, edges };
};

export const generateDrawingLevel = async (levelNum: number): Promise<DrawingLevel> => {
  const { difficulty, nodeCount } = getDifficultyConfig(levelNum);
  const apiKey = process?.env?.API_KEY;
  
  if (!apiKey) return generateProceduralFallback(levelNum);

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Streamlined prompt to reduce token usage and speed up response
    const prompt = `Eulerian path JSON puzzle. Level: ${levelNum}, Difficulty: ${difficulty}, Nodes: ${nodeCount}. Grid: 400x400. One continuous line possible.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: LEVEL_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 } // Fast mode
      }
    });
    
    const parsed = JSON.parse(response.text || '{}');
    return { 
      ...parsed, 
      id: levelNum, 
      difficulty,
      edges: parsed.edges.map((e: any) => ({ ...e, used: false })) 
    } as DrawingLevel;
  } catch (e) {
    console.warn("AI Generation slow or failed, using procedural logic.");
    return generateProceduralFallback(levelNum);
  }
};
