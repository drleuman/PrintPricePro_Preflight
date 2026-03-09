const detector = require('../services/intentDetector');

const scenarios = [
    {
        name: 'Standard Photo Book',
        signals: {
            cover_spread_detected: true,
            image_area_ratio_gte_0_60: true,
            spine_zone_present: true,
            trim_family_large_or_square: true
        },
        expected: 'hardcover_photo_book'
    },
    {
        name: 'Standard Text Novel',
        signals: {
            page_bucket_medium_to_very_high: true,
            text_area_ratio_gte_0_65: true,
            trim_family_pocket_or_trade: true,
            image_area_ratio_lte_0_15: true,
            primary_language_text_dominant: true
        },
        expected: 'paperback_novel'
    },
    {
        name: 'Marketing Booklet',
        signals: {
            page_bucket_very_low_to_low: true,
            binding_candidate_saddle: true,
            spine_width_estimated_mm_lte_2: true
        },
        expected: 'booklet_saddle_stitch'
    },
    {
        name: 'Ambiguous Mix (Weak signals)',
        signals: {
            page_bucket_medium_to_very_high: true,
            image_area_ratio_gte_0_40: true
        },
        expected: 'unknown'
    }
];

console.log('--- Intent Detector Verification ---\n');

scenarios.forEach(scenario => {
    console.log(`Testing: ${scenario.name}`);
    const result = detector.detect(scenario.signals);

    const passed = result.primary_intent === scenario.expected || (scenario.expected === 'unknown' && result.confidence_level === 'none');

    console.log(`> Detected: ${result.primary_intent} (${result.confidence_level} confidence)`);
    console.log(`> Score: ${result.intent_score}`);
    console.log(`> Evidence (+): ${result.evidence.positive.join(', ')}`);
    console.log(`> Evidence (-): ${result.evidence.negative.join(', ')}`);
    console.log(`> Runner up: ${result.runner_up_intent || 'none'}`);
    console.log(`> Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('---');
});
