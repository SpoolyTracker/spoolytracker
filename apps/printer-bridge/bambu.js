const mqtt = require('mqtt');
const EventEmitter = require('events');

class BambuClient extends EventEmitter {
    constructor(config) {
        super();
        const ip = (config.ip || '').trim();
        this.config = { ...config, ip };
        this.client = null;
        this.status = 'disconnected';
        this.lastData = null; // Raw merged data
        this.lastEvent = null; // Structured event data for UI
        this.reconnectTimer = null;
    }

    connect() {
        if (this.client && (this.client.connected || this.client.reconnecting)) return;

        const port = this.config.port || 8883;
        const protocol = port === 1883 ? 'mqtt' : 'mqtts'; // Standard MQTT vs MQTTS (Bambu uses MQTTS/8883 usually)
        const url = `${protocol}://${this.config.ip}:${port}`;

        console.log(`[Bambu] Connecting to ${url} (${this.config.serial})...`);
        this.updateStatus('connecting');

        const options = {
            username: 'bblp', // Standard for LAN mode
            password: this.config.accessCode,
            rejectUnauthorized: false, // Required for self-signed certs (LAN)
            clientId: `spooly-${Math.random().toString(16).substr(2, 8)}`,
            keepalive: 30,
            reconnectPeriod: 10000,
            connectTimeout: 5000,
        };

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        try {
            this.client = mqtt.connect(url, options);

            this.client.on('connect', () => {
                console.log(`[Bambu] Connected to ${this.config.serial}`);
                reconnectAttempts = 0;
                this.updateStatus('connected');
                this.subscribe();
                this.requestFullStatus();
            });

            this.client.on('reconnect', () => {
                reconnectAttempts++;
                console.log(`[Bambu] Reconnecting to ${this.config.serial} (Attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
                if (reconnectAttempts > maxReconnectAttempts) {
                    console.error(`[Bambu] Max reconnect attempts reached for ${this.config.serial}. Stopping.`);
                    this.disconnect();
                    this.updateStatus('error');
                }
            });

            this.client.on('message', (topic, message) => {
                try {
                    // Debug logs
                    console.log(`[Bambu] Msg on ${topic}`);
                    const msgStr = message.toString();
                    // console.log(`[Bambu] Payload start: ${msgStr.substring(0, 50)}`);

                    const json = JSON.parse(msgStr);
                    this.handleMessage(json);
                } catch (e) {
                    console.error('[Bambu] Parse error', e);
                }
            });

            this.client.on('error', (err) => {
                console.error('[Bambu] MQTT Error', err.message);
                this.emit('error', err);
                // Status update handled by close/offline?
            });

            this.client.on('offline', () => {
                console.log('[Bambu] Offline');
                this.updateStatus('offline');
            });

            this.client.on('close', () => {
                console.log('[Bambu] Connection closed');
                // this.updateStatus('disconnected'); 
            });

        } catch (e) {
            this.emit('error', e);
            this.updateStatus('error');
        }
    }

    subscribe() {
        if (!this.client || !this.client.connected) return;
        const topic = `device/${this.config.serial}/report`;
        this.client.subscribe(topic, (err) => {
            if (!err) console.log(`[Bambu] Subscribed to ${topic}`);
            else console.error(`[Bambu] Subscribe error`, err);
        });
    }

    requestFullStatus() {
        if (!this.client || !this.client.connected) return;
        this.sendRequest({ pushing: { sequence_id: "0", command: "pushall" } });
    }

    sendRequest(payload) {
        if (!this.client || !this.client.connected) return;
        const topic = `device/${this.config.serial}/request`;
        this.client.publish(topic, JSON.stringify(payload));
    }

    handleMessage(data) {
        // Bambu payload structure: { print: { ... }, ... }
        if (data && data.print) {
            console.log('[Bambu] Received Print Data');
            // MERGE data instead of overwriting
            this.lastData = { ...(this.lastData || {}), ...data.print };

            this.lastEvent = {
                serial: this.config.serial,
                type: 'bambu',
                status: this.parseStatus(this.lastData),
                name: this.name || this.config.name || this.config.serial, // Add name
                raw: this.lastData
            };

            this.emit('data', this.lastEvent);
        }

        // Handle Info/Name update
        if (data && data.info && data.info.module) {
            const devName = data.info.module.find(m => m.name === 'ota')?.hw_ver || // Fallback
                data.info.module.find(m => m.project_name)?.project_name;
            // Actually dev_name is usually in "info" -> "sequence_id" context or "print" sometimes?
            // Let's look for standard location. 
            // "info" command returns "info" object.
        }

        if (data && data.info && data.info.dev_name) {
            this.name = data.info.dev_name;
            console.log(`[Bambu] Name detected: ${this.name}`);
        }
    }

    parseStatus(print) {
        // Extract useful info
        return {
            state: print.gcode_state, // IDLE, RUNNING, PAUSE, FINISH
            progress: print.mc_percent,
            timeLeft: print.mc_remaining_time,
            bedTemp: print.bed_temper,
            targetBedTemp: print.bed_target_temper,
            nozzleTemp: print.nozzle_temper,
            targetNozzleTemp: print.nozzle_target_temper,
            file: print.gcode_file || print.subtask_name, // Try both fields
            jobId: print.sequence_id || print.subtask_id, // Unique ID for duplicate check
            speed: print.spd_lvl,
            layer: print.layer_num,
            totalLayers: print.total_layer_num
        };
    }

    updateStatus(s) {
        this.status = s;
        this.emit('status', { serial: this.config.serial, status: s });
    }

    disconnect() {
        if (this.client) {
            this.client.end(true);
            this.client = null;
            this.updateStatus('disconnected');
        }
    }
}

module.exports = BambuClient;
