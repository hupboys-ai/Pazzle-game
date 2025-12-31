
export interface Node {
  id: number;
  x: number;
  y: number;
}

export interface Edge {
  from: number;
  to: number;
  used: boolean;
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'ULTRA HARD' | 'ULTRA PRO HARD';

export interface DrawingLevel {
  id: number;
  title: string;
  difficulty: Difficulty;
  nodes: Node[];
  edges: Edge[];
}

export type GameState = 'MENU' | 'PLAYING' | 'WIN' | 'LOADING';
