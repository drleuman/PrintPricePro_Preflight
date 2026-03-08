const db = require('./db');
const crypto = require('crypto');

// Importing subsystems (placeholders for real services)
// We assume these services exist with the correct interfaces from previous phases
// const preflightService = require('./preflightV2'); // Analysis & Fix (Coming Soon)
const routingEngine = require('./routingRecommendationService'); // candidates
const economicRoutingService = require('./economicRoutingService'); // scoring
const productionOfferService = require('./productionOfferService'); // offer creation
const negotiationService = require('./negotiationService'); // counteroffers
const commercialCommitmentService = require('./commercialCommitmentService'); // ledger
const settlementReadinessService = require('./settlementReadinessService'); // payout prep
const financialLedgerService = require('./financialLedgerService');
const dispatchService = require('./dispatchService'); // assignment

const PIPELINE_STATES = {
    JOB_RECEIVED: 'JOB_RECEIVED',
    FILE_ANALYZED: 'FILE_ANALYZED',
    FILE_AUTOFIXED: 'FILE_AUTOFIXED',
    ROUTING_CANDIDATES_GENERATED: 'ROUTING_CANDIDATES_GENERATED',
    ECONOMIC_ROUTING_COMPLETE: 'ECONOMIC_ROUTING_COMPLETE',
    OFFERS_CREATED: 'OFFERS_CREATED',
    NEGOTIATION_ACTIVE: 'NEGOTIATION_ACTIVE',
    COMMERCIAL_COMMITMENT_CREATED: 'COMMERCIAL_COMMITMENT_CREATED',
    FINANCIAL_TRANSACTION_CREATED: 'FINANCIAL_TRANSACTION_CREATED',
    PRODUCTION_ASSIGNED: 'PRODUCTION_ASSIGNED',
    PRODUCTION_IN_PROGRESS: 'PRODUCTION_IN_PROGRESS',
    PRODUCTION_COMPLETED: 'PRODUCTION_COMPLETED',
    JOB_CLOSED: 'JOB_CLOSED'
};

/**
 * Autonomous Production Orchestrator
 * End-to-end management of job lifecycle.
 */
class AutonomousOrchestrator {
    constructor() {
        this.states = Object.values(PIPELINE_STATES);
    }

    /**
     * Starts a new pipeline for a job.
     */
    async startPipeline(jobId) {
        const id = crypto.randomUUID();
        await db.query(`
            INSERT INTO autonomous_job_pipelines (id, job_id, pipeline_state, pipeline_status, current_step)
            VALUES (?, ?, 'JOB_RECEIVED', 'RUNNING', 'START')
        `, [id, jobId]);

        await this.logPipelineEvent(id, 'PIPELINE_STARTED', 'START', { jobId });

        // Auto-advance to first step
        setImmediate(() => this.advancePipeline(id));
        return id;
    }

    /**
     * Orchestrates the transition to the next state.
     */
    async advancePipeline(pipelineId) {
        const { rows: [p] } = await db.query('SELECT * FROM autonomous_job_pipelines WHERE id = ?', [pipelineId]);
        if (!p || p.pipeline_status !== 'RUNNING') return;

        const currentIndex = this.states.indexOf(p.pipeline_state);
        if (currentIndex === -1 || currentIndex === this.states.length - 1) return;

        const nextState = this.states[currentIndex + 1];

        try {
            await this.runPipelineStep(pipelineId, nextState);
        } catch (err) {
            await this.handlePipelineFailure(pipelineId, nextState, err.message);
        }
    }

