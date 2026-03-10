// services/printerQualityService.js
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

class PrinterQualityService {
    /**
     * Recomputes and updates the quality score for a printer node.
     */
    async calculateQualityScore(printerId) {
        try {
            // Fetch recent performance or outcomes
            const { rows: outcomes } = await db.query(`
                SELECT status, completion_time_hours, quality_rating
                FROM job_outcomes
                WHERE printer_id = ?
                ORDER BY created_at DESC
                LIMIT 100
            `, [printerId]);

            if (outcomes.length === 0) return 0.5; // Default for new nodes

            const successJobs = outcomes.filter(o => o.status === 'SUCCESS').length;
            const reprintJobs = outcomes.filter(o => o.status === 'REPRINT').length;
            const totalJobs = outcomes.length;

            const successRate = successJobs / totalJobs;
            const reprintRate = reprintJobs / totalJobs;

            // For now, on-time rate is simplified (e.g. status not 'DELAYED' if we had it, but let's assume outcomes linked to success)
            const onTimeRate = 1.0; // Placeholder until we have SLA comparisons

            /**
             * quality_score = (success_rate * 0.5) + (on_time_delivery_rate * 0.3) + (1 - reprint_rate) * 0.2
             */
            const qualityScore = (successRate * 0.5) + (onTimeRate * 0.3) + ((1 - reprintRate) * 0.2);

            // Update printer_nodes
            await db.query('UPDATE printer_nodes SET quality_score = ? WHERE id = ?', [qualityScore, printerId]);

            return qualityScore;
        } catch (err) {
            console.error('[QUALITY-SERVICE] Calculation failed:', err.message);
            return 0.5;
        }
    }

    /**
     * Updates historical performance snapshot.
     */
    async updatePrinterPerformance(printerId) {
        try {
            const { rows: stats } = await db.query(`
                SELECT 
                    COUNT(*) as jobs_processed,
                    COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as jobs_success,
                    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as jobs_failed,
                    COUNT(CASE WHEN status = 'REPRINT' THEN 1 END) as jobs_reprint,
                    AVG(completion_time_hours) as avg_time
                FROM job_outcomes
                WHERE printer_id = ?
            `, [printerId]);

            const s = stats[0];
            const currentScore = await this.calculateQualityScore(printerId);

            const perfId = uuidv4();
            await db.query(`
                INSERT INTO printer_performance 
                (id, printer_id, period_start, period_end, jobs_processed, jobs_success, jobs_failed, reprint_rate, on_time_delivery_rate, avg_processing_time, quality_score)
                VALUES (?, ?, CURRENT_DATE, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    jobs_processed = VALUES(jobs_processed),
                    jobs_success = VALUES(jobs_success),
                    jobs_failed = VALUES(jobs_failed),
                    reprint_rate = VALUES(reprint_rate),
                    quality_score = VALUES(quality_score),
                    avg_processing_time = VALUES(avg_processing_time)
            `, [
                perfId, printerId,
                s.jobs_processed, s.jobs_success, s.jobs_failed,
                s.jobs_processed > 0 ? (s.jobs_reprint / s.jobs_processed) : 0,
                1.0, // placeholder
                s.avg_time || 0,
                currentScore
            ]);
        } catch (err) {
            console.error('[QUALITY-SERVICE] Performance update failed:', err.message);
        }
    }

    async recordOutcome(jobId, printerId, data) {
        const { status, completionTime, rating } = data;
        const id = uuidv4();
        await db.query(`
            INSERT INTO job_outcomes (id, job_id, printer_id, status, completion_time_hours, quality_rating)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, jobId, printerId, status, completionTime, rating]);

        await this.updatePrinterPerformance(printerId);
    }
}

module.exports = new PrinterQualityService();
