/**
 * Standalone Test for Print Edition Intent Detection
 */

// Simple mock of the inference function
const signalsList = [
    {
        name: 'OFFSET INTENT TEST',
        signals: {
            avgTac: 240,
            richBlackFrequency: 0.8,
            grayscalePercentage: 0.1,
            spotColorsCount: 2,
            hasLargeBackgrounds: true,
            hasConsistentBleed: true,
            hasMarks: true,
            isPageUniform: true,
            dominantDpi: 300,
            imageCompression: 'ZIP',
            photoCoverage: 0.4,
            hasSmallReversedText: false,
            hasHairlines: true,
            hasKnockoutBlackText: true
        }
    },
    {
        name: 'DIGITAL INTENT TEST',
        signals: {
            avgTac: 80,
            richBlackFrequency: 0.05,
            grayscalePercentage: 0.7,
            spotColorsCount: 0,
            hasLargeBackgrounds: false,
            hasConsistentBleed: false,
            hasMarks: false,
            isPageUniform: false,
            dominantDpi: 150,
            imageCompression: 'JPEG',
            photoCoverage: 0.1,
            hasSmallReversedText: false,
            hasHairlines: false,
            hasKnockoutBlackText: false
        }
    },
    {
        name: 'MIXED INTENT TEST',
        signals: {
            avgTac: 150,
            richBlackFrequency: 0.2,
            grayscalePercentage: 0.4,
            spotColorsCount: 0,
            hasLargeBackgrounds: true,
            hasConsistentBleed: true,
            hasMarks: false,
            isPageUniform: true,
            dominantDpi: 220,
            imageCompression: 'MIXED',
            photoCoverage: 0.2,
            hasSmallReversedText: true,
            hasHairlines: true,
            hasKnockoutBlackText: false
        }
    }
];

function inferEditionIntent(signals, currentProfile) {
    let offsetScore = 0;
    let digitalScore = 0;

    if (signals.richBlackFrequency > 0.3) offsetScore += 25;
    if (signals.avgTac > 220) offsetScore += 20;
    if (signals.grayscalePercentage > 0.8) digitalScore += 30;
    if (signals.spotColorsCount > 0) offsetScore += 25;
    if (signals.avgTac < 120 && signals.grayscalePercentage > 0.4) digitalScore += 20;

    if (signals.hasMarks) offsetScore += 40;
    else digitalScore += 25;

    if (signals.hasConsistentBleed) offsetScore += 15;
    else digitalScore += 10;

    if (signals.hasLargeBackgrounds) offsetScore += 15;
    if (!signals.isPageUniform) digitalScore += 20;

    if (signals.dominantDpi >= 300) offsetScore += 15;
    if (signals.dominantDpi < 220 && signals.dominantDpi > 0) digitalScore += 25;
    if (signals.imageCompression === 'ZIP') offsetScore += 10;

    if (signals.hasKnockoutBlackText || signals.hasHairlines) offsetScore += 10;
    if (signals.hasSmallReversedText) offsetScore += 5;

    offsetScore = Math.min(100, offsetScore);
    digitalScore = Math.min(100, digitalScore);

    let intent = 'MIXED';
    let confidence = 0;

    if (offsetScore > 70 && offsetScore > digitalScore + 20) {
        intent = 'OFFSET';
        confidence = offsetScore;
    } else if (digitalScore > 70 && digitalScore > offsetScore + 20) {
        intent = 'DIGITAL';
        confidence = digitalScore;
    } else {
        intent = 'MIXED';
        confidence = Math.max(offsetScore, digitalScore, 50);
    }

    return { intent, confidence, offsetScore, digitalScore };
}

console.log("--- PRINT EDITION INTENT TEST CASES ---");
signalsList.forEach(test => {
    const res = inferEditionIntent(test.signals, 'coated');
    console.log(`\nTEST: ${test.name}`);
    console.log(`  Intent: ${res.intent}`);
    console.log(`  Confidence: ${res.confidence}%`);
    console.log(`  Offset Score: ${res.offsetScore}`);
    console.log(`  Digital Score: ${res.digitalScore}`);
});
console.log("\n--- TEST COMPLETE ---");
