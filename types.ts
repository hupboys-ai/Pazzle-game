
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

export interface DrawingLevel {
  id: number;
  title: string;
  nodes: Node[];
  edges: Edge[];
}

export type GameState = 'MENU' | 'PLAYING' | 'WIN' | 'LOADING' | 'AD_PAUSE';
