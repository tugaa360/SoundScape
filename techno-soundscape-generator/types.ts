
export interface MarkerPosition {
  x: number;
  y: number;
}

export interface Emotion {
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // -1 (low energy) to 1 (high energy)
}

export interface SoundParams {
  masterVolume: number;
  pan: number; // -1 (left) to 1 (right)
  tempo: number; // BPM
  reverb: number; // 0 to 1
  delayFeedback: number; // 0 to 0.9
  delayTime: number; // seconds
  kickGain: number; // multiplier
  bassFilterCutoff: number; // Hz
}

export type SoundParamKey = keyof SoundParams;

export interface JogDialProps {
  id: SoundParamKey;
  label: string;
  min: number;
  max: number;
  value: number;
  formatFn: (value: number) => string;
  onChange: (value: number) => void;
  primaryColor?: string;
}

export interface EmotionMapCanvasProps {
  marker: MarkerPosition | null;
  onPositionChange: (newMarker: MarkerPosition, newEmotion: Emotion) => void;
  primaryColor?: string;
}

export interface AudioEngineNodes {
  mainBus?: GainNode;
  delay?: DelayNode;
  delayFeedback?: GainNode;
  delayWet?: GainNode;
  reverbInput?: GainNode;
  reverbWetControl?: GainNode; // Controls the gain fed into reverb processing
  reverbOutput?: GainNode;    // The actual wet output of the reverb
  panner?: StereoPannerNode;
  masterGain?: GainNode;
  [key: string]: AudioNode | undefined | { input?: AudioNode, wetGain?: GainNode, output?: AudioNode };
}

export type NoteScheduler = (time: number, step: number) => void;

// For audio engine hook
export interface AudioEngineControl {
  isInitialized: boolean;
  isPlaying: boolean;
  initAudio: () => Promise<void>;
  togglePlay: () => void;
  updateSoundParams: (newParams: SoundParams) => void;
  updateEmotion: (newEmotion: Emotion) => void;
}