const ftp = require("basic-ftp");
const path = require('path');
const fs = require('fs');

class BambuFTP {
    constructor(config, logCallback = console.log) {
        this.config = config;
        this.client = new ftp.Client();
        this.log = logCallback;
        // this.client.ftp.verbose = true;
    }

    async downloadFile(filename, targetDir) {
        try {
            this.log(`[FTP] Connecting to ${this.config.ip}...`);
            await this.client.access({
                host: this.config.ip,
                port: 990, // Bambu uses Implicit FTPS on 990
                user: "bblp",
                password: this.config.accessCode,
                secure: "implicit",
                secureOptions: { rejectUnauthorized: false } // Self-signed certs
            });

            this.log(`[FTP] Connected. Check root...`);
            const rootFiles = await this.client.list("/");
            // this.log('[FTP] Root files:', rootFiles.map(f => f.name));

            // Check if file is in root
            let targetPath = "/" + filename;
            let found = rootFiles.find(f => f.name === filename);

            if (!found) {
                this.log(`[FTP] Not in root. Checking /cache...`);
                const cacheFiles = await this.client.list("/cache");
                // this.log('[FTP] Cache files:', cacheFiles.map(f => f.name));

                found = cacheFiles.find(f => f.name === filename || f.name.includes(filename)); // Try partial match?
                if (found) {
                    targetPath = "/cache/" + found.name;
                    this.log(`[FTP] Found in cache: ${targetPath}`);
                } else {
                    this.log('[FTP] File not found anywhere!');
                    // Try to download anyway using the provided name, maybe it works?
                    // targetPath = filename;
                }
            }

            this.log(`[FTP] Attempting to download: ${targetPath}`);

            // Ensure target dir exists
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            const localPath = path.join(targetDir, path.basename(filename));

            this.log(`[FTP] Downloading to ${localPath}...`);
            await this.client.downloadTo(localPath, targetPath);

            this.log(`[FTP] Download complete!`);
            return localPath;

        } catch (err) {
            this.log(`[FTP] Error: ${err.message}`);
            throw err;
        } finally {
            this.client.close();
        }
    }
}

module.exports = BambuFTP;
