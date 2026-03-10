/**
 * @project PrintPrice Pro - Asset & Storage Service
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

/**
 * Service to manage PDF assets, their storage, and metadata.
 */
class AssetService {
    constructor() {
        this.uploadDir = process.env.PPP_UPLOAD_DIR || path.join(process.platform === 'win32' ? process.env.TEMP : '/tmp', 'ppp-preflight-v2');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Creates an asset from a file buffer or path.
     */
    async createAsset({ filename, buffer, filePath, tenantId = 'default' }) {
        const fileData = buffer || fs.readFileSync(filePath);
        const sha256 = crypto.createHash('sha256').update(fileData).digest('hex');
        const size = fileData.length;
        const id = crypto.randomUUID();

        // Storage path: uploadDir / {sha256}.pdf to allow deduplication eventually
        const storageFilename = `${sha256}.pdf`;
        const storagePath = path.join(this.uploadDir, storageFilename);

        if (!fs.existsSync(storagePath)) {
            if (buffer) {
                fs.writeFileSync(storagePath, buffer);
            } else {
                fs.copyFileSync(filePath, storagePath);
            }
        }

        const sql = `
            INSERT INTO assets (id, tenant_id, filename, storage_path, sha256, size, mime_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [id, tenantId, filename, storagePath, sha256, size, 'application/pdf'];

        await db.query(sql, values);
        return {
            id,
            tenant_id: tenantId,
            filename,
            storage_path: storagePath,
            sha256,
            size,
            mime_type: 'application/pdf'
        };
    }

    /**
     * Retrieves an asset by ID.
     */
    async getAsset(id) {
        const result = await db.query('SELECT * FROM assets WHERE id = ?', [id]);
        return result.rows[0];
    }

    /**
     * Returns the full physical path of an asset.
     */
    async getAssetPath(id) {
        const asset = await this.getAsset(id);
        if (!asset) return null;
        return asset.storage_path;
    }
}

module.exports = new AssetService();
