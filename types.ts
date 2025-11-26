export enum AnalysisType {
  GENERAL = '整體運勢',
  PERSONALITY = '個性分析',
  CAREER = '事業工作',
  WEALTH = '財運分析',
  LOVE = '感情婚姻',
  HEALTH = '健康疾厄',
  YEARLY = '流年運勢',
  COMPATIBILITY = '合盤分析 (男女)',
}

export type ModelTier = 'pro' | 'flash';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  image?: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChartData {
  rawText: string;
  isValid: boolean;
  gender?: string;
  birthTime?: string;
}

export interface AppState {
  mode: 'input' | 'analysis';
  isCoupleMode: boolean;
  primaryChart: ChartData;
  secondaryChart: ChartData; // For couple mode
  chatHistory: ChatMessage[];
  isLoading: boolean;
  modelTier: ModelTier;
}