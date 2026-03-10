const db = require('./db');
const crypto = require('crypto');

class ReservationService {
    /**
     * Creates a new capacity reservation.
     * Uses a transaction to ensure atomic check-and-reserve.
     */
    async createReservation(jobId, printerId, machineId, units) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const date = new Date().toISOString().split('T')[0];

            // 1. Get physical capacity and calculate active reservations
            const [physical] = await connection.query(
                'SELECT capacity_available FROM printer_capacity WHERE printer_id = ? AND date = ? FOR UPDATE',
                [printerId, date]
            );

            if (!physical.length) {
                throw new Error('No capacity record found for printer on this date.');
            }

            const [reservations] = await connection.query(
                `SELECT SUM(reserved_units) as total_reserved 
                 FROM capacity_reservations 
                 WHERE printer_id = ? AND reservation_status = 'ACTIVE'`,
                [printerId]
            );

            const activeReserved = reservations[0].total_reserved || 0;
            const effectiveCapacity = physical[0].capacity_available - activeReserved;

            if (effectiveCapacity < units) {
                throw new Error(`Insufficient effective capacity. Physical: ${physical[0].capacity_available}, Reserved: ${activeReserved}, Requested: ${units}`);
            }

            // 2. Create reservation
            const reservationId = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes

            await connection.query(
                `INSERT INTO capacity_reservations (id, job_id, printer_id, machine_id, reserved_units, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [reservationId, jobId, printerId, machineId, units, expiresAt]
            );

            // 3. Log event
            await this.logEvent(reservationId, 'RESERVATION_CREATED', { jobId, printerId, units }, connection);

            await connection.commit();
            return { id: reservationId, expires_at: expiresAt };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Cancels a reservation.
     */
    async releaseReservation(reservationId) {
        await db.query(
            "UPDATE capacity_reservations SET reservation_status = 'CANCELLED' WHERE id = ?",
            [reservationId]
        );
        await this.logEvent(reservationId, 'RESERVATION_CANCELLED', {});
    }

    /**
     * Confirms a reservation (converting it to a job outcome/assignment).
     */
    async confirmReservation(reservationId) {
        await db.query(
            "UPDATE capacity_reservations SET reservation_status = 'CONFIRMED' WHERE id = ?",
            [reservationId]
        );
        await this.logEvent(reservationId, 'RESERVATION_CONFIRMED', {});
    }

    /**
     * Expires stale reservations.
     */
    async expireReservations() {
        const { rows } = await db.query(
            "SELECT id FROM capacity_reservations WHERE reservation_status = 'ACTIVE' AND expires_at < NOW()"
        );

        for (const res of rows) {
            await db.query(
                "UPDATE capacity_reservations SET reservation_status = 'EXPIRED' WHERE id = ?",
                [res.id]
            );
            await this.logEvent(res.id, 'RESERVATION_EXPIRED', {});
        }

        return rows.length;
    }

    /**
     * Computes available capacity considering reservations.
     */
    async getEffectiveCapacity(printerId, date) {
        const { rows: physical } = await db.query(
            'SELECT capacity_available FROM printer_capacity WHERE printer_id = ? AND date = ?',
            [printerId, date]
        );

        if (!physical.length) return 0;

        const { rows: reservations } = await db.query(
            `SELECT SUM(reserved_units) as total_reserved 
             FROM capacity_reservations 
             WHERE printer_id = ? AND reservation_status = 'ACTIVE'`,
            [printerId]
        );

        return physical[0].capacity_available - (reservations[0].total_reserved || 0);
    }

    /**
     * Internal helper to log events.
     */
    async logEvent(reservationId, type, metadata, connection = db) {
        const id = crypto.randomUUID();
        await connection.query(
            'INSERT INTO reservation_events (id, reservation_id, event_type, metadata_json) VALUES (?, ?, ?, ?)',
            [id, reservationId, type, JSON.stringify(metadata)]
        );
    }
}

module.exports = new ReservationService();
