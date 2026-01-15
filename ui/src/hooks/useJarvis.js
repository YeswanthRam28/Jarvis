import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage Jarvis backend connection via WebSocket
 * Handles voice transcription, AI responses, system telemetry, and commands
 */
export const useJarvis = () => {
    const [status, setStatus] = useState('offline'); // 'offline' | 'idle' | 'listening' | 'processing'
    const [transcription, setTranscription] = useState('');
    const [response, setResponse] = useState('');
    const [state, setState] = useState({});
    const [backendUrl, setBackendUrl] = useState(() => {
        return localStorage.getItem('jarvis_backend_url') || 'http://localhost:8000';
    });
    const [telemetry, setTelemetry] = useState({
        cpu: 0,
        memory: 0,
        active_mem: '0GB',
        total_mem: '0GB'
    });

    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 10;

    // WebSocket connection management
    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            // Convert HTTP/HTTPS URL to WebSocket URL
            let wsUrl;
            if (backendUrl.startsWith('http://') || backendUrl.startsWith('https://')) {
                wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws';
            } else if (backendUrl.startsWith('ws://') || backendUrl.startsWith('wss://')) {
                wsUrl = backendUrl + '/ws';
            } else {
                // Default to ws:// if no protocol specified
                wsUrl = `ws://${backendUrl}/ws`;
            }

            console.log(`[Jarvis] Connecting to ${wsUrl}...`);

            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('[Jarvis] WebSocket connected');
                setStatus('idle');
                reconnectAttempts.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Jarvis] Received:', data);

                    // Handle different message types
                    switch (data.type) {
                        case 'status':
                            setStatus(data.status || 'idle');
                            break;

                        case 'transcription':
                            setTranscription(data.text || '');
                            break;

                        case 'response':
                            setResponse(data.text || '');
                            // Clear response after 10 seconds
                            setTimeout(() => setResponse(''), 10000);
                            break;

                        case 'state':
                            setState(data.state || {});
                            break;

                        case 'telemetry':
                            setTelemetry({
                                cpu: data.cpu || 0,
                                memory: data.memory || 0,
                                active_mem: data.active_mem || '0GB',
                                total_mem: data.total_mem || '0GB'
                            });
                            break;

                        case 'listening':
                            setStatus('listening');
                            break;

                        case 'processing':
                            setStatus('processing');
                            break;

                        case 'idle':
                            setStatus('idle');
                            setTranscription('');
                            break;

                        default:
                            console.log('[Jarvis] Unknown message type:', data.type);
                    }
                } catch (error) {
                    console.error('[Jarvis] Error parsing message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[Jarvis] WebSocket error:', error);
                setStatus('offline');
            };

            ws.onclose = () => {
                console.log('[Jarvis] WebSocket disconnected');
                setStatus('offline');
                wsRef.current = null;

                // Attempt to reconnect
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`[Jarvis] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current += 1;
                        connect();
                    }, delay);
                } else {
                    console.error('[Jarvis] Max reconnection attempts reached');
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('[Jarvis] Connection error:', error);
            setStatus('offline');
        }
    }, [backendUrl]);

    // Send command to backend
    const sendCommand = useCallback((type, command, params = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const message = {
                type,
                command,
                ...params
            };
            console.log('[Jarvis] Sending:', message);
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.error('[Jarvis] WebSocket not connected');
        }
    }, []);

    // Update backend URL
    const updateBackendUrl = useCallback((newUrl) => {
        setBackendUrl(newUrl);
        localStorage.setItem('jarvis_backend_url', newUrl);

        // Close existing connection and reconnect
        if (wsRef.current) {
            wsRef.current.close();
        }
        reconnectAttempts.current = 0;
    }, []);

    // Connect on mount and when backend IP changes
    useEffect(() => {
        connect();

        // Cleanup on unmount
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    // Periodically request telemetry
    useEffect(() => {
        const interval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                sendCommand('get_telemetry');
            }
        }, 2000); // Request telemetry every 2 seconds

        return () => clearInterval(interval);
    }, [sendCommand]);

    return {
        status,
        transcription,
        response,
        state,
        sendCommand,
        backendUrl,
        updateBackendUrl,
        telemetry,
        isConnected: wsRef.current?.readyState === WebSocket.OPEN
    };
};
