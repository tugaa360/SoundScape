
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { JogDialProps } from '../types';
import { PRIMARY_COLOR } from '../constants';

const JogDial: React.FC<JogDialProps> = ({
  label,
  min,
  max,
  value,
  formatFn,
  onChange,
  primaryColor = PRIMARY_COLOR,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastYRef = useRef(0);
  const [currentAngle, setCurrentAngle] = useState(0);

  const valueToAngle = useCallback((val: number): number => {
    const ratio = (val - min) / (max - min);
    return (ratio * 270 - 135) * (Math.PI / 180); // -135 to 135 degrees
  }, [min, max]);

  useEffect(() => {
    setCurrentAngle(valueToAngle(value));
  }, [value, valueToAngle]);
  
  const drawDial = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = 100; // Logical size
    const canvasHeight = 100; // Logical size
    
    if (canvas.width !== canvasWidth * dpr || canvas.height !== canvasHeight * dpr) {
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        ctx.scale(dpr, dpr);
    }
    
    const w = canvasWidth;
    const h = canvasHeight;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 10; // Adjusted for padding within 100x100

    ctx.clearRect(0, 0, w, h);

    // Background track
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -135 * (Math.PI / 180), 135 * (Math.PI / 180));
    ctx.stroke();

    // Value track
    ctx.strokeStyle = primaryColor; // Use prop or default
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -135 * (Math.PI / 180), currentAngle);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif'; // Reduced font size for label
    ctx.fillText(label, cx, cy - 8); // Adjusted Y for better centering
    ctx.font = 'bold 14px sans-serif'; // Reduced font size for value
    ctx.fillText(formatFn(value), cx, cy + 12); // Adjusted Y for better centering
  }, [label, value, formatFn, currentAngle, primaryColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
        // Set fixed logical size for drawing buffer, styled by Tailwind for display size
        canvas.style.width = `100px`;
        canvas.style.height = `100px`;
    }
    drawDial();
  }, [drawDial]);


  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    lastYRef.current = e.clientY;
    e.currentTarget.style.cursor = 'grabbing';
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    lastYRef.current = e.touches[0].clientY;
    e.currentTarget.style.cursor = 'grabbing';
  };
  
  const handleInteractionMove = useCallback((clientY: number, shiftKey: boolean) => {
    const deltaY = lastYRef.current - clientY;
    const range = max - min;
    const sensitivity = shiftKey ? 0.1 : 1.0; // Keep shift for fine-tuning
    
    // Adjust sensitivity based on dial range to make small ranges less jumpy
    const dynamicSensitivity = (range < 2) ? 0.3 : 1.0; // e.g. for volume 0-1
    
    const changeAmount = (deltaY / 150) * range * sensitivity * dynamicSensitivity; // Adjusted divisor for better control
    const newValue = value + changeAmount;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    
    onChange(clampedValue);
    lastYRef.current = clientY;
  }, [min, max, value, onChange]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleInteractionMove(e.clientY, e.shiftKey);
  }, [isDragging, handleInteractionMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent scroll
    handleInteractionMove(e.touches[0].clientY, false); // No shiftKey concept for touch
  }, [isDragging, handleInteractionMove]);

  const handleInteractionEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'ns-resize';
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleInteractionEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleInteractionEnd);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleInteractionEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleInteractionEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleInteractionEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleInteractionEnd);
    };
  }, [isDragging, handleMouseMove, handleInteractionEnd, handleTouchMove]);


  return (
    <div className="flex flex-col items-center gap-1 w-[100px]">
      <canvas
        ref={canvasRef}
        className="cursor-ns-resize rounded-full shadow-techno-glow hover:shadow-techno-glow-hover transition-shadow active:shadow-techno-glow-hover"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        aria-label={`${label} control dial`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatFn(value)}
        tabIndex={0} // Make it focusable
      />
      {/* Label removed from here as it's drawn on canvas for better space management */}
    </div>
  );
};

export default JogDial;