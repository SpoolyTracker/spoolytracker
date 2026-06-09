const { KEY_TYPE_A } = require('nfc-pcsc');

const BAMBU_MASTER_KEY = [
    0x9a, 0x75, 0x9c, 0xf2, 0xc4, 0xf7, 0xca, 0xff,
    0x22, 0x2c, 0xb9, 0x76, 0x9b, 0x41, 0xbc, 0x96,
];

const BAMBU_KEY_INFO = asciiBytes('RFID-A\0');
const BAMBU_BLOCKS_TO_READ = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17];

async function readBambuRfidTag(reader, uid) {
    const uidBytes = normalizeUidBytes(uid);
    if (!uidBytes.length) throw new Error('Unable to read Bambu tag UID.');

    try {
        return await readBambuRfidTagWithUid(reader, uidBytes, uidBytes);
    } catch (error) {
        if (uidBytes.length === 4) {
            try {
                return await readBambuRfidTagWithUid(reader, [...uidBytes].reverse(), uidBytes);
            } catch (reversedError) {
                throw new Error(`${error.message}; reversed UID failed: ${reversedError.message}`);
            }
        }
        throw error;
    }
}

async function readBambuRfidTagWithUid(reader, keyUidBytes, tagUidBytes) {
    const keys = deriveBambuKeys(keyUidBytes);
    const blocks = new Map();
    const authenticatedSectors = new Set();

    for (const blockIndex of BAMBU_BLOCKS_TO_READ) {
        const sector = Math.floor(blockIndex / 4);
        if (!authenticatedSectors.has(sector)) {
            await authenticateBlock(reader, blockIndex, Buffer.from(keys[sector]));
            authenticatedSectors.add(sector);
        }

        const data = await reader.read(blockIndex, 16, 16);
        blocks.set(blockIndex, Array.from(data));
    }

    return parseBambuBlocks(tagUidBytes, blocks);
}

async function authenticateBlock(reader, blockIndex, key) {
    try {
        await reader.authenticate(blockIndex, KEY_TYPE_A, key);
        return;
    } catch (error) {
        try {
            await reader.authenticate(blockIndex, KEY_TYPE_A, key, true);
        } catch (obsoleteError) {
            throw new Error(`Auth failed on block ${blockIndex}: ${error.message}; obsolete auth failed: ${obsoleteError.message}`);
        }
    }
}

function parseBambuBlocks(uidBytes, blocks) {
    const block = (index) => blocks.get(index) || [];
    const uidHex = bytesToHex(uidBytes);
    const block5 = block(5);
    const block6 = block(6);
    const block8 = block(8);
    const block10 = block(10);
    const block14 = block(14);
    const block16 = block(16);

    const colorHex = block5.length >= 4 ? `#${bytesToHex(block5.slice(0, 4))}` : undefined;
    const hasExtraColorInfo = block16.length >= 2 && block16[0] === 0x02 && block16[1] === 0x00;
    const secondColor = hasExtraColorInfo && block16.length >= 8 ? `#${bytesToHex(block16.slice(4, 8).reverse())}` : undefined;

    const rawBlocks = {};
    for (const [index, value] of blocks.entries()) {
        rawBlocks[index] = bytesToHex(value);
    }

    return {
        tagId: formatUid(uidBytes),
        uidHex,
        variantId: readAscii(block(1).slice(0, 8)),
        materialId: readAscii(block(1).slice(8, 16)),
        filamentType: readAscii(block(2)),
        detailedFilamentType: readAscii(block(4)),
        colorHex: secondColor ? `${colorHex} / ${secondColor}` : colorHex,
        spoolWeight: readUInt16LEOptional(block5, 4),
        filamentDiameter: readFloatLEOptional(block5, 8),
        dryingTemp: readUInt16LEOptional(block6, 0),
        dryingTime: readUInt16LEOptional(block6, 2),
        bedTemp: readUInt16LEOptional(block6, 6),
        nozzleTempMax: readUInt16LEOptional(block6, 8),
        nozzleTempMin: readUInt16LEOptional(block6, 10),
        nozzleDiameter: readFloatLEOptional(block8, 12),
        trayUid: readAscii(block(9)),
        productionDate: readAscii(block(12)),
        spoolWidth: readUInt16LEOptional(block10, 4, 100),
        filamentLength: readUInt16LEOptional(block14, 4),
        rawBlocks,
    };
}