    /**
     * Executes logic for a specific state.
     */
    async runPipelineStep(pipelineId, state) {
        const { rows: [pipeline] } = await db.query('SELECT * FROM autonomous_job_pipelines WHERE id = ?', [pipelineId]);
        const jobId = pipeline.job_id;

        console.log(`[ORCHESTRATOR] Pipeline ${pipelineId} entering ${state}...`);

        switch (state) {
            case PIPELINE_STATES.FILE_ANALYZED:
                // Implement analysis logic
                await this.updatePipelineState(pipelineId, state, 'ANALYZING');
                // await preflightService.analyze(jobId);
                break;

            case PIPELINE_STATES.FILE_AUTOFIXED:
                await this.updatePipelineState(pipelineId, state, 'AUTOFIXING');
                // await preflightService.applyAutoFixes(jobId);
                break;

            case PIPELINE_STATES.ROUTING_CANDIDATES_GENERATED:
                await this.updatePipelineState(pipelineId, state, 'ROUTING');
                // await routingEngine.generateRecommendations(jobId);
                break;

            case PIPELINE_STATES.ECONOMIC_ROUTING_COMPLETE:
                await this.updatePipelineState(pipelineId, state, 'ECONOMIC_EVALUATION');
                // await economicRoutingService.scoreRecommendations(jobId);
                break;

            case PIPELINE_STATES.OFFERS_CREATED:
                await this.updatePipelineState(pipelineId, state, 'CREATING_OFFERS');
                // await productionOfferService.generateOffers(jobId);
                break;

            case PIPELINE_STATES.NEGOTIATION_ACTIVE:
                await this.updatePipelineState(pipelineId, state, 'NEGOTIATING');
                // Default behavior: proceed unless manual mode
                if (!pipeline.autonomous_mode) {
                    await this.pausePipeline(pipelineId, 'MANUAL_NEGOTIATION_REQUIRED');
                    return;
                }
                break;

            case PIPELINE_STATES.COMMERCIAL_COMMITMENT_CREATED:
                await this.updatePipelineState(pipelineId, state, 'COMMITTING');
                // Logic to select best offer and commit
                // const sessionId = ...
                // await commercialCommitmentService.createCommitmentFromSession(sessionId);
                break;

            case PIPELINE_STATES.FINANCIAL_TRANSACTION_CREATED:
                await this.updatePipelineState(pipelineId, state, 'CREATING_FINANCIAL_TRANSACTION');
                // Commitment is already created by previous state transition success
                // Now we prepare the financial transaction
                const commitments = await db.query('SELECT id FROM commercial_commitments WHERE job_id = ? ORDER BY created_at DESC LIMIT 1', [jobId]);
                if (commitments.rows.length === 0) throw new Error('Commercial commitment missing');

                const txId = await financialLedgerService.createFinancialTransaction(commitments.rows[0].id);
                break;

            case PIPELINE_STATES.PRODUCTION_ASSIGNED:
                await this.updatePipelineState(pipelineId, state, 'DISPATCHING');
                // await dispatchService.assignToPrinter(jobId);
                break;

            case PIPELINE_STATES.PRODUCTION_IN_PROGRESS:
                await this.updatePipelineState(pipelineId, state, 'PRODUCTION_TRACKING');
                break;

            case PIPELINE_STATES.PRODUCTION_COMPLETED:
                await this.updatePipelineState(pipelineId, state, 'FINALIZING_PRODUCTION');
                break;

            case PIPELINE_STATES.JOB_CLOSED:
                await this.closePipeline(pipelineId);
                return;
        }

        // Successfully completed step
        await this.logPipelineEvent(pipelineId, 'STEP_COMPLETED', state);

        // Auto-advance if not paused
        setImmediate(() => this.advancePipeline(pipelineId));
    }

    async updatePipelineState(id, state, step) {
        await db.query(`
            UPDATE autonomous_job_pipelines 
            SET pipeline_state = ?, current_step = ? 
            WHERE id = ?
        `, [state, step, id]);
    }

    async handlePipelineFailure(id, state, reason) {
        await db.query(`
            UPDATE autonomous_job_pipelines 
            SET pipeline_status = 'FAILED', error_reason = ? 
            WHERE id = ?
        `, [reason, id]);
        await this.logPipelineEvent(id, 'STEP_FAILED', state, { error: reason });
    }

    async retryPipelineStep(id) {
        await db.query("UPDATE autonomous_job_pipelines SET pipeline_status = 'RUNNING', error_reason = NULL WHERE id = ?", [id]);
        await this.logPipelineEvent(id, 'STEP_RETRIED', 'RETRY');
        setImmediate(() => this.advancePipeline(id));
    }

    async pausePipeline(id, reason) {
        await db.query("UPDATE autonomous_job_pipelines SET pipeline_status = 'PAUSED', error_reason = ? WHERE id = ?", [reason, id]);
        await this.logPipelineEvent(id, 'PIPELINE_PAUSED', 'PAUSE', { reason });
    }

    async resumePipeline(id) {
        await db.query("UPDATE autonomous_job_pipelines SET pipeline_status = 'RUNNING', error_reason = NULL WHERE id = ?", [id]);
        await this.logPipelineEvent(id, 'PIPELINE_RESUMED', 'RESUME');
        setImmediate(() => this.advancePipeline(id));
    }

    async closePipeline(id) {
        await db.query("UPDATE autonomous_job_pipelines SET pipeline_status = 'COMPLETED', pipeline_state = 'JOB_CLOSED' WHERE id = ?", [id]);
        await this.logPipelineEvent(id, 'PIPELINE_COMPLETED', 'CLOSE');
    }

    async logPipelineEvent(pipelineId, type, step, metadata = {}) {
        await db.query(`
            INSERT INTO pipeline_events (id, pipeline_id, event_type, step_name, metadata_json)
            VALUES (?, ?, ?, ?, ?)
        `, [crypto.randomUUID(), pipelineId, type, step, JSON.stringify(metadata)]);
    }
}

module.exports = new AutonomousOrchestrator();
