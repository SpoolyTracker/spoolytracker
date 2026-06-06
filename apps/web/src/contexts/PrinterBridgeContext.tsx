import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';

// Printer status types
export interface PrinterStatus {
    state: string; // IDLE, RUNNING, etc.
    progress: number;
    timeLeft: number;
    bedTemp: number;
    targetBedTemp: number;
    nozzleTemp: number;
    targetNozzleTemp: number;
    file: string;
    jobId: string;
    speed: string;
    layer: number;
    totalLayers: number;
}

// Printer data structure
export interface PrinterData {
    serial: string;
    name?: string; // Add name field
    status: string; // CONNECTING, ONLINE, OFFLINE
    data?: PrinterStatus;
}

// Define the context type
interface PrinterBridgeContextType {
    isConnected: boolean;
    printers: { [serial: string]: PrinterData };
    downloadFile: (serial: string, filename: string) => Promise<Blob>;
    getFileUrl: (filename: string) => string;
}

// Create the context
const PrinterBridgeContext = createContext<PrinterBridgeContextType | undefined>(undefined);

// WebSocket URL from environment variables
const WS_URL = import.meta.env.VITE_BRIDGE_WS_URL || 'ws://localhost:9000';
const HTTP_URL = import.meta.env.VITE_BRIDGE_HTTP_URL || 'http://localhost:9000';

interface PrinterBridgeProviderProps {
    children: ReactNode;
}

export const PrinterBridgeProvider: React.FC<PrinterBridgeProviderProps> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [printers, setPrinters] = useState<{ [serial: string]: PrinterData }>({});
    const socketRef = useRef<WebSocket | null>(null);

    const connect = () => {
        if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
            console.log('[BridgeContext] WebSocket already connected or connecting.');
            return;
        }

        console.log(`[BridgeContext] Attempting to connect to WebSocket at ${WS_URL}`);
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('[BridgeContext] WebSocket connected');
            setIsConnected(true);
            // Request initial printer list
            ws.send(JSON.stringify({ type: 'get_printers' }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            } catch (e) {
                console.error('[BridgeContext] Failed to parse message:', e, event.data);
            }
        };

        ws.onclose = (event) => {
            console.log('[BridgeContext] WebSocket disconnected:', event.code, event.reason);
            setIsConnected(false);
            setPrinters({}); // Clear printers on disconnect
            // Attempt to reconnect after a delay
            setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
            console.error('[BridgeContext] WebSocket error:', error);
            ws.close(); // Close to trigger onclose and reconnect logic
        };

        socketRef.current = ws;
    };

    const disconnect = () => {
        if (socketRef.current) {
            console.log('[BridgeContext] Disconnecting WebSocket');
            socketRef.current.close();
            socketRef.current = null;
        }
    };

    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, []);

    const socket = socketRef.current;

    const handleMessage = (msg: any) => {
        if (msg.type === 'printer_status') {
            setPrinters(prev => ({
                ...prev,
                [msg.serial]: {
                    ...prev[msg.serial],
                    serial: msg.serial,
                    status: msg.status
                }
            }));
        } else if (msg.type === 'printer_data') {
            setPrinters(prev => ({
                ...prev,
                [msg.serial]: {
                    ...prev[msg.serial],
                    serial: msg.serial,
                    name: msg.data.name || prev[msg.serial]?.name, // Update name
                    data: msg.data.status // The parsed status from bridge
                }
            }));
        } else if (msg.type === 'printer_list') {
            const newPrinters: { [serial: string]: PrinterData } = {};
            msg.printers.forEach((p: any) => {
                newPrinters[p.serial] = {
                    serial: p.serial,
                    name: p.name,
                    status: p.status,
                    data: p.data // This might be null or partial initially
                };
            });
            setPrinters(newPrinters);
        } else if (msg.type === 'printer_connected') {
            setPrinters(prev => ({
                ...prev,
                [msg.serial]: {
                    ...prev[msg.serial],
                    serial: msg.serial,
                    status: 'ONLINE',
                    name: msg.name || prev[msg.serial]?.name,
                }
            }));
        } else if (msg.type === 'printer_disconnected') {
            setPrinters(prev => ({
                ...prev,
                [msg.serial]: {
                    ...prev[msg.serial],
                    serial: msg.serial,
                    status: 'OFFLINE',
                }
            }));
        }
    };

    const downloadFile = async (serial: string, filename: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            if (!socket) return reject(new Error('No connection to bridge'));

            // Timeout in case bridge doesn't respond
            const timeout = setTimeout(() => {
                socket.removeEventListener('message', handleDownloadResponse);
                reject(new Error('Download timeout (printer may be busy or file not found)'));
            }, 60000); // 60s timeout

            const handleDownloadResponse = async (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'download_finished' && msg.filename === filename && msg.serial === serial) {
                        clearTimeout(timeout);
                        socket.removeEventListener('message', handleDownloadResponse);

                        // File is ready, fetch it via HTTP
                        try {
                            const url = `${HTTP_URL}/downloads/${encodeURIComponent(filename)}`;
                            console.log(`[BridgeContext] Fetching: ${url}`);
                            const response = await fetch(url);
                            if (!response.ok) throw new Error(`Failed to fetch file from bridge: ${response.status} ${response.statusText}`);
                            const blob = await response.blob();
                            resolve(blob);
                        } catch (e) {
                            console.error('[BridgeContext] Fetch Error:', e);
                            reject(e);
                        }
                    } else if (msg.type === 'download_error') {
                        // We can't be 100% sure it's for us without ID, but it probably is if it happens now
                        // Ideally protocol would include request ID.
                        // For now, if we get an error right after requesting, it's likely ours.
                        // But to be safe, we just log it. The timeout will handle non-response.
                        console.error('[Bridge] Download Error:', msg.message);
                    }
                } catch (e) { }
            };

            if (socket.readyState !== WebSocket.OPEN) {
                const err = new Error(`Socket not open (State: ${socket.readyState})`);
                console.error('[BridgeContext] Cannot send:', err);
                return reject(err);
            }

            socket.addEventListener('message', handleDownloadResponse);
            const payload = JSON.stringify({ type: 'download_file', serial, filename });
            console.log('[BridgeContext] Sending WS command:', payload);
            socket.send(payload);
        });
    };

    const getFileUrl = (filename: string) => {
        return `${HTTP_URL}/downloads/${encodeURIComponent(filename)}`;
    };

    return (
        <PrinterBridgeContext.Provider value={{ isConnected, printers, downloadFile, getFileUrl }}>
            {children}
        </PrinterBridgeContext.Provider>
    );
};

export const usePrinterBridge = () => {
    const context = useContext(PrinterBridgeContext);
    if (!context) {
        throw new Error('usePrinterBridge must be used within a PrinterBridgeProvider');
    }
    return context;
};
