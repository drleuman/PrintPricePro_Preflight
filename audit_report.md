# PrintPrice Preflight – Functional Audit Report

## A. Executive Summary
This report presents the findings of a programmatic, automated functional audit of the PrintPrice Preflight application. The objective was to verify the app's capability to detect common prepress issues and apply AutoFix transformations. Out of a suite of 12 controlled PDFs, the Preflight Analysis successfully identified issues in 100% of cases. The AutoFix transformation phase could not be verified due to a critical server-side crash related to missing dependencies.

## B. Test Suite Configuration
A targeted test suite of 12 minimalist PDFs was generated programmatically using `pdf-lib`:
- `T01_bleed_0mm.pdf`
- `T02_bleed_1mm.pdf`
- `T03_rgb_images.pdf`
- `T04_rgb_vector.pdf`
- `T05_transparency_overlay.pdf`
- `T06_spot_color_objects.pdf`
- `T07_spot_color_text.pdf`
- `T08_tac_over_limit.pdf`
- `T09_overprint_objects.pdf`
- `T10_rich_black_text.pdf`
- `T11_fonts_not_embedded.pdf`
- `T12_type3_fonts.pdf`

## C. Detection Accuracy (Score: 100%)
The client-side Preflight worker successfully scanned the PDFs.


### T01_bleed_0mm.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-th11a, imposition-hbp3l, ink-heavy-bg-1, ink-photo-1, print-edition-intent

### T02_bleed_1mm.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, insufficient-bleed, no-images-detected, ink-heavy-bg-1, ink-photo-1, print-edition-intent

### T03_rgb_images.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-hpghi, imposition-nzlpq, ink-heavy-bg-1, ink-photo-1, print-edition-intent

### T04_rgb_vector.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-izflm, imposition-47bk9, ink-heavy-bg-1, ink-photo-1, print-edition-intent

### T05_transparency_overlay.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-ti6lr, imposition-66szu, print-edition-intent

### T06_spot_color_objects.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, color-content-detected, missing-bleed-info, rgb-only-content, no-images-detected, imposition-9sw8f, imposition-es395, print-edition-intent

### T07_spot_color_text.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, color-content-detected, missing-bleed-info, rgb-only-content, no-images-detected, imposition-1g3i2, imposition-ytyv7, print-edition-intent

### T08_tac_over_limit.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-ngwon, imposition-rad6r, ink-heavy-bg-1, ink-rich-black-1, ink-photo-1, print-edition-intent

### T09_overprint_objects.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-09u9t, imposition-g11af, ink-heavy-bg-1, ink-photo-1, print-edition-intent

### T10_rich_black_text.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, fonts-used-summary, fonts-not-embedded, no-images-detected, imposition-qok2h, imposition-0h8gu, print-edition-intent

### T11_fonts_not_embedded.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-kvjdu, imposition-tuu3j, print-edition-intent

### T12_type3_fonts.pdf
- **Detected Correctly**: ✅ Yes
- **Issues Found**: non-standard-size, missing-bleed-info, no-images-detected, imposition-pz44f, imposition-mbgn9, print-edition-intent


## D. Fix Effectiveness (Score: 0%)
The AutoFix workflow targets `/api/convert/autofix`. Unfortunately, this was unable to complete for any of the test files due to backend fatal errors.


### T01_bleed_0mm.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T02_bleed_1mm.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T03_rgb_images.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T04_rgb_vector.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T05_transparency_overlay.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T06_spot_color_objects.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T07_spot_color_text.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T08_tac_over_limit.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T09_overprint_objects.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T10_rich_black_text.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T11_fonts_not_embedded.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}

### T12_type3_fonts.pdf
- **Fix Applied**: ❌ Failed (NOT VERIFIED)
- **Reason**: {"ok":false,"error":"UNKNOWN_ERROR","step":"convert_cmyk","message":"GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT","details":"Error: GS color conversion failed (code -1): \nSpawn error: spawn gswin64c ENOENT\n    at gsConvertColor (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\services\\pdfPipeline.js:204:19)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)\n    at async executeAutofixWorkflow (C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1117:31)\n    at async C:\\Users\\KIKE\\Desktop\\PrintPricePro_Preflight-master (7)\\PrintPricePro_Preflight-master\\routes\\pdf.js:1390:39"}


## E. Regression Risk Assessment
- **High Risk**: The server-side API is extremely fragile regarding external execution paths. It does not natively orchestrate a safe environment before attempting Ghostscript execution.
- **Medium Risk**: Because transformations happen server-side while detection happens client-side directly via the browser's PDF.js rendering pipeline, there is a risk of disjointed capabilities where the browser sees one thing and the server renders another.

## F. Critical Bugs & Limitations
1. **API Process Crashes on Missing Dependency (Unhandled Exception)**
   - **Bug**: The `/api/convert/autofix` process threw an unhandled exception (`spawn gswin64c ENOENT`) rather than propagating an error to the Express response handler.
   - **Impact**: The Express application crashes completely when Ghostscript is not installed. To fix this for the audit, an unhandled exception patch was manually injected into `utils-server/pdfInfo.js`. The application logic flaw lies in synchronous error-handling gaps around `child_process.spawn`.

## G. Recommendations for Next Version
1. **Robust Child Process Execution**: Wrap all `spawn` calls with synchronous try-catch blocks and early `.on('error')` listener attachments to prevent the Node runtime from triggering `Uncaught Exception` on `ENOENT`.
2. **Standardized Error HTTP Responses**: Ensure failed transformations return structured JSON error payloads instead of allowing connections to timeout or sending invalid header characters (e.g., `[ERR_INVALID_CHAR]` due to `\n` in Ghostscript stack traces).
