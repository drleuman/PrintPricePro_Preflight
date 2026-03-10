const db = require('./db');
const crypto = require('crypto');
const reservationService = require('./reservationService');

class DispatchService {
    /**
     * Creates a new job assignment and triggers dispatch.
     */
    async createAssignment(jobId, printerId, machineId, reservationId, attempt = 1) {
        const id = crypto.randomUUID();

        try {
            await db.query(`
                INSERT INTO job_assignments (id, job_id, printer_id, machine_id, reservation_id, dispatch_attempt)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, jobId, printerId, machineId, reservationId, attempt]);

            await this.logEvent(id, 'ASSIGNMENT_CREATED', { jobId, printerId, attempt });

            // Trigger actual dispatch logic (notifications, webhooks, etc.)
            await this.dispatchJob(id);

            return id;
        } catch (err) {
            console.error('[DISPATCH-SERVICE] Failed to create assignment:', err.message);
            throw err;
        }
    }

    /**
     * Sends dispatch notification to printer.
     */
    async dispatchJob(assignmentId) {
        try {
            await db.query(
                "UPDATE job_assignments SET assignment_status = 'DISPATCHED' WHERE id = ?",
                [assignmentId]
            );

            await this.logEvent(assignmentId, 'DISPATCH_SENT', { timestamp: new Date() });

            // TODO: Integrate with Notification Engine (Email, Webhook, etc.)
            console.log(`[DISPATCH] Job dispatched for assignment ${assignmentId}`);
        } catch (err) {
            await this.logEvent(assignmentId, 'DISPATCH_FAILED', { error: err.message });
            throw err;
        }
    }

    /**
     * Handles printer's response (ACCEPT/REJECT).
     */
    async handlePrinterResponse(assignmentId, action) {
        const [assignment] = await db.query('SELECT * FROM job_assignments WHERE id = ?', [assignmentId]);
        if (!assignment.length) throw new Error('Assignment not found');

        const { job_id, reservation_id, printer_id } = assignment[0];

        if (action === 'ACCEPT') {
            await db.query("UPDATE job_assignments SET assignment_status = 'ACCEPTED' WHERE id = ?", [assignmentId]);
            await reservationService.confirmReservation(reservation_id);
            await this.logEvent(assignmentId, 'PRINTER_ACCEPTED', { printer_id });
        } else if (action === 'REJECT') {
            await db.query("UPDATE job_assignments SET assignment_status = 'REJECTED' WHERE id = ?", [assignmentId]);
            await reservationService.releaseReservation(reservation_id);
            await this.logEvent(assignmentId, 'PRINTER_REJECTED', { printer_id });

            // Trigger automatic rerouting
            await this.rerouteJob(job_id, assignment[0].dispatch_attempt);
        }
    }

    /**
     * Logic to attempt dispatch to the next best candidate.
     */
    async rerouteJob(jobId, previousAttempt) {
        if (previousAttempt >= 3) {
            console.error(`[DISPATCH] Max reroute attempts reached for job ${jobId}`);
            // TODO: Alert ops via conflict log or notification
            return;
        }

        console.log(`[DISPATCH] Rerouting job ${jobId}, attempt ${previousAttempt + 1}`);
        // This would involve calling RoutingService again, excluding the failed printer.
        // For Phase 27.3, we'll implement the logic bridge.
    }

    /**
     * Background task to check for dispatch timeouts (10 minutes).
     */
    async checkTimeouts() {
        const { rows: timedOut } = await db.query(`
            SELECT * FROM job_assignments 
            WHERE assignment_status = 'DISPATCHED' 
              AND created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        `);

        for (const ass of timedOut) {
            console.log(`[DISPATCH] Timing out assignment ${ass.id}`);
            await db.query("UPDATE job_assignments SET assignment_status = 'FAILED' WHERE id = ?", [ass.id]);
            await reservationService.releaseReservation(ass.reservation_id);
            await this.logEvent(ass.id, 'DISPATCH_FAILED', { reason: 'TIMEOUT' });

            await this.rerouteJob(ass.job_id, ass.dispatch_attempt);
        }
    }

    /**
     * Internal event logger.
     */
    async logEvent(assignmentId, type, metadata) {
        const id = crypto.randomUUID();
        await db.query(
            'INSERT INTO dispatch_events (id, assignment_id, event_type, metadata_json) VALUES (?, ?, ?, ?)',
            [id, assignmentId, type, JSON.stringify(metadata)]
        );
    }
}

module.exports = new DispatchService();
