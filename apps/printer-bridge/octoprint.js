const axios = require('axios');
const WebSocket = require('ws');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

class OctoprintClient extends EventEmitter {
    constructor(config) {
        super();
        let ip = (config.ip || '').trim();
        ip = ip.replace(/^(https?:\/\/)/, '').replace(/\/+$/, '');
        this.config = { ...config, ip };

        this.status = 'disconnected';
        this.ws = null;
        this.httpClient = axios.create({
            baseURL: `http://${ip}${config.port ? ':' + config.port : ''}/api`,
            headers: { 'X-Api-Key': config.apiKey },
            timeout: 5000
        });

        this.pollingInterval = null;
    }

    async connect() {
        if (this.status === 'connected') return;

        console.log(`[Octoprint] Connecting to ${this.config.name || this.config.serial}...`);
        this.updateStatus('connecting');

        try {
            // Test connection
            await this.httpClient.get('/version');
            this.updateStatus('connected');

            // Start Polling (Simpler than WS for now, or fallback)
            // Octoprint has a socket, but polling /api/printer is very standard.
            // Let's use WebSocket for real-time pushing if possible, but polling is robust.
            // URL: /sockjs/websocket

            this.connectWebSocket();

        } catch (e) {
            console.error(`[Octoprint] Connection failed for ${this.config.name}: ${e.message}`);
            this.updateStatus('error');
            // Stopped auto-retry to avoid infinite loops if config is wrong or device is off
        }
    }

    connectWebSocket() {
        // Octoprint uses SockJS, which is a bit complex for raw WS. 
        // Standard WS URL: ws://host:port/sockjs/websocket
        const url = `ws://${this.config.ip}${this.config.port ? ':' + this.config.port : ''}/sockjs/websocket`;

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log('[Octoprint] WS Connected');
            // Subscribe? Octoprint pushes by default usually?
        });

        this.ws.on('message', (data) => {
            // Handle SockJS heartbeat/data
            // This might be overkill. 
            // Let's stick to polling /api/printer every 2s, it's very light.
        });

        // Let's use Polling for reliability and simplicity for now.
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => this.pollStatus(), 2000);
        this.pollStatus(); // Immediate
    }

    async pollStatus() {
        try {
            let res;
            try {
                res = await this.httpClient.get('/printer');
            } catch (e) {
                // If the printer is not operational, OctoPrint might return 409
                // We still want to try fetching the job data
                console.warn(`[Octoprint] /printer call failed: ${e.message}`);
                res = { data: { state: { text: 'OFFLINE' }, temperature: {} } };
            }

            let jobRes;
            try {
                jobRes = await this.httpClient.get('/job');
            } catch (e) {
                console.warn(`[Octoprint] /job call failed: ${e.message}`);
                jobRes = { data: { job: { file: {} }, progress: {} } };
            }

            const state = (res.data.state?.text || 'OFFLINE').toUpperCase();
            const temps = res.data.temperature || {};
            const job = jobRes.data.job || { file: {} };
            const progress = jobRes.data.progress || {};

            // Map Octoprint state to our standard
            let stdState = 'IDLE';
            if (state.includes('PRINTING')) stdState = 'RUNNING';
            else if (state.includes('PAUSE')) stdState = 'PAUSE';
            else if (state.includes('OFFLINE')) stdState = 'OFFLINE';
            else if (state.includes('CONNECT')) stdState = 'CONNECTING';
            // etc

            const event = {
                serial: this.config.serial,
                name: this.config.name || this.config.serial,
                type: 'octoprint',
                status: {
                    state: stdState,
                    progress: progress.completion ? Math.round(progress.completion) : 0,
                    timeLeft: progress.printTimeLeft || 0,
                    bedTemp: temps.bed ? temps.bed.actual : 0,
                    targetBedTemp: temps.bed ? temps.bed.target : 0,
                    nozzleTemp: temps.tool0 ? temps.tool0.actual : 0,
                    targetNozzleTemp: temps.tool0 ? temps.tool0.target : 0,
                    file: job.file.name,
                    jobId: job.file.name + '_' + (progress.printTime || 0), // Approx unique
                    layer: 0,
                    totalLayers: 0,
                    speed: '100%',
                    filamentLength: job.filament?.tool0?.length ? job.filament.tool0.length / 1000 : 0, // Length in meters
                    filamentVolume: job.filament?.tool0?.volume || 0 // Volume in cm3
                }
            };

            this.emit('data', event);
            this.emit('status', { serial: this.config.serial, status: this.status });

        } catch (e) {
            console.error(`[Octoprint] Poll Error for ${this.config.name}:`, e.message);
            this.updateStatus('error');
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
        }
    }

    updateStatus(s) {
        this.status = s;
        this.emit('status', { serial: this.config.serial, status: s });
    }

    disconnect() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (this.ws) this.ws.close();
        this.updateStatus('disconnected');
    }

    async downloadFile(filename, downloadDir) {
        // Octoprint stores files in 'local' and 'sdcard'. Usually local.
        // API: /api/files/local/filename
        // Note: filename passed from status is usually simple name.
        // We might need to find the full path if it's in a folder.

        console.log(`[Octoprint] Downloading ${filename}`);

        // 1. Find file to get download link
        // Quick hack: assume it's in root local
        // Better: recursive search or use the link from 'job' if available?
        // job.file.path is available in status.

        // But the requester passes 'filename'.

        try {
            // Try fetching directly from local origin
            // /downloads/files/local/filename
            const url = `http://${this.config.ip}${this.config.port ? ':' + this.config.port : ''}/downloads/files/local/${filename}`;

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers: { 'X-Api-Key': this.config.apiKey }
            });

            const destPath = path.join(downloadDir, filename);
            const writer = fs.createWriteStream(destPath);

            await pipeline(response.data, writer);

            return destPath;
        } catch (e) {
            throw new Error(`Octoprint Download Failed: ${e.message}`);
        }
    }
}

module.exports = OctoprintClient;
