const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const BambuClient = require('../bambu');
const BambuFTP = require('../bambu-ftp');
const OctoprintClient = require('../octoprint');
const MoonrakerClient = require('../moonraker');

function startPrinterServer(port = 9000) {
    const printers = {};
    const wss = new WebSocket.Server({ noServer: true });

    const broadcast = (data) => {
        const msg = JSON.stringify(data);
        wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
    };

    function addPrinter(config) {
        if (printers[config.serial]) return;
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

    async function performDownload(serial, filename) {
        if (!printers[serial]) throw new Error('Printer not found');
        const logger = (msg) => broadcast({ type: 'log', message: `[${serial}] ${msg}` });
        const ftp = new BambuFTP(printers[serial].config, logger);
        const downloadDir = path.join(__dirname, '..', 'downloads');
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
        return ftp.downloadFile(filename, downloadDir);
    }

    // Load saved printers
    const configPath = path.join(process.cwd(), 'printers.json');
    if (fs.existsSync(configPath)) {
        try {
            const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (Array.isArray(saved)) saved.forEach(addPrinter);
        } catch (e) { console.error('Failed to load printers.json', e); }
    }

    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.url.startsWith('/downloads/')) {
            const filename = decodeURIComponent(req.url.replace('/downloads/', ''));
            const downloadsRoot = path.resolve(__dirname, '..', 'downloads');
            const filePath = path.resolve(downloadsRoot, filename);
            if (!filePath.startsWith(downloadsRoot)) { res.writeHead(403); res.end('Forbidden'); return; }
            if (fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${filename}"` });
                fs.createReadStream(filePath).pipe(res);
            } else { res.writeHead(404); res.end('File not found'); }
        } else { res.writeHead(404); res.end('Not found'); }
    });

    server.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    });

    wss.on('connection', ws => {
        ws.send(JSON.stringify({ type: 'status', message: 'Connected to Printer Bridge' }));
        Object.values(printers).forEach(p => {
            ws.send(JSON.stringify({ type: 'printer_status', serial: p.config.serial, status: p.status }));
            if (p.lastEvent) ws.send(JSON.stringify({ type: 'printer_data', serial: p.config.serial, data: p.lastEvent }));
        });
        ws.on('message', async (message) => {
            try {
                const msg = JSON.parse(message);
                if (msg.command === 'add-printer') addPrinter(msg.config);
                else if (msg.type === 'download_file') {
                    try {
                        await performDownload(msg.serial, msg.filename);
                        ws.send(JSON.stringify({ type: 'download_finished', filename: msg.filename, serial: msg.serial }));
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'download_error', message: err.message }));
                    }
                }
            } catch (e) { console.error('WS Command Error', e); }
        });
    });

    server.listen(port, () => console.log(`[Bridge] Printer server (HTTP+WS) on port ${port}`));

    return {
        close() {
            try { Object.values(printers).forEach(p => { try { p.disconnect?.(); } catch (_e) {} }); } catch (_e) {}
            try { wss.clients.forEach(c => c.terminate()); } catch (_e) {}
            try { server.close(); } catch (_e) {}
            try { wss.close(); } catch (_e) {}
        }
    };
}

module.exports = { startPrinterServer };
