const { NFC } = require('nfc-pcsc');
const WebSocket = require('ws');
const { readBambuRfidTag } = require('../bambu-rfid');

function cleanResponse(buffer) {
    if (buffer && buffer.length >= 2) {
        const sw1 = buffer[buffer.length - 2];
        const sw2 = buffer[buffer.length - 1];
        if (sw1 === 0x90 && sw2 === 0x00) return buffer.slice(0, buffer.length - 2);
    }
    return buffer || [];
}

function startNfcServer(port = 8999) {
    const wss = new WebSocket.Server({ port });
    console.log(`[WS] NFC server started on port ${port}`);

    const broadcast = (data) => {
        const msg = JSON.stringify(data);
        wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
    };

    wss.on('connection', ws => {
        console.log('[WS] Client connected');
        ws.send(JSON.stringify({ type: 'status', message: 'Connected to NFC Bridge' }));
    });

    let nfc = null;
    try {
        nfc = new NFC();
        console.log('[NFC] Service initialized');

        nfc.on('reader', reader => {
            console.log(`[NFC] Reader detected: ${reader.reader.name}`);
            broadcast({ type: 'reader_attached', name: reader.reader.name });

            // Disable auto processing to handle raw commands
            reader.autoProcessing = false;

            reader.on('card', async card => {
                console.log(`[NFC] Card detected`, card);
                const atr = card.atr ? card.atr.toString('hex') : 'null';
                broadcast({ type: 'log', message: `Card Detected. ATR=${atr}` });

                let finalUid = card.uid;
                let rawData = [];

                try {
                    // 1. GET UID
                    if (!finalUid) {
                        try {
                            const cmd = Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]);
                            const res = await reader.transmit(cmd, 40);
                            const clean = cleanResponse(res);
                            if (clean.length > 0) {
                                finalUid = clean.toString('hex').toUpperCase();
                                console.log(`[NFC] UID Found: ${finalUid}`);
                                broadcast({ type: 'log', message: `UID Found: ${finalUid}` });
                            }
                        } catch (e) {
                            broadcast({ type: 'log', message: 'UID Read Error' });
                        }
                    }

                    if (!finalUid) {
                        broadcast({ type: 'error', message: 'Could not read UID. Aborting memory read.' });
                        return;
                    }

                    try {
                        broadcast({ type: 'log', message: 'Trying Bambu Lab RFID read...' });
                        const bambu = await readBambuRfidTag(reader, finalUid);
                        broadcast({ type: 'log', message: `Bambu Lab RFID detected: ${bambu.materialId || 'unknown material'}` });
                        broadcast({
                            type: 'tag_read',
                            uid: bambu.tagId,
                            atr: atr,
                            source: 'bambu',
                            bambu
                        });
                        return;
                    } catch (e) {
                        const msg = `Not a readable Bambu RFID tag (${e.message}). Trying TigerTag...`;
                        console.log(msg);
                        broadcast({ type: 'log', message: msg });
                    }

                    // 2. STABILITY DELAY
                    broadcast({ type: 'log', message: 'Stabilizing connection (300ms)...' });
                    await new Promise(r => setTimeout(r, 300));

                    // 3. READ MEMORY via WRAPPER (Proven to work)
                    broadcast({ type: 'log', message: 'Reading TigerTag Data...' });

                    let p4Success = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            // Tag 4 NTAG21x READ command header
                            const cmd = Buffer.from([0xFF, 0x00, 0x00, 0x00, 0x05, 0xD4, 0x40, 0x01, 0x30, 0x04]);
                            const res = await reader.transmit(cmd, 40);

                            // Check for Success Prefix D5 41 00
                            if (res.length >= 19 && res[0] === 0xD5 && res[1] === 0x41 && res[2] === 0x00) {
                                const dataPart = res.slice(3, 19);
                                rawData.push(...dataPart);
                                p4Success = true;
                                break; // Success!
                            } else {
                                const msg = `P4 Attempt ${attempt} failed (Len ${res.length}). Retrying...`;
                                console.log(msg);
                                broadcast({ type: 'log', message: msg });
                                await new Promise(r => setTimeout(r, 100)); // Retry delay
                            }
                        } catch (e) {
                            const msg = `P4 Attempt ${attempt} error: ${e.message}`;
                            console.log(msg);
                            broadcast({ type: 'log', message: msg });
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }

                    if (p4Success) {
                        broadcast({ type: 'log', message: 'Header Read Success! Reading rest...' });
                        // Read remaining pages P8 to P36
                        for (let p = 8; p <= 36; p += 4) {
                            try {
                                const cmd = Buffer.from([0xFF, 0x00, 0x00, 0x00, 0x05, 0xD4, 0x40, 0x01, 0x30, p]);
                                const res = await reader.transmit(cmd, 40);
                                if (res.length >= 19 && res[0] === 0xD5 && res[1] === 0x41 && res[2] === 0x00) {
                                    rawData.push(...res.slice(3, 19));
                                }
                            } catch (e) { break; }
                        }
                    } else {
                        broadcast({ type: 'error', message: 'Critical: Could not read TigerTag Header after 3 attempts.' });
                    }

                    if (rawData.length > 0) {
                        broadcast({ type: 'log', message: `Total: ${rawData.length} bytes recovered.` });
                        if (rawData.length >= 4) {
                            const header = Buffer.from(rawData.slice(0, 4)).toString('hex').toUpperCase();
                            if (header === '5BF59264') {
                                broadcast({ type: 'log', message: 'TigerTag V1.0 Header Confirmed!' });
                            }
                        }
                    }

                } catch (e) {
                    console.error(e);
                    broadcast({ type: 'error', message: `Fatal: ${e.message}` });
                }

                broadcast({
                    type: 'tag_read',
                    uid: finalUid || 'UNKNOWN',
                    atr: atr,
                    data: rawData.length > 0 ? rawData : null
                });
            });

            reader.on('end', () => {
                console.log(`[NFC] Reader removed`);
                broadcast({ type: 'reader_removed', name: reader.reader.name });
            });

            reader.on('error', err => {
                console.error(`[NFC] Reader error`, err);
                broadcast({ type: 'error', message: err.message });
            });
        });

        nfc.on('error', err => {
            console.error(`[NFC] General error`, err);
        });

    } catch (e) {
        console.error('Failed to init NFC', e);
    }

    return {
        close() {
            try { wss.clients.forEach(c => c.terminate()); } catch (_e) {}
            try { wss.close(); } catch (_e) {}
            try { if (nfc && nfc.close) nfc.close(); } catch (_e) {}
        }
    };
}

module.exports = { startNfcServer };
