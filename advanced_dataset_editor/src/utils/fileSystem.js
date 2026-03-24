import { fs, path, tauri } from '@tauri-apps/api';
import { convertFileSrc } from '@tauri-apps/api/tauri';

// Base directory for temporary storage
const TEMP_DIR_NAME = 'dataset_editor_temp';

/**
 * Initialize the temporary directory.
 * Clears it if it exists, or creates it.
 */
export const initTempDir = async () => {
    try {
        const tempPath = await path.tempDir();
        const appTempPath = await path.join(tempPath, TEMP_DIR_NAME);

        const exists = await fs.exists(appTempPath);
        if (exists) {
            // Clean up existing temp dir
            await fs.removeDir(appTempPath, { recursive: true });
        }

        await fs.createDir(appTempPath);
        return appTempPath;
    } catch (error) {
        console.error('Error initializing temp dir:', error);
        throw error;
    }
};

/**
 * Extract a ZIP file to the temporary directory.
 * Note: JSZip is used in memory, so for very large ZIPs this might still be an issue.
 * Ideally, we would stream this, but JSZip is what we have.
 * We will write files to disk immediately to free up memory.
 */
export const extractZipToDisk = async (zipContent, targetDir) => {
    const files = Object.keys(zipContent.files);
    const extractedFiles = [];

    for (const filename of files) {
        const file = zipContent.files[filename];
        if (file.dir) {
            const dirPath = await path.join(targetDir, filename);
            if (!(await fs.exists(dirPath))) {
                await fs.createDir(dirPath, { recursive: true });
            }
        } else {
            // Create parent dir if needed
            const filePath = await path.join(targetDir, filename);
            const parentDir = await path.dirname(filePath);
            if (!(await fs.exists(parentDir))) {
                await fs.createDir(parentDir, { recursive: true });
            }

            // Write file to disk
            const content = await file.async('uint8array');
            await fs.writeBinaryFile(filePath, content);

            extractedFiles.push({
                name: filename,
                path: filePath,
                url: convertFileSrc(filePath)
            });
        }
    }

    return extractedFiles;
};

/**
 * Read a text file from disk.
 */
export const readTextFile = async (filePath) => {
    return await fs.readTextFile(filePath);
};

/**
 * Get the asset URL for a file path.
 */
export const getAssetUrl = (filePath) => {
    return convertFileSrc(filePath);
};
