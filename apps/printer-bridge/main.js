const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron'); // Added ipcMain
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const BambuClient = require('./bambu');
const BambuFTP = require('./bambu-ftp');

let mainWindow;
let tray;
let wss;
const printers = {}; // Store active printer clients

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
        autoHideMenuBar: false
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('close', () => { app.quit(); });
}

// Helpers
const configPath = app.isPackaged
    ? path.join(path.dirname(process.execPath), 'printers.json')
    : path.join(__dirname, 'printers.json');

function startBridge() {
    const WS_PORT = 9000;
    const broadcast = (data) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bridge-event', data);
        if (wss && wss.clients) {
            wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data)); });
        }
    };

    const OctoprintClient = require('./octoprint');
    const MoonrakerClient = require('./moonraker');

    // ... inside startBridge ...

    function addPrinter(config) {
        if (printers[config.serial]) return; // Avoid dupes

        let client;
        if (config.type === 'bambu') client = new BambuClient(config);
        else if (config.type === 'octoprint') {
            config.apiKey = config.accessCode; // Map access code to API Key
            client = new OctoprintClient(config);
        }
        else if (config.type === 'moonraker' || config.type === 'creality') client = new MoonrakerClient(config);

        if (client) {
            printers[config.serial] = client;

            client.on('status', (s) => broadcast({ type: 'printer_status', serial: config.serial, status: s.status }));
            client.on('data', (d) => broadcast({ type: 'printer_data', serial: config.serial, data: d }));
            client.on('error', (e) => broadcast({ type: 'log', message: `[${config.serial}] Error: ${e.message}` }));

            client.connect();
            setTimeout(() => broadcast({ type: 'printer_added', config }), 500);
        }
    }

    function savePrinters() {
        try {
            const data = Object.values(printers).map(p => p.config);
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('Failed to save printers', e);
        }
    }

    function loadPrinters() {
        try {
            if (fs.existsSync(configPath)) {
                const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (Array.isArray(data)) {
                    data.forEach(config => {
                        if (!printers[config.serial]) addPrinter(config);
                    });
                    console.log(`[System] Loaded ${data.length} printers from ${configPath}`);
                }
            }
        } catch (e) {
            console.error('Failed to load printers', e);
        }
    }

    // Shared Download Logic
    async function performDownload(serial, filename) {
        const client = printers[serial];
        if (!client) throw new Error('Printer not found');

        broadcast({ type: 'log', message: `[${serial}] Downloading ${filename}...` });

        const downloadDir = app.isPackaged
            ? path.join(path.dirname(process.execPath), 'downloads')
            : path.join(__dirname, 'downloads');

        // Ensure dir exists
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        // Use printer-specific download method if available
        let filePath;
        if (typeof client.downloadFile === 'function') {
            filePath = await client.downloadFile(filename, downloadDir);
        } else {
            // Fallback for older or other types that might use BambuFTP pattern
            const logger = (msg) => broadcast({ type: 'log', message: `[${serial}] ${msg}` });
            const ftp = new BambuFTP(client.config, logger);
            filePath = await ftp.downloadFile(filename, downloadDir);
        }

        broadcast({ type: 'log', message: `[${serial}] Downloaded to ${filePath}` });
        return filePath;
    }

    const http = require('http');

    try {
        const server = http.createServer((req, res) => {
            // CORS
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            console.log(`[HTTP] Request: ${req.url}`);

            if (req.url.startsWith('/downloads/')) {
                const filename = decodeURIComponent(req.url.replace('/downloads/', ''));
                const downloadDir = app.isPackaged
                    ? path.join(path.dirname(process.execPath), 'downloads')
                    : path.join(__dirname, 'downloads');
                const filePath = path.join(downloadDir, filename);

                if (fs.existsSync(filePath)) {
                    res.writeHead(200, {
                        'Content-Type': 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${filename}"`
                    });
                    const stream = fs.createReadStream(filePath);
                    stream.on('error', (err) => {
                        console.error('Stream Error:', err);
                        if (!res.headersSent) res.writeHead(500);
                        res.end('Stream Error');
                    });
                    stream.pipe(res);
                } else {
                    res.writeHead(404);
                    res.end('File not found');
                }
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        wss = new WebSocket.Server({ server });
        wss.on('connection', ws => {
            ws.send(JSON.stringify({ type: 'status', message: 'Connected to Printer Bridge' }));
            broadcast({ type: 'log', message: 'Client connected via WebSocket' });

            Object.values(printers).forEach(p => {
                ws.send(JSON.stringify({ type: 'printer_status', serial: p.config.serial, status: p.status }));
                if (p.lastEvent) ws.send(JSON.stringify({ type: 'printer_data', serial: p.config.serial, data: p.lastEvent }));
            });

            // Handle incoming messages from Web App
            ws.on('message', async (message) => {
                console.log('[WS] Received raw:', message.toString());
                try {
                    const msg = JSON.parse(message);
                    if (msg.type === 'download_file') {
                        try {
                            await performDownload(msg.serial, msg.filename);
                            ws.send(JSON.stringify({ type: 'download_finished', filename: msg.filename, serial: msg.serial }));
                        } catch (err) {
                            ws.send(JSON.stringify({ type: 'download_error', message: err.message }));
                            broadcast({ type: 'log', message: `[${msg.serial}] Download Failed: ${err.message}` });
                        }
                    }
                } catch (err) {
                    console.error('WS Message error', err);
                }
            });
        });

        server.listen(WS_PORT, () => {
            console.log(`Bridge (HTTP+WS) started on port ${WS_PORT}`);
        });

    } catch (e) {
        console.error(e);
    }

    // Printer Management
    ipcMain.on('add-printer', (event, config) => {
        if (printers[config.serial]) return;
        addPrinter(config);
        savePrinters();
    });

    ipcMain.on('remove-printer', (e, serial) => {
        if (printers[serial]) {
            printers[serial].disconnect();
            delete printers[serial];
            savePrinters();
            broadcast({ type: 'printer_removed', serial });
        }
    });

    ipcMain.on('download-gcode', async (e, { serial, filename }) => {
        try {
            const filePath = await performDownload(serial, filename);
            // Optionally open the folder
            const { shell } = require('electron');
            shell.showItemInFolder(filePath);
        } catch (err) {
            broadcast({ type: 'log', message: `[${serial}] Download Failed: ${err.message}` });
        }
    });

    // Global Error Handlers
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection:', reason);
    });

    // Load printers on start
    setTimeout(loadPrinters, 1000);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); } else {
    app.on('second-instance', () => { if (mainWindow) { mainWindow.restore(); mainWindow.show(); } });
    app.whenReady().then(() => {
        createWindow(); startBridge();
    });
}
