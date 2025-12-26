import React from 'react';
import LiquidEther from './LiquidEther';
import TargetCursor from './TargetCursor';

const PageLayout = ({ children }) => {
    return (
        <div className="w-full h-full flex flex-col bg-[#121212] text-white overflow-hidden font-main relative">
            {/* GLOBAL LIQUID ETHER BACKGROUND */}
            <div className="absolute inset-0 z-0 opacity-100 pointer-events-none">
                <LiquidEther
                    colors={['#5227FF', '#FF9FFC', '#B19EEF', '#000000']} // Purple, Pink, Lavender
                    mouseForce={20}
                    cursorSize={100}
                    resolution={0.5}
                    autoDemo={true}
                    autoSpeed={0.5}
                />
            </div>

            <TargetCursor
                spinDuration={4}
                hideDefaultCursor={true}
                parallaxOn={true}
            />
            <div className="hologram-scanline pointer-events-none" />

            {/* GLOBAL BACKGROUND DECORATION */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] border border-[#5227FF]/20 rounded-full fui-flourish" />
                <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] border border-[#FF9FFC]/10 rounded-full fui-flourish" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
};

export default PageLayout;
