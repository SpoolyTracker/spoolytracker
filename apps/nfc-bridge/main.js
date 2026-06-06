
const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const { NFC } = require('nfc-pcsc');
const WebSocket = require('ws');

let mainWindow;
let tray;
let nfc;
let wss;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
        autoHideMenuBar: false
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('close', () => { app.quit(); });
}

function startBridge() {
    const WS_PORT = 8999;
    const broadcast = (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('nfc-event', data);
        if (wss && wss.clients) {
            wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data)); });
        }
    };

    try {
        wss = new WebSocket.Server({ port: WS_PORT });
        wss.on('connection', ws => ws.send(JSON.stringify({ type: 'status', message: 'Connected' })));
    } catch (e) { console.error(e); }

    try {
        nfc = new NFC();
        nfc.on('reader', reader => {
            console.log('Reader:', reader.reader.name);
            broadcast({ type: 'reader_attached', name: reader.reader.name });
            reader.autoProcessing = false;

            reader.on('card', async card => {
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
                                broadcast({ type: 'log', message: `UID Found: ${finalUid}` });
                            }
                        } catch (e) { broadcast({ type: 'log', message: 'UID Read Error' }); }
                    }

                    if (!finalUid) {
                        broadcast({ type: 'error', message: 'Could not read UID. Aborting memory read.' });
                        return;
                    }

                    // 2. STABILITY DELAY (The Probe succeeded because it was slow)
                    broadcast({ type: 'log', message: 'Stabilizing connection (300ms)...' });
                    await new Promise(r => setTimeout(r, 300));

                    // 3. READ MEMORY via WRAPPER (Proven to work)
                    // We implement a RETRY on Page 4 because if that fails, everything fails.

                    broadcast({ type: 'log', message: 'Reading TigerTag Data...' });

                    let p4Success = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            const cmd = Buffer.from([0xFF, 0x00, 0x00, 0x00, 0x05, 0xD4, 0x40, 0x01, 0x30, 0x04]);
                            const res = await reader.transmit(cmd, 40);

                            // Check for Success Prefix D5 41 00
                            if (res.length >= 19 && res[0] === 0xD5 && res[1] === 0x41 && res[2] === 0x00) {
                                const dataPart = res.slice(3, 19);
                                rawData.push(...dataPart);
                                p4Success = true;
                                break; // Success!
                            } else {
                                broadcast({ type: 'log', message: `P4 Attempt ${attempt} failed (Len ${res.length}). Retrying...` });
                                await new Promise(r => setTimeout(r, 100)); // Retry delay
                            }
                        } catch (e) {
                            broadcast({ type: 'log', message: `P4 Attempt ${attempt} error: ${e.message}` });
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
                    broadcast({ type: 'error', message: `Fatal: ${e.message}` });
                }

                broadcast({
                    type: 'tag_read',
                    uid: finalUid || 'UNKNOWN',
                    atr: atr,
                    data: rawData.length > 0 ? rawData : null
                });
            });

            reader.on('end', () => broadcast({ type: 'reader_removed', name: reader.reader.name }));
            reader.on('error', err => broadcast({ type: 'error', message: err.message }));
        });
        nfc.on('error', err => broadcast({ type: 'error', message: err.message }));
    } catch (e) { broadcast({ type: 'error', message: e.message }); }

    function cleanResponse(buffer) {
        if (buffer && buffer.length >= 2) {
            const sw1 = buffer[buffer.length - 2];
            const sw2 = buffer[buffer.length - 1];
            if (sw1 === 0x90 && sw2 === 0x00) return buffer.slice(0, buffer.length - 2);
        }
        return buffer || [];
    }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); } else {
    app.on('second-instance', () => { if (mainWindow) { mainWindow.restore(); mainWindow.show(); } });
    app.whenReady().then(() => {
        createWindow(); startBridge();
        tray = new Tray(path.join(__dirname, 'icon.png'));
        const contextMenu = Menu.buildFromTemplate([{ label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }]);
        tray.setContextMenu(contextMenu);
        tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());
    });
}
