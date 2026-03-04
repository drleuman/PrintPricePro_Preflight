const { query } = require('./db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const JOBS_DIR = path.join(__dirname, '../../jobs');
if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
}

class JobManager {
    static getJobDir(jobId) {
        return path.join(JOBS_DIR, jobId);
    }

    static async createJob(originalName, options = {}) {
        const jobId = crypto.randomUUID();
        const jobDir = this.getJobDir(jobId);
        if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

        const sql = `
            INSERT INTO jobs (id, status, original_name, priority, requested_profile)
            VALUES ($1, $2, $3, $4, $5)
        `;
        const values = [jobId, 'UPLOADED', originalName, options.priority || 0, options.profile || 'iso_coated_v2'];
        await query(sql, values);
        return { id: jobId, status: 'UPLOADED', original_name: originalName, priority: options.priority || 0, requested_profile: options.profile || 'iso_coated_v2' };
    }

    static async updateJob(jobId, updates) {
        const keys = Object.keys(updates);
        if (keys.length === 0) return;

        const setClause = keys.map((key, i) => {
            return `${key} = $${i + 2}`;
        }).join(', ');
        const sql = `UPDATE jobs SET ${setClause}, updated_at = NOW() WHERE id = $1`;
        const values = [jobId, ...Object.values(updates).map(v => typeof v === 'object' ? JSON.stringify(v) : v)];
        await query(sql, values);
        return { id: jobId, ...updates };
    }

    static async getJob(jobId) {
        const res = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
        return res.rows[0];
    }

    static async enqueueTask(jobId, taskType, payload = {}, pageNo = null) {
        const sql = `
            INSERT INTO job_tasks (job_id, task_type, payload_json, page_no)
            VALUES ($1, $2, $3, $4)
        `;
        const res = await query(sql, [jobId, taskType, JSON.stringify(payload), pageNo]);
        return { id: res.insertId, job_id: jobId, task_type: taskType, payload_json: payload, page_no: pageNo };
    }

    static getOriginalPath(jobId) {
        return path.join(this.getJobDir(jobId), 'original.pdf');
    }

    static async cancelJob(jobId) {
        await query("UPDATE jobs SET status = 'CANCELED' WHERE id = $1", [jobId]);
        await query("UPDATE job_tasks SET status = 'CANCELED' WHERE job_id = $1 AND status = 'PENDING'", [jobId]);
    }
}

module.exports = JobManager;
