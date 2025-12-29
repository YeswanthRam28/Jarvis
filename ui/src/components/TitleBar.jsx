import { useState } from 'react';
import { useElectron } from '../hooks/useElectron';
import { Minus, Square, X, Pin, PinOff } from 'lucide-react';

export const TitleBar = ({ title = 'JARVIS HUD' }) => {
  const {
    isElectron,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    toggleAlwaysOnTop,
    isMaximized
  } = useElectron();

  const [isPinned, setIsPinned] = useState(false);

  // Don't render if not in Electron
  if (!isElectron) return null;

  const handleTogglePin = async () => {
    const newState = await toggleAlwaysOnTop();
    setIsPinned(newState);
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-8 flex items-center justify-between bg-[rgba(0,10,20,0.95)] backdrop-blur-md border-b border-[rgba(0,200,255,0.2)] z-[10000] select-none">
      <div className="flex-1 h-full flex items-center px-3" style={{ WebkitAppRegion: 'drag' }}>
        <div className="text-[12px] font-semibold text-[rgba(0,200,255,0.9)] uppercase tracking-widest">
          {title}
        </div>
      </div>

      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          className="w-10 h-full flex items-center justify-center bg-transparent border-none text-[rgba(255,255,255,0.7)] cursor-pointer transition-all duration-200 hover:bg-[rgba(0,200,255,0.2)] hover:text-[rgba(0,200,255,1)] outline-none"
          onClick={handleTogglePin}
          title={isPinned ? 'Unpin window' : 'Pin window on top'}
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>

        <button
          className="w-[46px] h-full flex items-center justify-center bg-transparent border-none text-[rgba(255,255,255,0.7)] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,255,255,0.1)] hover:text-white outline-none"
          onClick={minimizeWindow}
          title="Minimize"
        >
          <Minus size={14} />
        </button>

        <button
          className="w-[46px] h-full flex items-center justify-center bg-transparent border-none text-[rgba(255,255,255,0.7)] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,255,255,0.1)] hover:text-white outline-none"
          onClick={maximizeWindow}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square size={14} />
        </button>

        <button
          className="w-[46px] h-full flex items-center justify-center bg-transparent border-none text-[rgba(255,255,255,0.7)] cursor-pointer transition-all duration-200 hover:bg-[rgba(255,50,50,0.8)] hover:text-white outline-none"
          onClick={closeWindow}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
