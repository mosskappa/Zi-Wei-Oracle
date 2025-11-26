import React from 'react';

const StarryBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-midnight-950">
      {/* 1. Deep Void Gradient (Base) */}
      <div className="absolute inset-0 bg-gradient-to-b from-midnight-950 via-[#0f172a] to-[#1e1b4b]" />

      {/* 2. Imperial Nebulas (Purple & Gold Hints) */}
      {/* Top Left - Imperial Mist */}
      <div className="absolute top-[-20%] left-[-10%] w-[90vw] h-[90vw] bg-imperial-900/40 rounded-full blur-[150px] mix-blend-screen opacity-50 animate-pulse-slow" />
      
      {/* Bottom Right - Midnight Haze */}
      <div className="absolute bottom-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-midnight-800/30 rounded-full blur-[150px] mix-blend-screen opacity-40" />
      
      {/* Center - Subtle Gold Qi Flow */}
      <div className="absolute top-[20%] left-[30%] w-[40vw] h-[40vw] bg-gold-500/5 rounded-full blur-[100px] animate-float" />

      {/* 3. Refined Stars with Drift */}
      <div className="absolute inset-0 opacity-40 animate-drift"
           style={{
             backgroundImage: 'radial-gradient(white 1.5px, transparent 1.5px), radial-gradient(white 1px, transparent 1px)',
             backgroundSize: '100px 100px, 60px 60px',
             backgroundPosition: '0 0, 30px 30px',
           }}>
      </div>
      
      {/* 4. Grid Overlay (Optional) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
    </div>
  );
};

export default StarryBackground;