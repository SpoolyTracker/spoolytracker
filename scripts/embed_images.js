const fs = require('fs');
const path = require('path');

const filesToProcess = [
    'docs/user_guide_print.md',
    'docs/admin_guide_print.md',
    'docs/moderator_guide_print.md'
];

filesToProcess.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`Skipping ${file} (not found)`);
        return;
    }

    let content = fs.readFileSync(file, 'utf8');
    const dir = path.dirname(file);

    // Regex to find images: ![alt](path)
    // We need to handle file:/// prefix if present
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;

    content = content.replace(imageRegex, (match, alt, imgPath) => {
        let cleanPath = imgPath;
        if (cleanPath.startsWith('file:///')) {
            cleanPath = cleanPath.replace('file:///', '');
        }

        // Handle absolute paths by keeping them, relative paths by resolving
        // But here we know we put absolute paths.
        // Windows paths might need normalization? 
        // e.g. c:/Users/...

        if (!cleanPath.startsWith('http') && !path.isAbsolute(cleanPath)) {
            // Resolve relative to the markdown file
            cleanPath = path.resolve(dir, cleanPath);
        }

        if (!fs.existsSync(cleanPath)) {
            console.error(`Image not found: ${cleanPath}`);
            return match; // Return original if not found
        }

        const ext = path.extname(cleanPath).slice(1);
        const base64 = fs.readFileSync(cleanPath, 'base64');
        const dataUri = `data:image/${ext};base64,${base64}`;

        console.log(`Embedded ${path.basename(cleanPath)} in ${file}`);
        return `![${alt}](${dataUri})`;
    });

    const backupFile = file.replace('.md', '_embedded.md');
    fs.writeFileSync(backupFile, content);
    console.log(`Created ${backupFile}`);
});
