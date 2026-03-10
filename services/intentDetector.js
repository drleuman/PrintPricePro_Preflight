const fs = require('fs');
const path = require('path');

/**
 * EditionIntentDetector
 * 
 * Analyzes PDF technical facts (signals) against a registry of 
 * production intent profiles to classify the document.
 */
class EditionIntentDetector {
    constructor() {
        this.registryPath = path.join(__dirname, '../registry/edition_intents.json');
        this.profiles = this.loadProfiles();
    }

    loadProfiles() {
        try {
            const data = fs.readFileSync(this.registryPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`[IntentDetector] Failed to load intent profiles from ${this.registryPath}:`, error);
            return {};
        }
    }

    /**
     * Detects the dominant intent based on technical signals.
     * @param {Object} signals - Key-value pairs of detected technical facts.
     * @returns {Object} { primary_intent, all_matches, confidence_score }
     */
    detect(signals) {
        const results = [];

        for (const [intentName, profile] of Object.entries(this.profiles)) {
            const score = this.calculateScore(signals, profile);
            const confidence = this.mapScoreToConfidence(score, profile.thresholds);

            if (score >= profile.thresholds.candidate) {
                results.push({
                    intent: intentName,
                    score,
                    confidence,
                    is_candidate: true
                });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        const primary = results[0] || { intent: 'unknown', score: 0, confidence: 'none' };
        const runnerUp = results[1] || null;

        return {
            primary_intent: primary.intent,
            intent_score: primary.score,
            confidence_level: primary.confidence,
            runner_up_intent: runnerUp ? runnerUp.intent : null,
            all_candidates: results,
            evidence: this.extractEvidence(signals, primary.intent)
        };
    }

    calculateScore(signals, profile) {
        let score = 0;

        // Positive Signals
        if (profile.positive_signals) {
            for (const [signalName, weight] of Object.entries(profile.positive_signals)) {
                if (signals[signalName]) {
                    score += weight;
                }
            }
        }

        // Negative Signals
        if (profile.negative_signals) {
            for (const [signalName, weight] of Object.entries(profile.negative_signals)) {
                if (signals[signalName]) {
                    score += weight;
                }
            }
        }

        // Clamp score to positive range for thresholds
        return Math.max(0, score);
    }

    mapScoreToConfidence(score, thresholds) {
        if (score >= thresholds.primary) return 'high';
        if (score >= thresholds.strong) return 'medium';
        if (score >= thresholds.candidate) return 'low';
        return 'none';
    }

    extractEvidence(signals, primaryIntent) {
        const profile = this.profiles[primaryIntent];
        if (!profile) return { positive: [], negative: [] };

        const evidence = {
            positive: [],
            negative: []
        };

        // Positive Signals
        for (const signalName of Object.keys(profile.positive_signals || {})) {
            if (signals[signalName]) {
                evidence.positive.push(signalName);
            }
        }

        // Negative Signals
        for (const signalName of Object.keys(profile.negative_signals || {})) {
            if (signals[signalName]) {
                evidence.negative.push(signalName);
            }
        }

        return evidence;
    }
}

module.exports = new EditionIntentDetector();
