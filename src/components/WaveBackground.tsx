import React from 'react';
import { motion } from 'motion/react';

interface WaveBackgroundProps {
  level: number;
  state: 'normal' | 'warning' | 'danger';
}

export const WaveBackground: React.FC<WaveBackgroundProps> = ({ level, state }) => {
  const waterHeight = Math.max(5, Math.min(level, 95));

  const stateGradients = {
    normal: 'linear-gradient(60deg, rgba(84,58,183,1) 0%, rgba(0,172,193,1) 100%)',
    warning: 'linear-gradient(60deg, rgba(234,88,12,1) 0%, rgba(249,115,22,1) 100%)',
    danger: 'linear-gradient(60deg, rgba(220,38,38,1) 0%, rgba(239,68,68,1) 100%)'
  };

  const waveColors = {
    normal: [
      'rgba(255,255,255,0.7)',
      'rgba(255,255,255,0.5)',
      'rgba(255,255,255,0.3)',
      '#fff'
    ],
    warning: [
      'rgba(255,255,255,0.6)',
      'rgba(255,255,255,0.4)',
      'rgba(255,255,255,0.2)',
      'rgba(255,255,255,0.8)'
    ],
    danger: [
      'rgba(255,255,255,0.5)',
      'rgba(255,255,255,0.3)',
      'rgba(255,255,255,0.1)',
      'rgba(255,255,255,0.7)'
    ]
  };

  const activeColors = waveColors[state];

  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-all duration-1000"
      style={{ background: stateGradients[state] }}
    >
      <style>{`
        .waves {
          position:relative;
          width: 100%;
          height:15vh;
          margin-bottom:-7px;
          min-height:100px;
          max-height:150px;
        }

        .parallax > use {
          animation: move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite;
        }
        .parallax > use:nth-child(1) {
          animation-delay: -2s;
          animation-duration: 7s;
        }
        .parallax > use:nth-child(2) {
          animation-delay: -3s;
          animation-duration: 10s;
        }
        .parallax > use:nth-child(3) {
          animation-delay: -4s;
          animation-duration: 13s;
        }
        .parallax > use:nth-child(4) {
          animation-delay: -5s;
          animation-duration: 20s;
        }
        @keyframes move-forever {
          0% {
            transform: translate3d(-90px,0,0);
          }
          100% { 
            transform: translate3d(85px,0,0);
          }
        }
        @media (max-width: 768px) {
          .waves {
            height:40px;
            min-height:40px;
          }
        }
      `}</style>
      
      <motion.div 
        className="absolute bottom-0 w-full h-full flex flex-col justify-end"
        initial={{ y: "100%" }}
        animate={{ y: `${100 - waterHeight}%` }}
        transition={{ type: "spring", damping: 25, stiffness: 30, mass: 1 }}
      >
        <div className="relative w-full">
          <svg className="waves" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
            <defs>
              <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
            </defs>
            <g className="parallax">
              <use xlinkHref="#gentle-wave" x="48" y="0" fill={activeColors[0]} />
              <use xlinkHref="#gentle-wave" x="48" y="3" fill={activeColors[1]} />
              <use xlinkHref="#gentle-wave" x="48" y="5" fill={activeColors[2]} />
              <use xlinkHref="#gentle-wave" x="48" y="7" fill={activeColors[3]} />
            </g>
          </svg>
        </div>
        <div 
          className="w-full h-screen transition-colors duration-1000" 
          style={{ backgroundColor: activeColors[3] }}
        />
      </motion.div>
    </div>
  );
};

