// src/types.ts

export interface EccentricityRange {
  min: number;
  max: number;
  label: string;
}

export interface PlotData {
  x: number[];
  y: number[];
  cone_type: string[];
}

export interface Patient {
  subject_id: string;
  age: number;
}
