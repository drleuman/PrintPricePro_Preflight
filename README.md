# PDF Preflight Check

**A product by Print Price Pro**  
**Author:** Dr. Leuman  
**Website:** [https://printprice.pro/](https://printprice.pro/)

## Overview

PDF Preflight Check is a web-based tool designed to help you preflight PDF files with a variety of checks and transformations. Whether you're ensuring the quality of a print-ready document or preparing it for conversion, this app provides essential preflight analysis for your PDF files. 

With features such as **grayscale conversion**, **RGB to CMYK transformation**, and **rebuilding PDFs with a minimum DPI**, this app is an indispensable tool for the print and publishing industry.

The app runs on a powerful worker architecture, capable of performing both client-side and server-side transformations. It integrates with the latest cloud technologies for scalability and reliability, ensuring seamless PDF transformations.

## Key Features

- **Run Preflight:** Analyze PDFs to detect common issues.
- **Grayscale Conversion:** Convert color documents to black & white (B/W) for cost-effective printing.
- **RGB → CMYK Conversion:** Convert RGB content to CMYK for print accuracy.
- **Rebuild ≥150 DPI:** Rebuild the PDF with a minimum of 150 DPI for optimal print quality.
- **Download Last PDF:** Store and download the most recent output PDF after any transformation.

## Technologies Used

- **React** - For building the user interface
- **Web Workers** - For offloading heavy tasks like PDF transformation
- **Node.js (Backend)** - For handling server-side operations and conversion tasks
- **Cloud Run** - For hosting and scaling the app
- **Ghostscript** - For PDF processing and transformations

## Installation

To run the app locally, follow these steps:

1. Clone the repository:

    ```bash
    git clone https://github.com/printprice-pro/pdf-preflight-check.git
    cd pdf-preflight-check
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Run the development server:

    ```bash
    npm start
    ```

4. Navigate to `http://localhost:3000` in your browser to access the app.

## Configuration

The app relies on **Ghostscript** for certain PDF transformations. Make sure the server or cloud environment has it installed.

### Dockerfile

If you are deploying the app in a Docker container, the `Dockerfile` is already configured to install all necessary dependencies, including Ghostscript.

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*
