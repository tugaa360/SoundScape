
import { SoundParams, SoundParamKey } from './types';

export const PRIMARY_COLOR = '#ff00ff'; // Techno Magenta

export interface JogDialConfigItem {
  id: SoundParamKey;
  label: string;
  min: number;
  max: number;
  initialValue: number;
  formatFn: (value: number) => string;
}

export const JOG_DIAL_CONFIGS: JogDialConfigItem[] = [
  { 
    id: 'masterVolume', 
    label: '全体音量', 
    min: 0, max: 1, 
    initialValue: 0.7, 
    formatFn: v => `${(v * 100).toFixed(0)}%` 
  },
  { 
    id: 'pan', 
    label: 'パン', 
    min: -1, max: 1, 
    initialValue: 0, 
    formatFn: v => v === 0 ? '中央' : `${v > 0 ? '右' : '左'} ${(Math.abs(v) * 100).toFixed(0)}%` 
  },
  { 
    id: 'tempo', 
    label: 'テンポ', 
    min: 80, max: 160, 
    initialValue: 120, 
    formatFn: v => `${v.toFixed(0)} BPM` 
  },
  { 
    id: 'reverb', 
    label: '空間', 
    min: 0, max: 1, 
    initialValue: 0.5, 
    formatFn: v => `${(v * 100).toFixed(0)}%` 
  },
  { 
    id: 'delayFeedback', 
    label: '反響', 
    min: 0, max: 0.9, 
    initialValue: 0.4, 
    formatFn: v => `${(v * 100).toFixed(0)}%` 
  },
  { 
    id: 'delayTime', 
    label: 'ディレイタイム', 
    min: 0.1, max: 2.0, 
    initialValue: 0.5, 
    formatFn: v => `${v.toFixed(2)}秒` 
  },
  { 
    id: 'kickGain', 
    label: 'キック音量', 
    min: 0, max: 2, 
    initialValue: 1.0, 
    formatFn: v => `x${v.toFixed(1)}` 
  },
  { 
    id: 'bassFilterCutoff', 
    label: 'ベースFC', 
    min: 50, max: 1000, 
    initialValue: 500, 
    formatFn: v => `${v.toFixed(0)}Hz` 
  },
];

export const INITIAL_SOUND_PARAMS: SoundParams = JOG_DIAL_CONFIGS.reduce((acc, config) => {
  acc[config.id] = config.initialValue;
  return acc;
}, {} as SoundParams);

export const INITIAL_EMOTION = { valence: 0, arousal: 0 };