
import React, { useState, useCallback, useEffect, useRef } from 'react';
import EmotionMapCanvas from './components/EmotionMapCanvas';
import JogDial from './components/JogDial';
import { useAudioEngine } from './hooks/useAudioEngine';
import { SoundParams, Emotion, MarkerPosition, SoundParamKey } from './types';
import { JOG_DIAL_CONFIGS, INITIAL_SOUND_PARAMS, INITIAL_EMOTION, PRIMARY_COLOR } from './constants';

const App: React.FC = () => {
  const [soundParams, setSoundParams] = useState<SoundParams>(INITIAL_SOUND_PARAMS);
  const [emotion, setEmotion] = useState<Emotion>(INITIAL_EMOTION);
  const [markerPosition, setMarkerPosition] = useState<MarkerPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial marker setup
  
  const emotionMapContainerRef = useRef<HTMLDivElement>(null);

  const audioEngine = useAudioEngine();

  // Initialize marker position to center of the canvas once available
  // and set isLoading to false
  const initializeMarkerAndEmotion = useCallback(() => {
    if (emotionMapContainerRef.current) {
      const { clientWidth, clientHeight } = emotionMapContainerRef.current;
      if (clientWidth > 0 && clientHeight > 0) {
        const centeredMarker = { x: clientWidth / 2, y: clientHeight / 2 };
        setMarkerPosition(centeredMarker);
        setEmotion(INITIAL_EMOTION); // Reset emotion as well
        audioEngine.updateEmotion(INITIAL_EMOTION); // Sync with audio engine
        setIsLoading(false); // Done loading/initializing marker
      }
    }
  }, [audioEngine]); // Added audioEngine to deps

  useEffect(() => {
    // Only run if still loading and container is available
    if (isLoading && emotionMapContainerRef.current) {
      initializeMarkerAndEmotion();
    }
  }, [isLoading, initializeMarkerAndEmotion]);

  const handleEmotionMapChange = useCallback((newMarker: MarkerPosition, newEmotion: Emotion) => {
    setMarkerPosition(newMarker);
    setEmotion(newEmotion);
    audioEngine.updateEmotion(newEmotion);
  }, [audioEngine]);

  const handleJogDialChange = useCallback((id: SoundParamKey, value: number) => {
    setSoundParams(prevParams => {
      const newParams = { ...prevParams, [id]: value };
      audioEngine.updateSoundParams(newParams);
      return newParams;
    });
  }, [audioEngine]);

  const handleSoundToggle = async () => {
    if (!audioEngine.isInitialized) {
      await audioEngine.initAudio(); // This might show an alert if it fails
    }
    // Check again if initAudio succeeded before toggling play
    // audioEngine.isInitialized will be true if AudioContext was successfully created and resumed
    if (audioEngine.isInitialized) { 
         audioEngine.togglePlay();
    } else {
        // Optionally, provide feedback if audio initialization is still pending or failed
        // console.warn("Audio engine not ready. Please try again or check browser permissions.");
        // The alert inside initAudio handles critical failures.
    }
  };
  
  // Effect to handle initial audio parameters sync after engine initializes
  useEffect(() => {
    if (audioEngine.isInitialized) {
      audioEngine.updateSoundParams(soundParams);
      // Emotion is already updated by initializeMarkerAndEmotion or handleEmotionMapChange
      // but this ensures it's set if params change while engine was initializing separately.
      audioEngine.updateEmotion(emotion); 
    }
  }, [audioEngine.isInitialized, soundParams, emotion, audioEngine]);


  useEffect(() => {
    const handleResize = () => {
      // Re-initialize marker and emotion on resize to keep it centered.
      // This is because the EmotionMapCanvas itself handles internal resizing,
      // but the App's concept of the marker's "meaning" (center = neutral) needs update.
      initializeMarkerAndEmotion();
    };
    
    // Initial centering of marker (if not done by isLoading effect)
    const timeoutId = setTimeout(() => {
        if (isLoading && emotionMapContainerRef.current) {
            initializeMarkerAndEmotion();
        }
    }, 50); // Small delay to ensure layout is stable


    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeMarkerAndEmotion, isLoading]);


  return (
    <div className="flex flex-col items-center min-h-screen p-2 sm:p-4 bg-bg-dark text-gray-100 box-border selection:bg-techno-magenta selection:text-white">
      <div className="container max-w-3xl w-full flex flex-col gap-4 sm:gap-6">
        <header className="my-4 sm:my-6">
          <h1 className="text-techno-magenta text-center text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ textShadow: `0 0 10px ${PRIMARY_COLOR}A0, 0 0 20px ${PRIMARY_COLOR}80` }}>
            サウンドスケープ <span className="text-gray-300">Techno Edition</span>
          </h1>
          <p className="text-center text-text-muted text-sm sm:text-base mt-2">インタラクティブなテクノミュージックジェネレーター</p>
        </header>
        
        <main className="flex flex-col gap-4 sm:gap-6">
          <section id="emotion-map-section" ref={emotionMapContainerRef} className="w-full bg-card-bg p-3 sm:p-4 rounded-xl border border-border-dark shadow-xl">
            {isLoading ? (
                <div className="w-full aspect-[16/9] flex items-center justify-center text-text-muted">
                    <svg className="animate-spin h-8 w-8 text-techno-magenta mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    マップを読み込み中...
                </div>
            ) : (
              <EmotionMapCanvas 
                marker={markerPosition}
                onPositionChange={handleEmotionMapChange}
                primaryColor={PRIMARY_COLOR}
              />
            )}
          </section>

          <section id="controls-section" className="p-3 sm:p-5 border border-border-dark rounded-xl bg-card-bg w-full box-border flex flex-col items-center shadow-xl">
            <button 
              id="sound-toggle-button"
              onClick={handleSoundToggle}
              className="w-full max-w-sm mb-6 sm:mb-8 px-6 py-3 text-lg sm:text-xl font-semibold rounded-lg border-2 border-techno-magenta bg-opacity-50 backdrop-blur-sm text-techno-magenta transition-all duration-200 ease-in-out
                         hover:bg-techno-magenta hover:text-white hover:shadow-techno-glow-hover focus:outline-none focus:ring-4 focus:ring-techno-magenta-light focus:ring-opacity-75 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading} // Disable button while map is loading
            >
              {audioEngine.isPlaying ? 'サウンド停止' : (audioEngine.isInitialized ? 'サウンド開始' : 'サウンド準備完了 (クリック)')}
            </button>
            
            <div id="jog-dials-container" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-2 gap-y-5 sm:gap-x-4 sm:gap-y-6 w-full justify-items-center">
              {JOG_DIAL_CONFIGS.map(config => (
                <JogDial
                  key={config.id}
                  id={config.id}
                  label={config.label}
                  min={config.min}
                  max={config.max}
                  value={soundParams[config.id]}
                  formatFn={config.formatFn}
                  onChange={(value) => handleJogDialChange(config.id, value)}
                  primaryColor={PRIMARY_COLOR}
                />
              ))}
            </div>
          </section>
        </main>
        <footer className="text-center py-4 text-xs text-text-muted">
          <p>&copy; {new Date().getFullYear()} Techno Soundscape Generator. All rights reserved (not really).</p>
           <p>For best experience, use a modern browser with Web Audio API support.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;