import { useEffect, useRef } from 'react';
import type { NFCTagEvent } from '../types/nfc';
import { useNFCBridgeContext } from '../contexts/NFCBridgeContext';

export const useNFCBridge = (onTagRead?: (tag: NFCTagEvent) => void) => {
    const context = useNFCBridgeContext();
    const onTagReadRef = useRef(onTagRead);

    useEffect(() => {
        onTagReadRef.current = onTagRead;
    }, [onTagRead]);

    useEffect(() => {
        if (!onTagRead) return;

        const unsubscribe = context.subscribe((tag) => {
            if (onTagReadRef.current) {
                onTagReadRef.current(tag);
            }
        });
        return unsubscribe;
    }, [context.subscribe, onTagRead]); // Re-subscribe only if subscribe reference changes (stable) or if onTagRead existence changes

    return {
        connected: context.connected,
        error: context.error,
        readerName: context.readerName,
        reconnect: context.reconnect
    };
};
