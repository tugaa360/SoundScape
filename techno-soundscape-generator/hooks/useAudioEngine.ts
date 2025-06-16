
import { useState, useRef, useCallback, useEffect } from 'react';
import { SoundParams, Emotion, AudioEngineNodes, AudioEngineControl } from '../types';
import { INITIAL_SOUND_PARAMS, INITIAL_EMOTION } from '../constants';

const makeDistortionCurve = (amount: number, audioContext: AudioContext): Float32Array => {
  const k = amount;
  const n_samples = audioContext.sampleRate > 48000 ? 48000 : audioContext.sampleRate; // Cap sample rate for curve
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; i++) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
};

const createAlgorithmicReverb = (audioContext: AudioContext): { input: GainNode; output: GainNode; wetnessControl: GainNode } => {
  const ac = audioContext;
  const input = ac.createGain();
  const wetnessControl = ac.createGain(); 
  const reverbBus = ac.createGain();       
  const output = ac.createGain();          

  input.connect(wetnessControl);
  wetnessControl.connect(reverbBus); 

  const combDelayTimes = [0.0297, 0.0371, 0.0411, 0.0437]; 
  const combFeedbacks = [0.75, 0.70, 0.68, 0.65]; 
  
  combDelayTimes.forEach((delayTime, index) => {
    const combDelay = ac.createDelay(0.1); 
    combDelay.delayTime.value = delayTime;
    const combFeedback = ac.createGain();
    combFeedback.gain.value = combFeedbacks[index];
    const combFilter = ac.createBiquadFilter(); 
    combFilter.type = 'lowpass';
    combFilter.frequency.value = 3500; 

    wetnessControl.connect(combDelay); 
    combDelay.connect(combFilter);
    combFilter.connect(combFeedback);
    combFeedback.connect(combDelay); 
    combDelay.connect(reverbBus);    
  });

  const allpassDelayTimes = [0.0051, 0.0077, 0.0100, 0.0126]; 
  const allpassFeedbacks = [0.7, 0.7, 0.7, 0.7]; 
  
  let lastNode: AudioNode = reverbBus; 
  allpassDelayTimes.forEach((delayTime, index) => {
    const allpassDelay = ac.createDelay(0.05); 
    allpassDelay.delayTime.value = delayTime;
    // Simplified allpass-like structure (series of delays and sums)
    // A true Schroeder allpass filter is more complex (feedforward and feedback paths with specific gains)
    // This creates diffusion through chained delays.
    const allpassGain = ac.createGain();
    allpassGain.gain.value = allpassFeedbacks[index]; // Can be used for feedback or simple gain staging

    lastNode.connect(allpassDelay);
    allpassDelay.connect(allpassGain);
    lastNode = allpassGain; // Chain them
  });
  
  lastNode.connect(output); 
  wetnessControl.gain.value = 0.5;

  return { input, output, wetnessControl };
};


