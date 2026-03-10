# Developer Portal: Visual Architecture

The Developer Portal (`developers.printprice.pro`) is the terminal for all external technical adoption. It must follow a "Low Friction / High Authority" design.

## 🏛️ Content Hierarchy

```mermaid
graph TD
    Home["Home (The Hook)"] --> GettingStarted["Getting Started (The 5-Min Win)"]
    Home --> APIRef["API Reference (The Source of Truth)"]
    Home --> SDKs["SDKs & Libraries (The Facilitators)"]
    Home --> Cookbook["Cookbook (Real-World Recipes)"]
    
    GettingStarted --> Quickstart["Quickstart (curl example)"]
    GettingStarted --> Auth["Auth & Security"]
    
    APIRef --> JobsAPI["Jobs API"]
    APIRef --> BatchesAPI["Batches API"]
    APIRef --> AnalyticsAPI["Analytics API"]
    
    Cookbook --> PrinterGuide["Printer ERP Flow"]
    Cookbook --> PubGuide["Publisher Batch Flow"]
    Cookbook --> AgencyGuide["Agency Feedback Loop"]
```

## 🎨 Visual Principles (Stripe/Vercel Style)

1. **The "Two-Column" API Reference**:
   - **Left**: Deep technical documentation, params, and descriptions.
   - **Right**: Live code snippets (Node, Python, PHP, Java) that change based on the selected endpoint.
   
2. **Interactive Quickstart**:
   - A hero section where a developer can paste their API Key and run a `curl` directly from the browser against a demo file.

3. **Status Banner**:
   - Global platform health status integrated into the header.

4. **"Copy-Paste" Friendly**:
   - Every code block must have a one-click copy button and a "Try in Postman/Insomnia" link.

## 🚦 Navigation Experience

- **Sticky Sidebar**: Nested navigation (Concepts -> API -> Guides -> Examples).
- **Global Command Bar (Cmd + K)**: Instant search for endpoints, error codes, and tutorials.
- **Contextual Help**: Hovering over API parameters shows a tool-tip with types, ranges, and validation rules.