function normalizeUidBytes(id) {
    if (Buffer.isBuffer(id)) return Array.from(id);
    if (Array.isArray(id)) return id.map(Number);
    if (typeof id === 'string') return hexToBytes(id);
    return [];
}

function deriveBambuKeys(uidBytes) {
    const keyBytes = hkdfSha256(uidBytes, BAMBU_MASTER_KEY, BAMBU_KEY_INFO, 16 * 6);
    const keys = [];
    for (let i = 0; i < 16; i++) {
        keys.push(keyBytes.slice(i * 6, i * 6 + 6));
    }
    return keys;
}

function hkdfSha256(ikm, salt, info, length) {
    const prk = hmacSha256(salt, ikm);
    const output = [];
    let previous = [];
    let counter = 1;

    while (output.length < length) {
        previous = hmacSha256(prk, [...previous, ...info, counter]);
        output.push(...previous);
        counter += 1;
    }

    return output.slice(0, length);
}

function hmacSha256(key, message) {
    const blockSize = 64;
    let normalizedKey = [...key];
    if (normalizedKey.length > blockSize) normalizedKey = sha256(normalizedKey);
    while (normalizedKey.length < blockSize) normalizedKey.push(0);

    const outer = normalizedKey.map(b => b ^ 0x5c);
    const inner = normalizedKey.map(b => b ^ 0x36);
    return sha256([...outer, ...sha256([...inner, ...message])]);
}

function sha256(message) {
    const bytes = [...message];
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    bytes.push(...uint32ToBytes(high), ...uint32ToBytes(low));

    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    for (let offset = 0; offset < bytes.length; offset += 64) {
        const w = new Array(64).fill(0);
        for (let i = 0; i < 16; i++) w[i] = bytesToUint32(bytes.slice(offset + i * 4, offset + i * 4 + 4));
        for (let i = 16; i < 64; i++) {
            const s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = add32(w[i - 16], s0, w[i - 7], s1);
        }

        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
            const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = add32(h, s1, ch, k[i], w[i]);
            const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = add32(s0, maj);
            h = g; g = f; f = e; e = add32(d, temp1); d = c; c = b; b = a; a = add32(temp1, temp2);
        }

        h0 = add32(h0, a); h1 = add32(h1, b); h2 = add32(h2, c); h3 = add32(h3, d);
        h4 = add32(h4, e); h5 = add32(h5, f); h6 = add32(h6, g); h7 = add32(h7, h);
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7].flatMap(uint32ToBytes);
}

function add32(...values) {
    return values.reduce((sum, value) => (sum + value) >>> 0, 0);
}

function rotateRight(value, shift) {
    return ((value >>> shift) | (value << (32 - shift))) >>> 0;
}

function bytesToUint32(bytes) {
    return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

function uint32ToBytes(value) {
    return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function readAscii(bytes) {
    return bytes.filter(b => b !== 0).map(b => String.fromCharCode(b)).join('').trim();
}

function readUInt16LEOptional(bytes, offset, divisor = 1) {
    if (bytes.length < offset + 2) return undefined;
    return (bytes[offset] | (bytes[offset + 1] << 8)) / divisor;
}

function readFloatLEOptional(bytes, offset) {
    if (bytes.length < offset + 4) return undefined;
    const buffer = Buffer.from(bytes.slice(offset, offset + 4));
    const value = buffer.readFloatLE(0);
    return Number.isFinite(value) ? value : undefined;
}

function bytesToHex(bytes) {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToBytes(hex) {
    const clean = hex.replace(/[^0-9a-f]/gi, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
    return bytes;
}

function formatUid(bytes) {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

function asciiBytes(value) {
    return value.split('').map(char => char.charCodeAt(0));
}

module.exports = {
    readBambuRfidTag,
    parseBambuBlocks,
};
