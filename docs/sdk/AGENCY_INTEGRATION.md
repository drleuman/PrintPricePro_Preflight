# Agency Integration Guide

Help your creative teams deliver production-ready files every time, without needing deep prepress knowledge.

## The "Designer Feedback" Loop

Most designers learn about file errors when the printer rejects the job. PrintPrice allows you to build a "Preflight-first" workflow directly into your agency portal or internal tools.

### 1. Instant Risk Score
When a designer uploads a draft to your project management tool, call the PrintPrice API and display the **Risk Score** immediately.

```json
{
  "job_id": "job_abc",
  "status": "SUCCEEDED",
  "metrics": {
    "risk_score_before": 85,
    "risk_score_after": 5,
    "hours_saved": 1.5
  }
}
```

### 2. Transparency with Clients
Show your clients the value you generate. Use the `hours_saved` and `risk_score_after` metrics to prove that you are delivering professional-grade, technical-compliant assets.

## Integration Strategies

### Option A: Internal Quality Gate
Automate the analysis of all outgoing creative assets. If a file has a Risk Score > 40, flag it for a senior production designer to review.

### Option B: Client-Facing portal
Embed the PrintPrice report link in your client proofing portal. This gives clients confidence that the file they are approving is technical "press-ready".

## Agency ROI
- **Protect Your Margins**: Avoid re-printing costs due to technical errors.
- **Professional Reputation**: Deliver files that printers love to receive.
- **Efficiency**: Junior designers can fix complex PDF issues with the "Autofix" engine.
