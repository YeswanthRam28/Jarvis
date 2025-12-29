import React from 'react';
import LiquidEther from './LiquidEther';
import TargetCursor from './TargetCursor';
import { TitleBar } from './TitleBar';
import { useElectron } from '../hooks/useElectron';

const PageLayout = ({ children }) => {
    const { isElectron } = useElectron();

    return (
        <div className="w-full h-full flex flex-col bg-[#121212] text-white overflow-hidden font-main relative">
            {/* Electron Title Bar */}
            <TitleBar title="JARVIS HUD" />

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

            <div className={`relative z-10 w-full h-full ${isElectron ? 'pt-8' : ''}`}>
                {children}
            </div>
        </div>
    );
};

export default PageLayout;
