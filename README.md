# RadReport - AI-Assisted Radiology Analysis

A browser-based radiology report generator that uses Claude claude-sonnet-4-6 to analyze medical images and produce structured clinical reports. Built as part of the Cotiviti AI internship challenge.

## How It Works

Upload a medical image (chest X-ray, CT scan, or MRI), paste your Anthropic API key, and click **Analyze Image**. Claude returns a structured report with four sections. Examination, Findings, Impression, and Recommendations. These are rendered directly in the browser.

## Running Locally

No installation required. Serve the files with Python:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

You will need an Anthropic API key from [console.anthropic.com](https://console.anthropic.com). The key is never stored. It lives only in your browser session.

## Repository Structure

```
├── index.html              # App UI and layout
├── app.js                  # All JavaScript logic
├── samples/                # Test radiology images
├── report/                 # Written challenge report
├── presentation/           # Slide deck
└── demo/                   # Demo video
```

## Disclaimer

For educational and research purposes only. Not for clinical use. All AI-generated reports require verification by a licensed radiologist.
