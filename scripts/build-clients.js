const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const apiUploadsDir = path.join(projectRoot, 'apps/api/uploads/clients');

// Ensure destination exists
if (!fs.existsSync(apiUploadsDir)) {
    console.log(`Creating directory: ${apiUploadsDir}`);
    fs.mkdirSync(apiUploadsDir, { recursive: true });
}

function runCommand(command, cwd) {
    console.log(`Running: ${command} in ${cwd}`);
    try {
        execSync(command, { cwd, stdio: 'inherit' });
    } catch (e) {
        console.error(`Command failed: ${command} in ${cwd}`);
        // Log detailed error if possible
    }
}

function copyFile(src, destFilename) {
    const dest = path.join(apiUploadsDir, destFilename);
    // Find the file if src is a pattern? No, just absolute path.
    // However, if we don't know the exact version in filename for electron builder...

    if (fs.existsSync(src)) {
        console.log(`Copying ${src} to ${dest}`);
        fs.copyFileSync(src, dest);
    } else {
        console.error(`Source file not found: ${src}`);
    }
}

// 1. Build NFC Bridge (Headless)
const nfcBridgeDir = path.join(projectRoot, 'apps/nfc-bridge');
console.log('--- Building NFC Bridge ---');
if (fs.existsSync(nfcBridgeDir)) {
    runCommand('npm install', nfcBridgeDir);
    runCommand('npm run dist-headless', nfcBridgeDir);
    const nfcExe = path.join(nfcBridgeDir, 'dist-headless/spoolynfc-console.exe');
    if (fs.existsSync(nfcExe)) {
        copyFile(nfcExe, 'spoolynfc-console.exe');
    } else {
        console.error('NFC Bridge Headless EXE not found after build.');
    }

    // Build NFC Bridge (Electron)
    console.log('--- Building NFC Bridge (Electron) ---');
    runCommand('npm run dist', nfcBridgeDir);
    const nfcDistDir = path.join(nfcBridgeDir, 'dist-final');
    if (fs.existsSync(nfcDistDir)) {
        const files = fs.readdirSync(nfcDistDir);
        // Look for portable .exe first?
        const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('blockmap'));

        if (exeFile) {
            console.log(`Found executable: ${exeFile}`);
            copyFile(path.join(nfcDistDir, exeFile), 'SpoolyNFC.exe');
        } else {
            console.error('No .exe found in NFC Bridge dist-final folder');
        }
    } else {
        console.error(`Dist folder not found: ${nfcDistDir}`);
    }
} else {
    console.error('NFC Bridge directory not found.');
}

// 2. Build Printer Bridge (Electron Portable or Setup)
const printerBridgeDir = path.join(projectRoot, 'apps/printer-bridge');
console.log('--- Building Printer Bridge ---');
if (fs.existsSync(printerBridgeDir)) {
    runCommand('npm install', printerBridgeDir);
    runCommand('npm run dist', printerBridgeDir);

    // Find the .exe in dist-final (based on package.json directories.output)
    const distDir = path.join(printerBridgeDir, 'dist-final');
    if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        // Look for portable .exe first?
        const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('blockmap'));

        if (exeFile) {
            console.log(`Found executable: ${exeFile}`);
            copyFile(path.join(distDir, exeFile), 'SpoolyPrinterBridge.exe');
        } else {
            console.error('No .exe found in Printer Bridge dist-final folder');
        }
    } else {
        console.error(`Dist folder not found: ${distDir}`);
        // Check dist/ (default) just in case
        const defaultDist = path.join(printerBridgeDir, 'dist');
        if (fs.existsSync(defaultDist)) {
            const files = fs.readdirSync(defaultDist);
            const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('blockmap'));
            if (exeFile) {
                console.log(`Found executable in dist: ${exeFile}`);
                copyFile(path.join(defaultDist, exeFile), 'SpoolyPrinterBridge.exe');
            }
        }
    }
} else {
    console.error('Printer Bridge directory not found.');
}

console.log('--- Build Complete ---');
console.log(`Files available in: ${apiUploadsDir}`);
