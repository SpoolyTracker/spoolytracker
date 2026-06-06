const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const BambuClient = require('./bambu');

// Configuration
const WS_PORT = 9000;
const printers = {};

// Load config from printers.json if exists
const configPath = path.join(process.cwd(), 'printers.json');
if (fs.existsSync(configPath)) {
    try {
        const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (Array.isArray(saved)) {
            saved.forEach(addPrinter);
        }
    } catch (e) { console.error('Failed to load printers.json', e); }
}

const BambuFTP = require('./bambu-ftp');

const http = require('http');

// Shared Download Logic
async function performDownload(serial, filename) {
    if (!printers[serial]) throw new Error('Printer not found');

    broadcast({ type: 'log', message: `[${serial}] Downloading ${filename}...` });

    const logger = (msg) => broadcast({ type: 'log', message: `[${serial}] ${msg}` });
    const ftp = new BambuFTP(printers[serial].config, logger);
    const downloadDir = path.join(__dirname, 'downloads');

    // Ensure dir exists
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    const filePath = await ftp.downloadFile(filename, downloadDir);
    broadcast({ type: 'log', message: `[${serial}] Downloaded to ${filePath}` });
    return filePath;
}

// HTTP Server for File Serving
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
            const downloadDir = path.join(__dirname, 'downloads');
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

    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });

    server.listen(WS_PORT, () => {
        console.log(`[Bridge] Server (HTTP+WS) started on port ${WS_PORT}`);
    });

} catch (e) {
    console.error(e);
}

// Update WS Connection Logic to handle download messages
wss.on('connection', ws => {
    console.log('[WS] Client connected');
    ws.send(JSON.stringify({ type: 'status', message: 'Connected to Printer Bridge (Headless)' }));

    // Send current statuses
    Object.values(printers).forEach(p => {
        ws.send(JSON.stringify({ type: 'printer_status', serial: p.config.serial, status: p.status }));
        if (p.lastEvent) ws.send(JSON.stringify({ type: 'printer_data', serial: p.config.serial, data: p.lastEvent }));
    });

    // Handle incoming commands
    const OctoprintClient = require('./octoprint');
    const MoonrakerClient = require('./moonraker');

    // ... 

    // Helper embedded in scope to access printers/broadcast
    function addPrinter(config) {
        if (printers[config.serial]) return;

        console.log(`[System] Adding Printer: ${config.serial} (${config.type})`);
        let client;

        if (config.type === 'bambu') client = new BambuClient(config);
        else if (config.type === 'octoprint') client = new OctoprintClient(config);
        else if (config.type === 'moonraker' || config.type === 'creality') client = new MoonrakerClient(config);

        if (client) {
            printers[config.serial] = client;
            client.on('status', (s) => broadcast({ type: 'printer_status', serial: config.serial, status: s.status }));
            client.on('data', (d) => broadcast({ type: 'printer_data', serial: config.serial, data: d }));
            client.on('error', (e) => broadcast({ type: 'log', message: `[${config.serial}] Error: ${e.message}` }));
            client.connect();
        }
    }

    ws.on('message', async (message) => {
        try {
            const msg = JSON.parse(message);

            if (msg.command === 'add-printer') {
                addPrinter(msg.config);
            } else if (msg.type === 'download_file') {
                try {
                    await performDownload(msg.serial, msg.filename);
                    ws.send(JSON.stringify({ type: 'download_finished', filename: msg.filename, serial: msg.serial }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'download_error', message: err.message }));
                    broadcast({ type: 'log', message: `[${msg.serial}] Download Failed: ${err.message}` });
                }
            }
        } catch (e) { console.error('WS Command Error', e); }
    });
});

