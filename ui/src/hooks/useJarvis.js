import { useState, useEffect, useCallback } from 'react';

export const useJarvis = () => {
    const [socket, setSocket] = useState(null);
    const [status, setStatus] = useState('idle');
    const [transcription, setTranscription] = useState('');
    const [response, setResponse] = useState('');
    const [state, setState] = useState({ awaiting_command: true });

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8000/ws');

        ws.onopen = () => {
            console.log('Connected to JARVIS Backend');
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

        ws.onclose = () => {
            console.log('Disconnected from JARVIS Backend');
            // Reconnect logic could be added here
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, []);

    return { status, transcription, response, state };
};
