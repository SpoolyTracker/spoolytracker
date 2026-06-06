const WebSocket = require('ws');
const EventEmitter = require('events');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

class MoonrakerClient extends EventEmitter {
    constructor(config) {
        super();
        const ip = (config.ip || '').trim().replace(/^(https?:\/\/)/, '').replace(/\/+$/, '');
        this.config = { ...config, ip };
        this.status = 'disconnected';
        this.ws = null;
        this.reqId = 0;
        this.requests = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // Moonraker defaults
        this.port = config.port || 7125;
        this.baseUrl = `http://${ip}:${this.port}`;
    }

    connect() {
        if (this.ws) return;

        const url = `ws://${this.config.ip}:${this.port}/websocket`;
        console.log(`[Moonraker] Connecting to ${url}...`);
        this.updateStatus('connecting');

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log(`[Moonraker] Connected to ${this.config.name}`);
            this.reconnectAttempts = 0;
            this.updateStatus('connected');
            this.initSubscription();
        });

        this.ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                this.handleMessage(msg);
            } catch (e) { console.error('[Moonraker] Parse error', e); }
        });

        this.ws.on('close', () => {
            console.log('[Moonraker] Disconnected');
            this.ws = null;
            this.updateStatus('disconnected');

            this.reconnectAttempts++;
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                console.log(`[Moonraker] Reconnecting to ${this.config.serial} (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                setTimeout(() => this.connect(), 5000);
            } else {
                console.error(`[Moonraker] Max reconnect attempts reached for ${this.config.serial}.`);
                this.updateStatus('error');
            }
        });

        this.ws.on('error', (e) => {
            console.error('[Moonraker] Error', e.message);
            this.ws.close();
        });
    }

    send(method, params = {}) {
        if (!this.ws) return;
        const id = ++this.reqId;
        const payload = { jsonrpc: "2.0", method, params, id };
        this.ws.send(JSON.stringify(payload));
        return id;
    }

    initSubscription() {
        // Subscribe to objects
        this.send("printer.objects.subscribe", {
            objects: {
                print_stats: null,
                display_status: null,
                heater_bed: null,
                extruder: null,
                toolhead: null,
                virtual_sdcard: null
            }
        });

        // Initial query
        this.send("printer.objects.query", {
            objects: {
                print_stats: null,
                display_status: null,
                heater_bed: null,
                extruder: null,
                toolhead: null,
                virtual_sdcard: null
            }
        });
    }

    handleMessage(msg) {
        // Handle subscriptions and query results
        if (msg.method === 'notify_status_update' || (msg.result && msg.result.status)) {
            const data = msg.params ? msg.params[0] : msg.result.status;
            this.processData(data);
        }
    }

    processData(data) {
        // We need to maintain state locally because updates are partial
        this.state = { ...(this.state || {}), ...data };

        // Extract standard fields
        const stats = this.state.print_stats || {};
        const bed = this.state.heater_bed || {};
        const extruder = this.state.extruder || {};
        const sd = this.state.virtual_sdcard || {};

        let stdState = 'IDLE';
        if (stats.state === 'printing') stdState = 'RUNNING';
        if (stats.state === 'paused') stdState = 'PAUSE';
        if (stats.state === 'error') stdState = 'OFFLINE';

        const event = {
            serial: this.config.serial,
            name: this.config.name || this.config.serial,
            type: 'moonraker',
            status: {
                state: stdState,
                progress: this.state.display_status ? Math.round(this.state.display_status.progress * 100) : 0,
                // Time left approx
                timeLeft: (stats.print_duration && this.state.display_status && this.state.display_status.progress > 0)
                    ? (stats.print_duration / this.state.display_status.progress) - stats.print_duration
                    : 0,
                bedTemp: bed.temperature || 0,
                targetBedTemp: bed.target || 0,
                nozzleTemp: extruder.temperature || 0,
                targetNozzleTemp: extruder.target || 0,
                file: stats.filename,
                jobId: stats.filename + '_' + stats.total_duration,
                speed: '100%', // Gcode Factor?
                layer: 0,
                totalLayers: 0
            }
        };

        this.emit('data', event);
        this.emit('status', { serial: this.config.serial, status: this.status });
    }

    updateStatus(s) {
        this.status = s;
        this.emit('status', { serial: this.config.serial, status: s });
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }

    async downloadFile(filename, downloadDir) {
        console.log(`[Moonraker] Downloading ${filename}`);
        // Moonraker: /server/files/gcodes/{filename}

        try {
            const url = `${this.baseUrl}/server/files/gcodes/${encodeURIComponent(filename)}`;

            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream'
            });

            const destPath = path.join(downloadDir, filename);
            const writer = fs.createWriteStream(destPath);

            await pipeline(response.data, writer);
            return destPath;
        } catch (e) {
            throw new Error(`Moonraker Download Failed: ${e.message}`);
        }
    }
}

module.exports = MoonrakerClient;
