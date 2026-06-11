import React, { useState, useEffect } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';

interface SosButtonProps {
  onSosTrigger: (location: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
}

export const SosButton: React.FC<SosButtonProps> = ({ onSosTrigger, disabled }) => {
  const [progress, setProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPressing) {
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) return 100;
          return p + (100 / (5000 / 50));
        });
      }, 50);
    } else {
      setProgress(0);
    }

    return () => clearInterval(interval);
  }, [isPressing]);

  useEffect(() => {
    if (progress >= 100) {
      handleTrigger();
      setIsPressing(false);
      setProgress(0);
    }
  }, [progress]);

  const handleTrigger = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          onSosTrigger({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
          setErrorMsg("Failed to get device location. Ensure location services are enabled.");
        }
      );
    } else {
      setErrorMsg("Geolocation is not supported by this browser.");
    }
  };

  const bind = {
    onMouseDown: () => !disabled && setIsPressing(true),
    onMouseUp: () => setIsPressing(false),
    onMouseLeave: () => setIsPressing(false),
    onTouchStart: () => !disabled && setIsPressing(true),
    onTouchEnd: () => setIsPressing(false),
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-rose-500 text-sm bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-center"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-center justify-center w-48 h-48">
        <div className="absolute w-44 h-44 border-4 border-red-200 rounded-full animate-ping pointer-events-none"></div>

        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-xl" viewBox="0 0 100 100">
          <circle 
            cx="50" cy="50" r="46" 
            fill="none" 
            stroke="rgba(0,0,0,0.05)" 
            strokeWidth="8" 
          />
          <circle 
            cx="50" cy="50" r="46" 
            fill="none" 
            stroke={progress > 80 ? "#dc2626" : progress > 40 ? "#f97316" : "#3b82f6"} 
            strokeWidth="8" 
            strokeDasharray="289.026" 
            strokeDashoffset={289.026 - (289.026 * progress) / 100}
            className="transition-all duration-75 ease-linear"
          />
        </svg>

        <button
          {...bind}
          disabled={disabled}
          className={clsx(
            "w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-2xl z-10",
            "bg-red-600 hover:bg-red-500 active:bg-red-700 transition-colors",
            "border-8 border-red-500 disabled:opacity-50 disabled:cursor-not-allowed group",
            isPressing ? "scale-95" : "scale-100"
          )}
          style={{ transitionDuration: isPressing ? '0.1s' : '0.3s' }}
        >
          <AlertTriangle className="w-10 h-10 text-white mb-2" />
          <span className="text-white font-black text-sm uppercase tracking-tighter">Hold 5s</span>
          <span className="text-red-200 text-[10px] font-bold mt-1 uppercase">To Alert Admin</span>
        </button>
      </div>
      <div className="mt-8 flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
         <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div> GPS Active
         </div>
      </div>
    </div>
  );
};
