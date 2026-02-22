export interface AudioFeatures {
  rms: number;
  bass_energy: number;
  mid_energy: number;
  high_energy: number;
  spectral_centroid: number;
  zero_crossing_rate: number;
  bpm_estimate?: number;
}

export interface AudioGateState {
  noise_floor_rms: number;
  energy_threshold_rms: number;
  gated_active: boolean;
  calibrated_at?: number;
}

