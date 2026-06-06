
const { NFC } = require('nfc-pcsc');
const WebSocket = require('ws');

// Configuration
const WS_PORT = 8999;

// Init WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`[WS] Server started on port ${WS_PORT}`);

// Broadcast helper
const broadcast = (data) => {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
};

wss.on('connection', ws => {
    console.log('[WS] Client connected');
    ws.send(JSON.stringify({ type: 'status', message: 'Connected to NFC Bridge' }));
});

// Init NFC
const nfc = new NFC();

nfc.on('reader', reader => {
    console.log(`[NFC] Reader detected: ${reader.reader.name}`);
    broadcast({ type: 'reader_attached', name: reader.reader.name });

    reader.on('card', card => {
        console.log(`[NFC] Card detected`, card);
        // Card object usually has 'uid' (buffer)
        // We want hex string
        const uid = card.uid; // Format depends on lib version, usually hex string in newer wrappers or buffer?
        // nfc-pcsc returns standard UID as hex string usually if configured, or we convert.
        // Documentation says card.uid is standard.
        broadcast({
            type: 'tag_read',
            uid: card.uid,
            atr: card.atr,
            standard: card.standard
        });
    });

    reader.on('card.off', card => {
        console.log(`[NFC] Card removed`, card);
    });

    reader.on('error', err => {
        console.error(`[NFC] Reader error`, err);
        broadcast({ type: 'error', message: err.message });
    });

    reader.on('end', () => {
        console.log(`[NFC] Reader removed`);
        broadcast({ type: 'reader_removed', name: reader.reader.name });
    });
});

nfc.on('error', err => {
    console.error(`[NFC] General error`, err);
});
