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
        this.baseDir = process.env.PPP_STORAGE_DIR || path.join(process.cwd(), 'storage', 'ppp-preflight-v2');
    }

    getTenantDir(tenantId) {
        const dir = path.join(this.baseDir, 'tenants', tenantId, 'assets');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    /**
     * Creates an asset from a file buffer or path.
     */
    async createAsset({ filename, buffer, filePath, tenantId }) {
        if (!tenantId) throw new Error('[ASSET-ERR] tenantId is mandatory for strictly isolated storage.');

        const fileData = buffer || fs.readFileSync(filePath);
        const sha256 = crypto.createHash('sha256').update(fileData).digest('hex');
        const size = fileData.length;
        const id = crypto.randomUUID();

        // Isolated Storage path: baseDir / tenants / {tenantId} / assets / {sha256}.pdf
        const tenantDir = this.getTenantDir(tenantId);
        const storageFilename = `${sha256}.pdf`;
        const storagePath = path.join(tenantDir, storageFilename);

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
     * Retrieves an asset by ID with tenant validation.
     */
    async getAsset(id, tenantId) {
        const query = tenantId 
            ? ['SELECT * FROM assets WHERE id = ? AND tenant_id = ?', [id, tenantId]]
            : ['SELECT * FROM assets WHERE id = ?', [id]];
        const result = await db.query(query[0], query[1]);
        return result.rows[0];
    }

    /**
     * Returns the full physical path of an asset with tenant validation.
     */
    async getAssetPath(id, tenantId) {
        const asset = await this.getAsset(id, tenantId);
        if (!asset) return null;
        return asset.storage_path;
    }
}

module.exports = new AssetService();






















