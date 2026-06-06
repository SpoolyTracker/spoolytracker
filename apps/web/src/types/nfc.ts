
export interface NFCBridgeStatus {
    connected: boolean;
    error: string | null;
    readerName: string | null;
}

export interface NFCTagEvent {
    uid: string;
    atr?: string;
    standard?: string;
    data?: number[]; // Raw memory data (Pages 4+)
}
