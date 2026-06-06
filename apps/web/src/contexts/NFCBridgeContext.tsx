
import { createContext, useContext, useRef, useState, useCallback } from 'react';
import type { NFCBridgeStatus, NFCTagEvent } from '../types/nfc';

interface NFCBridgeContextType extends NFCBridgeStatus {
    reconnect: () => void;
    subscribe: (callback: (tag: NFCTagEvent) => void) => () => void;
}

const NFCBridgeContext = createContext<NFCBridgeContextType | null>(null);

export const NFCBridgeProvider = ({ children }: { children: React.ReactNode }) => {
    const [status, setStatus] = useState<NFCBridgeStatus>({
        connected: false,
        error: null,
        readerName: null
    });

    const listenersRef = useRef<Set<(tag: NFCTagEvent) => void>>(new Set());
    const wsRef = useRef<WebSocket | null>(null);

    const broadcastTag = (tag: NFCTagEvent) => {
        console.log(`[NFC Context] Broadcasting tag to ${listenersRef.current.size} listeners`, tag);
        listenersRef.current.forEach(listener => listener(tag));
    };

    const connect = useCallback(() => {
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
            return; // Already connecting or connected
        }

        const ws = new WebSocket('ws://localhost:8999');
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus(s => ({ ...s, connected: true, error: null }));
        };

        ws.onclose = () => {
            setStatus(s => ({ ...s, connected: false, readerName: null }));
            wsRef.current = null;
        };

        ws.onerror = () => {
            // Silent error
            setStatus(s => ({ ...s, connected: false, error: 'Connection Failed' }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'reader_attached':
                        setStatus(s => ({ ...s, readerName: data.name }));
                        break;
                    case 'reader_removed':
                        setStatus(s => ({ ...s, readerName: null }));
                        break;
                    case 'tag_read':
                        broadcastTag(data);
                        break;
                    case 'error':
                        setStatus(s => ({ ...s, error: data.message }));
                        break;
                }
            } catch (e) {
                console.error('[NFC Bridge] Parse error', e);
            }
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, []);

    const subscribe = useCallback((callback: (tag: NFCTagEvent) => void) => {
        listenersRef.current.add(callback);
        return () => {
            listenersRef.current.delete(callback);
        };
    }, []);

    // Initial connection attempt (once) - Disabled per user request for manual control
    // useEffect(() => {
    //     connect();
    //     return () => wsRef.current?.close();
    // }, [connect]); 


    return (
        <NFCBridgeContext.Provider value={{ ...status, reconnect: connect, subscribe }}>
            {children}
        </NFCBridgeContext.Provider>
    );
};

export const useNFCBridgeContext = () => {
    const context = useContext(NFCBridgeContext);
    if (!context) {
        throw new Error('useNFCBridgeContext must be used within a NFCBridgeProvider');
    }
    return context;
};
