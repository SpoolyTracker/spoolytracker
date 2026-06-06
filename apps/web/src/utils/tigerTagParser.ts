// TigerTag NTAG213 Parser
// Ported from Mobile App

export interface TigerTagData {
    tagId: string;
    tigerTagVersion?: number;
    productId?: number;
    materialId?: number;
    diameter?: number;
    aspectId1?: number;
    aspectId2?: number;
    typeId?: number;
    brandId?: number;
    unitId?: number;

    // Extended Data
    colorHex?: string; // RRGGBBAA
    measure?: number;
    nozzleTempMin?: number;
    nozzleTempMax?: number;
    dryTemp?: number;
    dryTime?: number;
    bedTempMin?: number;
    bedTempMax?: number;

    // Metadata
    transmissionDistance?: number;
    timestamp?: number;
    weightRemaining?: number;
    rawData?: any;
}

/**
 * Parse Raw TigerTag data (direct memory read)
 * Buffer MUST start from Page 4
 */
export function parseRawTigerTag(buffer: Uint8Array | number[]): TigerTagData | null {
    try {
        const payload = Array.from(buffer); // Ensure array

        // Need at least up to Page 11 (offset 31) for basic specs
        if (payload.length < 32) return null;

        const data: TigerTagData = {
            tagId: 'RAW_TAG', // Placeholder
            rawData: payload,
        };

        // --- Page 4 (0x04) ---
        // ID Tiger Tag (4 bytes)
        data.tigerTagVersion = readUInt32BE(payload, 0);

        // --- Page 5 (0x05) ---
        // ID Product (4 bytes)
        data.productId = readUInt32BE(payload, 4);

        // --- Page 6 (0x06) ---
        // ID Material (2 bytes)
        data.materialId = readUInt16BE(payload, 8);
        // ID Aspect 1 (1 byte)
        data.aspectId1 = payload[10];
        // ID Aspect 2 (1 byte)
        data.aspectId2 = payload[11];

        // --- Page 7 (0x07) ---
        // ID Type (1 byte)
        data.typeId = payload[12];
        // ID Diameter (1 byte)
        data.diameter = payload[13];
        // ID Brand (2 bytes)
        data.brandId = readUInt16BE(payload, 14);

        // --- Page 8 (0x08) ---
        // Color 1 (RRGGBBAA) (4 bytes)
        // Convert [RR, GG, BB, AA] to Hex String
        const r = payload[16].toString(16).padStart(2, '0');
        const g = payload[17].toString(16).padStart(2, '0');
        const b = payload[18].toString(16).padStart(2, '0');
        const a = payload[19].toString(16).padStart(2, '0');
        data.colorHex = `#${r}${g}${b}${a}`;

        // --- Page 9 (0x09) ---
        // Measure (2 bytes)
        data.measure = readUInt16BE(payload, 20);

        // --- Page 10 (0x0A) ---
        // Nozzle Temp Min (2 bytes)
        data.nozzleTempMin = readUInt16BE(payload, 24);
        // Nozzle Temp Max (2 bytes)
        data.nozzleTempMax = readUInt16BE(payload, 26);

        // --- Page 11 (0x0B) ---
        // Dry Temp (1 byte)
        data.dryTemp = payload[28];
        // Dry Time (1 byte)
        data.dryTime = payload[29];
        // Bed Temp Min (1 byte)
        data.bedTempMin = payload[30];
        // Bed Temp Max (1 byte)
        data.bedTempMax = payload[31];

        return data;
    } catch (error) {
        console.error('Failed to parse Raw TigerTag:', error);
        return null;
    }
}

// Helper functions for big-endian byte operations
function readUInt16BE(buffer: number[], offset: number): number {
    return (buffer[offset] << 8) | buffer[offset + 1];
}

function readUInt32BE(buffer: number[], offset: number): number {
    return (
        (buffer[offset] << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8) |
        buffer[offset + 3]
    );
}

/**
 * Check if tag data appears to be TigerTag format based on known versions
 */
export function isTigerTag(buffer: number[]): boolean {
    if (!buffer || buffer.length < 4) return false;

    // Check for known TigerTag version IDs at the start (Page 4)
    const version = readUInt32BE(buffer, 0);
    const knownVersions = [
        1816240865, // TigerTag Init
        1542820452, // TigerTag V1.0
        315515176,  // TigerTag+ V1.0
    ];

    return knownVersions.includes(version);
}
