import { useState, useEffect } from 'react';

/**
 * Custom hook to interact with Electron APIs
 * Provides window controls and app information
 */
export const useElectron = () => {
    const [isElectron, setIsElectron] = useState(false);
    const [appVersion, setAppVersion] = useState('');
    const [isMaximized, setIsMaximized] = useState(false);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

    useEffect(() => {
        // Check if running in Electron
        if (window.electronAPI) {
            setIsElectron(true);

            // Get app version
            window.electronAPI.getAppVersion().then(version => {
                setAppVersion(version);
            });

            // Get initial maximized state
            window.electronAPI.isMaximized().then(maximized => {
                setIsMaximized(maximized);
            });
        }
    }, []);

    const minimizeWindow = () => {
        if (window.electronAPI) {
            window.electronAPI.minimizeWindow();
        }
    };

    const maximizeWindow = () => {
        if (window.electronAPI) {
            window.electronAPI.maximizeWindow();
            setIsMaximized(!isMaximized);
        }
    };

    const closeWindow = () => {
        if (window.electronAPI) {
            window.electronAPI.closeWindow();
        }
    };

    const hideWindow = () => {
        if (window.electronAPI) {
            window.electronAPI.hideWindow();
        }
    };

    const toggleAlwaysOnTop = async () => {
        if (window.electronAPI) {
            const newState = await window.electronAPI.toggleAlwaysOnTop();
            setIsAlwaysOnTop(newState);
            return newState;
        }
        return false;
    };

    return {
        isElectron,
        appVersion,
        isMaximized,
        isAlwaysOnTop,
        platform: window.electronAPI?.platform || 'web',
        versions: window.electronAPI?.versions || {},
        minimizeWindow,
        maximizeWindow,
        closeWindow,
        hideWindow,
        toggleAlwaysOnTop,
    };
};
