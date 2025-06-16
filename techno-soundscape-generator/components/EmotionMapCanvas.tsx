
import React, { useRef, useEffect, useCallback } from 'react';
import { EmotionMapCanvasProps, MarkerPosition, Emotion } from '../types';
import { PRIMARY_COLOR } from '../constants';

const EmotionMapCanvas: React.FC<EmotionMapCanvasProps> = ({ marker, onPositionChange, primaryColor = PRIMARY_COLOR }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const drawCanvas = useCallback((currentMarker?: MarkerPosition | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect(); // Use actual canvas rect for drawing dimensions
    
    // Check if canvas dimensions are zero, if so, don't draw
    if (rect.width === 0 || rect.height === 0) return;

    // Set canvas internal size based on display size and DPR
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    }
    
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(displayWidth / 2, 0);
    ctx.lineTo(displayWidth / 2, displayHeight);
    ctx.moveTo(0, displayHeight / 2);
    ctx.lineTo(displayWidth, displayHeight / 2);
    ctx.stroke();

    // Marker
    if (currentMarker) {
      const arousalEffect = marker ? (marker.y / displayHeight - 0.5) * -1 * 2 * 5 : 0; // arousal mapped to size
      const markerRadius = Math.max(5, 10 + arousalEffect);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(currentMarker.x, currentMarker.y, markerRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [primaryColor, marker]); // marker dependency is important for arousal effect on size

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const { clientWidth, clientHeight } = container;
    canvas.style.width = `${clientWidth}px`;
    canvas.style.height = `${clientHeight}px`;
    
    // Update drawing. If no marker, it means it's initial load or reset.
    // Parent will provide centered marker if needed on resize.
    drawCanvas(marker); 
  }, [drawCanvas, marker]);

  useEffect(() => {
    resizeCanvas(); // Initial resize and draw
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    drawCanvas(marker); // Redraw whenever marker changes
  }, [marker, drawCanvas]);

  const calculateEmotion = (x: number, y: number, width: number, height: number): Emotion => {
    const valence = (x / width) * 2 - 1;
    const arousal = -((y / height) * 2 - 1); // Y is inverted
    return { valence, arousal };
  };

  const handleInteraction = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    
    const newMarkerPos = { x, y };
    const newEmotion = calculateEmotion(x, y, rect.width, rect.height);
    onPositionChange(newMarkerPos, newEmotion);
  }, [onPositionChange]);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleInteraction(event);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    handleInteraction(event);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };
  
  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    handleInteraction(event);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    event.preventDefault(); // Prevent scrolling while dragging on map
    handleInteraction(event);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    // Add mouseup/touchend to document to catch events outside canvas
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);


  return (
    <div ref={containerRef} id="emotion-map-container" className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-border-dark bg-black cursor-crosshair shadow-lg">
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        aria-label="感情マップキャンバス"
        tabIndex={0}
      />
      <div className="axis-label absolute top-2 left-1/2 -translate-x-1/2 text-xs text-text-muted bg-black/70 px-2 py-1 rounded shadow-techno-glow">(Arousal+) 高揚</div>
      <div className="axis-label absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-text-muted bg-black/70 px-2 py-1 rounded shadow-techno-glow">(Arousal-) 沈静</div>
      <div className="axis-label absolute top-1/2 right-2 -translate-y-1/2 text-xs text-text-muted bg-black/70 px-2 py-1 rounded shadow-techno-glow rotate-90 origin-center">(Valence+) 快</div>
      <div className="axis-label absolute top-1/2 left-2 -translate-y-1/2 text-xs text-text-muted bg-black/70 px-2 py-1 rounded shadow-techno-glow -rotate-90 origin-center">(Valence-) 不快</div>
    </div>
  );
};

export default EmotionMapCanvas;