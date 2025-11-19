export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceMetrics {
  jawWidth: number;
  faceHeight: number;
  cheekboneProminence: number;
  chinTaper: number;
  description: string;
}

export interface FaceAnalysisData {
  landmarks: Landmark[];
  description: string;
}

export enum AppState {
  LANDING = 'LANDING',
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING = 'GENERATING', // The visual build-up phase
  COMPLETE = 'COMPLETE',
}