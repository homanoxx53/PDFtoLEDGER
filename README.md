# PDFtoLedger

Turn PDF bank statements into categorised Excel spreadsheets in seconds.

## What it does

Upload a PDF bank statement → PDFtoLedger extracts every transaction, auto-categorises it (groceries, transport, bills, subscriptions, etc.), and lets you download a clean `.xlsx` file with a full spending breakdown.

## Features

- **PDF parsing** — reads text-based PDF statements from all major UK and US banks
- **Auto-categorisation** — 300+ merchant keywords across 16 spending categories
- **Editable categories** — change any transaction's category before downloading
- **Excel export** — Transactions sheet + Summary sheet with totals by category
- **Privacy-first** — everything runs client-side in the browser; no data is uploaded or stored
- **No signup required** — free tier works instantly with no account

## Tech stack

- Vanilla HTML / CSS / JavaScript (single file, no build step)
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF text extraction
- [SheetJS](https://sheetjs.com/) for Excel file generation

## Deploy

This is a static single-page site. Deploy anywhere:

**Vercel (recommended):**
1. Push this repo to GitHub
2. Import the repo in your Vercel dashboard
3. Deploy — no configuration needed

**Netlify:**
1. Drag and drop the project folder into Netlify's deploy area

**Any static host:**
1. Upload `index.html` — that's the entire site

## Project structure

```
PDFtoLedger/
└── index.html    # Complete application (HTML + CSS + JS)
```

## Supported banks

Works with digital PDF statements from: Barclays, HSBC, Lloyds, NatWest, Santander, Halifax, Nationwide, Monzo, Starling, Revolut, Chase UK, Metro Bank, TSB, Co-op Bank, Chase US, Bank of America, Wells Fargo, Citi, Capital One, US Bank, and more.

## Roadmap

- [ ] OCR support for scanned/image-based PDFs
- [ ] Learning dictionary via serverless backend
- [ ] AI-powered categorisation (Claude API)
- [ ] Batch upload for Pro users
- [ ] Custom category rules (persistent)
- [ ] API access for developers

## Licence

Copyright © 2026 PDFtoLedger. All rights reserved. This is proprietary software. See [LICENSE](LICENSE) for details.