export const useAudioEngine = (): AudioEngineControl => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const nodesRef = useRef<AudioEngineNodes>({});
  const soundParamsRef = useRef<SoundParams>(INITIAL_SOUND_PARAMS);
  const emotionRef = useRef<Emotion>(INITIAL_EMOTION);

  const sequencerTimerRef = useRef<number | null>(null);
  const noteTimeRef = useRef(0);
  const currentStepRef = useRef(0);

  const buildAudioGraph = useCallback((ac: AudioContext) => {
    const nodes: AudioEngineNodes = {};

    nodes.mainBus = ac.createGain();
    nodes.panner = ac.createStereoPanner();
    nodes.masterGain = ac.createGain();
    nodes.masterGain.gain.value = 0; 

    nodes.delay = ac.createDelay(4.0);
    nodes.delayFeedback = ac.createGain();
    nodes.delayFeedback.gain.value = soundParamsRef.current.delayFeedback;
    nodes.delayWet = ac.createGain();
    nodes.delayWet.gain.value = 1.0; 

    nodes.delay.connect(nodes.delayFeedback);
    nodes.delayFeedback.connect(nodes.delay);
    nodes.mainBus.connect(nodes.delay); 
    nodes.delay.connect(nodes.delayWet); 

    const reverbUnit = createAlgorithmicReverb(ac);
    nodes.reverbInput = reverbUnit.input; 
    nodes.reverbWetControl = reverbUnit.wetnessControl; 
    nodes.reverbOutput = reverbUnit.output; 

    nodes.mainBus.connect(nodes.reverbInput);
    nodes.delayWet.connect(nodes.reverbInput);

    nodes.mainBus.connect(nodes.panner); 
    nodes.delayWet.connect(nodes.panner); 
    nodes.reverbOutput.connect(nodes.panner); 

    nodes.panner.connect(nodes.masterGain);
    nodes.masterGain.connect(ac.destination);
    
    nodesRef.current = nodes;
  }, []);

  const initAudio = useCallback(async () => {
    if (isInitialized) return;
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      await ac.resume(); 
      setAudioContext(ac);
      buildAudioGraph(ac);
      setIsInitialized(true);
      console.log("Techno Soundscape AudioEngine Initialized.");
    } catch (e) {
      console.error("Failed to initialize audio context:", e);
      setIsInitialized(false); 
    }
  }, [isInitialized, buildAudioGraph]);
  
  const updateAudioNodeParameters = useCallback(() => {
    if (!audioContext || !isInitialized || Object.keys(nodesRef.current).length === 0) return;
    
    const params = soundParamsRef.current;
    const nodes = nodesRef.current;
    const now = audioContext.currentTime;
    const rampTime = 0.05; 

    if (nodes.masterGain) nodes.masterGain.gain.setTargetAtTime(isPlaying ? params.masterVolume : 0, now, rampTime);
    if (nodes.panner) nodes.panner.pan.setTargetAtTime(params.pan, now, rampTime);
    if (nodes.delay && nodes.delay.delayTime) nodes.delay.delayTime.setTargetAtTime(params.delayTime, now, rampTime);
    if (nodes.delayFeedback) nodes.delayFeedback.gain.setTargetAtTime(params.delayFeedback, now, rampTime);
    if (nodes.reverbWetControl) nodes.reverbWetControl.gain.setTargetAtTime(params.reverb, now, rampTime);

  }, [audioContext, isInitialized, isPlaying]);


  useEffect(() => {
    updateAudioNodeParameters();
  }, [
    soundParamsRef.current.masterVolume, 
    soundParamsRef.current.pan, 
    soundParamsRef.current.delayTime, 
    soundParamsRef.current.delayFeedback, 
    soundParamsRef.current.reverb,
    updateAudioNodeParameters, 
    isPlaying 
  ]);

  const createOscillator = useCallback((type: OscillatorType): OscillatorNode => {
    if (!audioContext) throw new Error("AudioContext not initialized for oscillator");
    const osc = audioContext.createOscillator();
    osc.type = type;
    return osc;
  }, [audioContext]);

  const createOneShotNoiseSource = useCallback((): AudioBufferSourceNode => {
    if (!audioContext) throw new Error("AudioContext not initialized for noise source");
    const bufferSize = audioContext.sampleRate * 0.25; // Slightly longer for snare tail if needed
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    return source;
  }, [audioContext]);


  const triggerKick = useCallback((time: number) => {
    if (!audioContext || !nodesRef.current.mainBus) return;
    const ac = audioContext;
    const { mainBus } = nodesRef.current;
    const { arousal, valence } = emotionRef.current;
    const { kickGain } = soundParamsRef.current;

    const osc = createOscillator('sine');
    const env = ac.createGain();
    const waveShaper = ac.createWaveShaper();
    waveShaper.curve = makeDistortionCurve(20 + arousal * 35 + Math.random() * 8, ac); 

    const pitch = 60 - (1 - (valence + 1) / 2) * 20 + Math.random() * 1.5 - 0.75; 
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, pitch * 0.4), time + 0.12); 

    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime((1.8 + arousal * 0.7) * kickGain, time + 0.005); 
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.2 + arousal * 0.1); 

    osc.connect(waveShaper);
    waveShaper.connect(env);
    env.connect(mainBus);
    osc.start(time);
    osc.stop(time + 0.25 + arousal * 0.1); // Ensure full decay + buffer
  }, [audioContext, createOscillator]);

  const triggerHihat = useCallback((time: number, step: number) => {
    if (!audioContext || !nodesRef.current.mainBus) return;
    const ac = audioContext;
    const { mainBus } = nodesRef.current;
    const { arousal, valence } = emotionRef.current;

    const noise = createOneShotNoiseSource();
    const filter = ac.createBiquadFilter();
    const env = ac.createGain();

    filter.type = 'highpass';
    const openHatDecayFactor = 1.5 + arousal * 0.8;
    const baseClosedDecay = 0.03 + Math.abs(valence)*0.015;
    const baseOpenDecay = 0.1 + Math.abs(valence) * 0.1 + arousal * 0.1;
    
    // Determine if it's an open hi-hat: typically on the off-beat (e.g. 3rd 16th of a quarter note beat)
    // step % 4 === 2 implies (0,1,2,3) -> open on step 2. (e.g. 1e&[a])
    // Or, more generally, on upbeats if arousal is high.
    const isOpenHat = (step % 4 === 2) || (arousal > 0.6 && step % 2 !== 0 && Math.random() > 0.3);
    const decay = isOpenHat ? baseOpenDecay * openHatDecayFactor : baseClosedDecay;
    
    const cutoff = 7000 + arousal * 2000 - (1-valence)*1000 + Math.random() * 400;
    const gainLevel = isOpenHat ? (0.5 + arousal * 0.3) : (0.4 + arousal * 0.2);

    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.value = 8 + arousal * 4; 
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gainLevel, time + 0.005); 
    env.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(filter);
    filter.connect(env);
    env.connect(mainBus);
    noise.start(time);
    // No stop needed for buffer source if envelope handles decay before buffer ends
  }, [audioContext, createOneShotNoiseSource]);

  const triggerSnare = useCallback((time: number, step: number) => {
    if (!audioContext || !nodesRef.current.mainBus) return;
    // Trigger on 2nd and 4th beats (steps 4 and 12 in a 0-indexed 16-step sequence)
    if (step % 8 !== 4) return;

    const ac = audioContext;
    const { mainBus } = nodesRef.current;
    const { arousal, valence } = emotionRef.current;

    // Noise component
    const noise = createOneShotNoiseSource(); 
    const noiseEnv = ac.createGain();
    const noiseFilter = ac.createBiquadFilter();

    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1500 + arousal * 1000 + (Math.random() - 0.5) * 500, time);
    noiseFilter.Q.value = 3 + arousal * 3 + valence * 2; // More Q with positive valence

    noiseEnv.gain.setValueAtTime(0, time);
    noiseEnv.gain.linearRampToValueAtTime(0.8 + arousal * 0.2, time + 0.005); 
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.15 + valence * 0.1 + arousal * 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(mainBus);
    noise.start(time);

    // Body component (short sine burst)
    const bodyOsc = createOscillator('sine');
    const bodyEnv = ac.createGain();
    
    const baseSnarePitch = 180 + arousal * 50 + (valence * 20); // Pitch slightly up with positive valence
    bodyOsc.frequency.setValueAtTime(baseSnarePitch + (Math.random()-0.5)*10, time);
    bodyOsc.frequency.exponentialRampToValueAtTime(baseSnarePitch * 0.7, time + 0.08);

    bodyEnv.gain.setValueAtTime(0, time);
    bodyEnv.gain.linearRampToValueAtTime(0.6 + valence * 0.4, time + 0.01); 
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    bodyOsc.connect(bodyEnv);
    bodyEnv.connect(mainBus);
    bodyOsc.start(time);
    bodyOsc.stop(time + 0.12 + 0.05); // Ensure full decay + buffer
  }, [audioContext, createOneShotNoiseSource, createOscillator]);

  const triggerBass = useCallback((time: number, step: number) => {
    if (!audioContext || !nodesRef.current.mainBus) return;
    const ac = audioContext;
    const { mainBus } = nodesRef.current;
    const { arousal, valence } = emotionRef.current;
    const { bassFilterCutoff } = soundParamsRef.current;

    const aNorm = (arousal + 1) / 2;
    const vNorm = (valence + 1) / 2;
    const patternMajor = [0, 0, 7, 0, 5, 0, 3, 0, 0, 7, 0, 5, 0, 8, 0, 7]; 
    const patternMinor = [0, 0, 7, 0, 5, 0, 8, 0, 0, 5, 0, 7, 0, 3, 0, 5];
    const selectedPattern = vNorm > 0.5 ? patternMajor : patternMinor;
    const noteIndex = selectedPattern[step % 16]; 

    if (Math.random() > (0.75 + aNorm * 0.15 - 0.1 * Math.random()) && step % 2 !== 0) return; 

    const osc = createOscillator(aNorm > 0.6 ? 'square' : 'sawtooth'); 
    const filter = ac.createBiquadFilter();
    const env = ac.createGain();
    const freq = 440 * Math.pow(2, ( (vNorm > 0.5 ? 36 : 33) + noteIndex - 69) / 12); 
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(bassFilterCutoff + aNorm * 800 - (1-vNorm) * 200 + Math.random() * 150, time); 
    filter.Q.value = 4 + vNorm * 8 + aNorm * 4 + Math.random() * 1.5; 
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.4 + aNorm * 0.1, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.12 + Math.random() * 0.03 + aNorm * 0.05); 

    osc.connect(filter);
    filter.connect(env);
    env.connect(mainBus);
    osc.start(time);
    osc.stop(time + 0.15 + Math.random() * 0.03 + aNorm * 0.05); // Ensure full decay + buffer
  }, [audioContext, createOscillator]);

  const triggerSynth = useCallback((time: number, step: number) => {
    if (!audioContext || !nodesRef.current.mainBus) return;
    if (Math.random() > (0.1 + emotionRef.current.arousal * 0.2)) return; 
    if (step % 16 !== (Math.floor(Math.random()*4))*4 + Math.floor(Math.random()*3) ) return; 

    const ac = audioContext;
    const { mainBus } = nodesRef.current;
    const { arousal, valence } = emotionRef.current;

    const vNorm = (valence + 1) / 2;
    const aNorm = (arousal + 1) / 2;
    const scaleMajorPentatonic = [0, 2, 4, 7, 9];
    const scaleMinorPentatonic = [0, 3, 5, 7, 10];
    const scale = vNorm > 0.6 ? scaleMajorPentatonic : (vNorm < 0.4 ? scaleMinorPentatonic : (Math.random() > 0.5 ? scaleMajorPentatonic : scaleMinorPentatonic) );
    const note = scale[Math.floor(Math.random() * scale.length)];
    const octaveShift = aNorm > 0.5 ? 12 : (aNorm < -0.3 ? -12 : 0);
    const baseNote = vNorm > 0.5 ? 60 : 58; 
    const freq = 440 * Math.pow(2, (baseNote + note + octaveShift - 69) / 12) + (Math.random()-0.5) * (3 + aNorm * 5) ; 

    const osc = createOscillator(aNorm > 0.6 ? 'sawtooth' : (aNorm < -0.4 ? 'sine' : 'triangle'));
    const filter = ac.createBiquadFilter();
    const env = ac.createGain();
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime((Math.random()-0.5) * (100 + aNorm*200), time); 

    filter.type = aNorm > 0.3 ? 'lowpass' : 'bandpass'; 
    filter.frequency.setValueAtTime(600 + aNorm * 3000 + vNorm * 1000 + Math.random() * 200, time);
    filter.Q.value = 0.5 + aNorm * 10 + vNorm * 5 + Math.random() * 2;
    const release = 0.15 + (1 - aNorm) * 0.25 + Math.random() * 0.08 + Math.abs(valence) * 0.1;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.3 + aNorm*0.1, time + 0.005 + aNorm * 0.01); 
    env.gain.linearRampToValueAtTime(0.2 + vNorm * 0.2 + Math.random() * 0.05, time + 0.08 + aNorm*0.05);
    env.gain.linearRampToValueAtTime(0, time + 0.08 + aNorm*0.05 + release);

    osc.connect(filter);
    filter.connect(env);
    env.connect(mainBus);
    osc.start(time);
    osc.stop(time + 0.1 + aNorm*0.05 + release); // Ensure full decay + buffer
  }, [audioContext, createOscillator]);

  const triggerPad = useCallback((time: number, step: number) => {
    if (!audioContext || !nodesRef.current.mainBus) return;
    if (step % 16 !== 0 && step % 16 !== 8 && Math.random() > (0.15 + emotionRef.current.valence * 0.1) ) return; 
    
    const ac = audioContext;
    const { mainBus } = nodesRef.current;
    const { arousal, valence } = emotionRef.current;

    const vNorm = (valence + 1) / 2;
    const aNorm = (arousal + 1) / 2;
    const osc1 = createOscillator('sawtooth');
    const osc2 = createOscillator('triangle');
    const gain = ac.createGain();
    const filter = ac.createBiquadFilter();
    const baseNote = 48 - (1-vNorm)*5; 
    const chordType = vNorm > 0.6 ? [0, 4, 7, 11] : (vNorm < 0.4 ? [0, 3, 7, 9] : [0, 3, 7, 10]); 
    const chordVoicing = chordType.map(interval => baseNote + interval + (Math.floor(Math.random()*3)-1)*12 ); 
    
    const freq1 = 440 * Math.pow(2, (chordVoicing[Math.floor(Math.random()*chordVoicing.length)] - 69) / 12);
    const freq2 = freq1 * (1.003 + aNorm * 0.004 + (Math.random() - 0.5) * 0.0015);
    osc1.frequency.value = freq1;
    osc2.frequency.value = freq2;
    osc1.detune.value = (Math.random() - 0.5) * (10 + aNorm * 15); 
    osc2.detune.value = (Math.random() - 0.5) * (10 + aNorm * 15); 

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150 + aNorm * 1500 + vNorm * 500 + Math.random() * 80, time);
    filter.Q.value = 1.5 + aNorm * 3 + vNorm * 2 + Math.random() * 0.5;
    const attack = 0.8 + (1 - aNorm) * 0.8 + Math.random() * 0.3;
    const decay = 0.6 + vNorm * 0.4;
    const sustain = 0.3 + vNorm * 0.3 + aNorm * 0.1 + Math.random() * 0.05;
    const release = 1.5 + (1 - vNorm) * 1.5 + (1-aNorm) * 1.0 + Math.random() * 0.8;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.25 + aNorm * 0.05, time + attack);
    gain.gain.linearRampToValueAtTime((0.25 + aNorm * 0.05) * sustain, time + attack + decay);
    gain.gain.linearRampToValueAtTime(0.0001, time + attack + decay + release);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(filter);
    filter.connect(mainBus);
    osc1.start(time);
    osc2.start(time);
    const stopTime = time + attack + decay + release + 0.2; // Ensure full decay + buffer
    osc1.stop(stopTime);
    osc2.stop(stopTime);
  }, [audioContext, createOscillator]);

  // Sequencer Loop
  useEffect(() => {
    if (!isPlaying || !audioContext) {
      if (sequencerTimerRef.current) {
        clearInterval(sequencerTimerRef.current);
        sequencerTimerRef.current = null;
      }
      return;
    }

    noteTimeRef.current = audioContext.currentTime + 0.1; 
    currentStepRef.current = 0;

    const loop = () => {
      if (!audioContext) return; 
      const now = audioContext.currentTime;
      const tempo = soundParamsRef.current.tempo;
      const secondsPerSixteenth = 60.0 / tempo / 4;

      while (noteTimeRef.current < now + 0.15) { 
        if (currentStepRef.current % 4 === 0) triggerKick(noteTimeRef.current);
        
        triggerSnare(noteTimeRef.current, currentStepRef.current);
        
        // Hi-hat logic: Play on 8th notes. If arousal is high, add 16th notes.
        // The triggerHihat function itself determines if it's open/closed.
        if (currentStepRef.current % 2 === 0) { // All 8th notes (0, 2, 4, etc.)
            triggerHihat(noteTimeRef.current, currentStepRef.current);
        } else if (emotionRef.current.arousal > 0.5) { // Add 16ths (1, 3, 5, etc.) if high arousal
            triggerHihat(noteTimeRef.current, currentStepRef.current);
        }
        
        triggerBass(noteTimeRef.current, currentStepRef.current);
        triggerSynth(noteTimeRef.current, currentStepRef.current);
        triggerPad(noteTimeRef.current, currentStepRef.current);

        noteTimeRef.current += secondsPerSixteenth;
        currentStepRef.current = (currentStepRef.current + 1) % 16; 
      }
    };

    sequencerTimerRef.current = window.setInterval(loop, 40); // Check every 40ms (was 50) for tighter scheduling
    return () => {
      if (sequencerTimerRef.current) clearInterval(sequencerTimerRef.current);
    };
  }, [isPlaying, audioContext, triggerKick, triggerHihat, triggerSnare, triggerBass, triggerSynth, triggerPad]);


  const togglePlay = useCallback(() => {
    if (!isInitialized || !audioContext) {
        console.warn("Audio not initialized, cannot toggle play.");
        if (!isInitialized && !isPlaying) {
            initAudio(); // Attempt to init if not already
        }
        return;
    }

    setIsPlaying(prev => {
      const newIsPlaying = !prev;
      const now = audioContext.currentTime;
      if (nodesRef.current.masterGain) {
         nodesRef.current.masterGain.gain.cancelScheduledValues(now);
         const targetVolume = newIsPlaying ? soundParamsRef.current.masterVolume : 0;
         nodesRef.current.masterGain.gain.setTargetAtTime(targetVolume, now, 0.2); 
      }
      if (newIsPlaying) {
        currentStepRef.current = 0;
        noteTimeRef.current = audioContext.currentTime + 0.1; 
      }
      return newIsPlaying;
    });
  }, [isInitialized, audioContext, initAudio, isPlaying]); 

  const updateSoundParams = useCallback((newParams: SoundParams) => {
    soundParamsRef.current = newParams;
    updateAudioNodeParameters();
  }, [updateAudioNodeParameters]);

  const updateEmotion = useCallback((newEmotion: Emotion) => {
    emotionRef.current = newEmotion;
  }, []);

  return { isInitialized, isPlaying, initAudio, togglePlay, updateSoundParams, updateEmotion };
};
