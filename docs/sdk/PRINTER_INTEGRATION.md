# Printer Integration Guide

This guide is designed for developers building or maintaining Print Shop ERPs (Enterprise Resource Planning) and production management systems.

## The Problem
ERP systems often manage order metadata perfectly, but the associated PDF files are often sent to the press without proper technical validation, leading to costly waste and delays.

## The Solution: The "Preflight-in-the-Middle" Flow

1. **ERP Capture**: When a customer uploads a file to your ERP, forward it immediately to PrintPrice.
2. **Automated Fix**: Use the `AUTOFIX` engine to resolve common issues (missing bleed, rich black, overprint) before a human ever looks at it.
3. **Status Sync**: Receive a webhook when the file is ready.
4. **Production Routing**: Only files with a `risk_score_after < 10` are allowed to proceed to the RIP (Raster Image Processor).

### Implementation Workflow

```javascript
// Example implementation in your ERP backend
const axios = require('axios');

async function processOrderFile(orderId, filePath) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('policy', 'OFFSET_CMYK_STRICT');

    const res = await axios.post('https://api.printprice.pro/api/v2/jobs', formData, {
        headers: {
            'Authorization': 'Bearer ppk_live_xxx',
            ...formData.getHeaders()
        }
    });

    // Save job_id to your database
    db.orders.update(orderId, { preflight_job_id: res.data.job_id });
}
```

## Benefits for Printers
- **Lower Labor Costs**: Automate 80% of routine prepress checks.
- **Reduced Waste**: Detect ink limit violations before the press runs.
- **Higher Throughput**: Files are fixed in seconds, not hours.
