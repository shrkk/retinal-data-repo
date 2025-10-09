export interface Patient {
  subject_id: string;
  age: number;
}

export interface PlotData {
  x: number[];
  y: number[];
  cone_type: string[];
}

export interface EccentricityRange {
  min: number;
  max: number;
  label: string;
}

export interface Filters {
  subjectId?: string;
  meridian?: string;
  coneTypes?: string[];
  eccentricityRanges?: EccentricityRange[];
}

export interface Metadata {
  fov?: string;
  lm_ratio?: number;
  scones?: number;
  lcone_density?: number;
  mcone_density?: number;
  scone_density?: number;
  numcones?: number;
}
