
export interface NFCBridgeStatus {
    connected: boolean;
    error: string | null;
    readerName: string | null;
}

export interface NFCTagEvent {
    uid: string;
    atr?: string;
    standard?: string;
    source?: 'bambu' | 'tigertag' | 'generic';
    data?: number[]; // Raw memory data (Pages 4+)
    bambu?: {
        tagId: string;
        uidHex: string;
        materialId?: string;
        variantId?: string;
        filamentType?: string;
        detailedFilamentType?: string;
        colorHex?: string;
        spoolWeight?: number;
        filamentDiameter?: number;
        dryingTemp?: number;
        dryingTime?: number;
        bedTemp?: number;
        nozzleTempMin?: number;
        nozzleTempMax?: number;
        nozzleDiameter?: number;
        trayUid?: string;
        productionDate?: string;
        filamentLength?: number;
        spoolWidth?: number;
        rawBlocks?: Record<number, string>;
    };
}
