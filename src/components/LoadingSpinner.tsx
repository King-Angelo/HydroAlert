import React from 'react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullScreen = false }) => {
  return (
    <div className={fullScreen ? "fixed inset-0 z-[9999] bg-[#03678D] flex items-center justify-center h-screen w-screen" : "spinner-container"}>
      <div className="main_spinner">
        <div className="center_mass"></div>
        <div className="dot dot_1"></div>
        <div className="dot dot_2"></div>
      </div>
      {fullScreen && (
        <div className="absolute bottom-10 left-0 right-0 text-center animate-pulse">
           <p className="text-white/60 font-bold uppercase tracking-[0.3em] text-[10px]">HydroAlert System Loading</p>
        </div>
      )}
    </div>
  );
};
