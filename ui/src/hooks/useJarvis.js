import { useState, useEffect, useCallback } from 'react';

export const useJarvis = () => {
    const [socket, setSocket] = useState(null);
    const [status, setStatus] = useState('idle');
    const [transcription, setTranscription] = useState('');
    const [response, setResponse] = useState('');
    const [state, setState] = useState({ awaiting_command: true });
    const [backendIp, setBackendIp] = useState(localStorage.getItem('jarvis_backend_ip') || 'localhost');

    useEffect(() => {
        const wsUrl = `ws://${backendIp}:8000/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`Connected to JARVIS Backend at ${backendIp}`);
            setStatus('idle');
        };

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('Received:', message);

            switch (message.type) {
                case 'status':
                    setStatus(message.data);
                    if (message.data === 'processing') {
                        setTranscription('');
                        setResponse('');
                    }
                    break;
                case 'transcription':
                    setTranscription(message.data);
                    break;
                case 'response':
                    setResponse(message.data);
                    break;
                case 'state':
                    setState(message.data);
                    break;
                default:
                    break;
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            setStatus('offline');
        };

        ws.onclose = () => {
            console.log('Disconnected from JARVIS Backend');
            setStatus('offline');
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, [backendIp]);

    const updateBackendIp = (ip) => {
        localStorage.setItem('jarvis_backend_ip', ip);
        setBackendIp(ip);
    };

    const sendCommand = useCallback((type, data) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type, data }));
        }
    }, [socket]);

    return { status, transcription, response, state, sendCommand, backendIp, updateBackendIp };
};
