# Developer Portal: Navigation Model

The navigation must be discoverable and hierarchical. There are 4 primary zones.

## 1. Top Navigation (Global)
- **Docs**: Main knowledge base.
- **API Reference**: Detailed endpoint documentation.
- **Cookbook**: Solution-based recipes.
- **Changelog**: Recent platform updates.
- **Status**: Platform availability.
- **API Playground**: link to interactive tester.

## 2. Sidebar Navigation (Contextual)

### Zone A: Getting Started
- Introduction
- Quickstart (5 min)
- Core Concepts
  - Policies & Configurations
  - Job Lifecycle
  - Asset Management

### Zone B: Integration Guides
- Printer ERP Guide
- Publisher Pipeline
- Agency Workflow

### Zone C: Reference
- Authentication & Errors
- Rate Limits
- Webhooks & Signatures
- Jobs API Reference
- Batches API Reference
- Analytics API Reference

### Zone D: Resources
- Official SDKs (Node, Python, PHP)
- Community Examples
- Postman Collection
- FAQs & Support

## 3. The "Jump To" (Cmd + K) Model
The search bar must support:
- `err:429` -> Instant link to Rate Limit docs.
- `/jobs` -> Instant link to Jobs API reference.
- `hmac` -> Instant link to Webhook Signature docs.

## 4. On-Page Table of Contents (Right Sidebar)
Every documentation page must have a right-hand "On this page" menu that highlights sections as the user scrolls.
