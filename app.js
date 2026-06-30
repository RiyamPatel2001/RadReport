'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let currentImageBase64 = null;
let currentMediaType   = null;
let lastReportText     = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const apiKeyInput      = document.getElementById('apiKeyInput');
const apiKeyToggle     = document.getElementById('apiKeyToggle');
const iconEye          = document.getElementById('iconEye');
const iconEyeOff       = document.getElementById('iconEyeOff');
const fileInput        = document.getElementById('fileInput');
const dropZone         = document.getElementById('dropZone');
const previewFrame     = document.getElementById('previewFrame');
const previewEmpty     = document.getElementById('previewEmpty');
const previewImg       = document.getElementById('previewImg');
const resetBtn         = document.getElementById('resetBtn');
const analyzeBtn       = document.getElementById('analyzeBtn');
const metaModality     = document.getElementById('metaModality');
const metaFileSize     = document.getElementById('metaFileSize');
const metaDimensions   = document.getElementById('metaDimensions');
const metaFormat       = document.getElementById('metaFormat');
const statusDot        = document.getElementById('statusDot');
const reportStatus     = document.getElementById('reportStatus');
const reportLive       = document.getElementById('reportLive');
const ghostOverlay     = document.getElementById('ghostOverlay');
const placeholderOverlay = document.querySelector('.placeholder-overlay');
const copyTextBtn      = document.getElementById('copyTextBtn');
const exportPdfBtn     = document.getElementById('exportPdfBtn');
const loadingSpinner   = document.getElementById('loadingSpinner');
const toastEl          = document.getElementById('toastEl');
const reportTimestamp  = document.getElementById('reportTimestamp');

// ── File input wiring ──────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

// ── Drag and drop ──────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

// ── Reset upload ───────────────────────────────────────────────────────────
resetBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  resetUpload();
});

// ── API key show/hide toggle ───────────────────────────────────────────────
apiKeyToggle.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  iconEye.style.display    = isPassword ? 'none'  : 'block';
  iconEyeOff.style.display = isPassword ? 'block' : 'none';
});

// ── Analyze ────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', analyzeImage);

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && currentImageBase64) {
    e.preventDefault();
    analyzeImage();
  }
});

// ── Export PDF ─────────────────────────────────────────────────────────────
exportPdfBtn.addEventListener('click', () => window.print());

// ── Copy Text ──────────────────────────────────────────────────────────────
copyTextBtn.addEventListener('click', () => {
  if (!lastReportText) return;
  navigator.clipboard.writeText(lastReportText).then(() => {
    const prev = copyTextBtn.textContent;
    copyTextBtn.textContent = 'Copied!';
    setTimeout(() => { copyTextBtn.textContent = prev; }, 2000);
  });
});

// ── Core: process a dropped/selected file ─────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function processFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast('Unsupported file type. Please upload a JPEG, PNG, or WebP image.');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const commaIdx = dataUrl.indexOf(',');
    currentImageBase64 = dataUrl.slice(commaIdx + 1);
    currentMediaType   = file.type;

    previewImg.src = dataUrl;
    previewImg.onload = () => {
      setMeta(metaDimensions, `${previewImg.naturalWidth} × ${previewImg.naturalHeight}`);
    };

    previewEmpty.style.display = 'none';
    previewImg.style.display   = 'block';
    resetBtn.style.display     = 'flex';
    previewFrame.classList.add('has-image');

    setMeta(metaModality, 'Image');
    setMeta(metaFileSize, formatBytes(file.size));
    setMeta(metaFormat,   file.type.split('/')[1].toUpperCase());

    analyzeBtn.disabled = false;
    analyzeBtn.classList.add('active');
    analyzeBtn.removeAttribute('aria-disabled');

    statusDot.classList.add('ready');
    reportStatus.textContent = 'Image ready — click Analyze';
  };

  reader.readAsDataURL(file);
}

// ── Reset upload to empty state ────────────────────────────────────────────
function resetUpload() {
  currentImageBase64 = null;
  currentMediaType   = null;

  previewImg.style.display   = 'none';
  previewImg.src             = '';
  previewEmpty.style.display = 'flex';
  resetBtn.style.display     = 'none';
  previewFrame.classList.remove('has-image');

  clearMeta(metaModality);
  clearMeta(metaFileSize);
  clearMeta(metaDimensions);
  clearMeta(metaFormat);

  analyzeBtn.disabled = true;
  analyzeBtn.classList.remove('active');
  analyzeBtn.setAttribute('aria-disabled', 'true');

  statusDot.classList.remove('ready');
  reportStatus.textContent = 'Awaiting image';

  fileInput.value = '';
}

// ── API call ───────────────────────────────────────────────────────────────
async function analyzeImage() {
  if (!currentImageBase64) {
    showError('No image loaded. Please upload a medical image first.');
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    apiKeyInput.focus();
    apiKeyInput.closest('.api-key-input-wrap').style.borderColor = '#e05252';
    setTimeout(() => {
      apiKeyInput.closest('.api-key-input-wrap').style.borderColor = '';
    }, 1800);
    return;
  }

  resetReportPanel();
  showLoadingState();

  analyzeBtn.disabled = true;
  analyzeBtn.classList.remove('active');
  analyzeBtn.textContent = 'Analyzing…';
  statusDot.classList.remove('ready');
  reportStatus.textContent = 'Analyzing image…';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: 'You are an expert radiologist with 20 years of clinical experience. Analyze the provided medical image and generate a structured radiology report following standard radiological reporting conventions. Your report must include these exact sections: Examination, Findings, Impression, and Recommendations. Be specific, use proper medical terminology, note any abnormalities with their location and severity, and always include a disclaimer that this is AI-generated and requires radiologist verification. Format your response in clean markdown.',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: currentMediaType,
                  data: currentImageBase64,
                },
              },
              {
                type: 'text',
                text: 'Please analyze this medical image and generate a radiology report.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reportText = data.content[0].text;
    lastReportText = reportText;
    hideLoadingState();
    renderReport(reportText);

    analyzeBtn.disabled = false;
    analyzeBtn.classList.add('active');
    analyzeBtn.textContent = 'Re-analyze';
    statusDot.classList.add('ready');
    reportStatus.textContent = 'Report generated';
    reportTimestamp.textContent = `Generated · ${new Date().toLocaleString()}`;
    reportTimestamp.style.display = 'block';

    copyTextBtn.disabled = false;
    copyTextBtn.classList.add('active');
    exportPdfBtn.disabled = false;
    exportPdfBtn.classList.add('active');

  } catch (err) {
    hideLoadingState();
    showError(err.message || 'An unexpected error occurred.');

    analyzeBtn.disabled = false;
    analyzeBtn.classList.add('active');
    analyzeBtn.textContent = 'Analyze Image';
    statusDot.classList.remove('ready');
    reportStatus.textContent = 'Analysis failed — try again';
  }
}

// ── Report panel: restore ghost state ─────────────────────────────────────
function resetReportPanel() {
  reportLive.style.display     = 'none';
  reportLive.innerHTML         = '';
  ghostOverlay.style.display   = '';
  placeholderOverlay.style.display = 'flex';
  lastReportText = null;

  copyTextBtn.disabled = true;
  copyTextBtn.classList.remove('active');
  exportPdfBtn.disabled = true;
  exportPdfBtn.classList.remove('active');
  reportTimestamp.style.display = 'none';
  reportTimestamp.textContent   = '';
}

// ── Loading state ──────────────────────────────────────────────────────────
function showLoadingState() {
  loadingSpinner.style.display     = 'flex';
  ghostOverlay.style.display       = 'none';
  placeholderOverlay.style.display = 'none';
  previewFrame.classList.add('scanning');
}

function hideLoadingState() {
  loadingSpinner.style.display = 'none';
  previewFrame.classList.remove('scanning');
}

// ── Error card ─────────────────────────────────────────────────────────────
function showError(message) {
  ghostOverlay.style.display       = 'none';
  placeholderOverlay.style.display = 'none';
  reportLive.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'error-card';
  card.innerHTML = `
    <svg class="error-card-icon" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 3L25.5 23H2.5L14 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M14 11V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="14" cy="20" r="0.8" fill="currentColor"/>
    </svg>
    <div class="error-card-title">Analysis Failed</div>
    <div class="error-card-message">${message}</div>
    <div class="error-card-hint">Check your API key and network connection, then try again.</div>
  `;

  reportLive.appendChild(card);
  reportLive.style.display       = 'flex';
  reportLive.style.flexDirection = 'column';
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3000);
}

// ── Markdown → DOM renderer ────────────────────────────────────────────────
function renderReport(text) {
  reportLive.innerHTML = '';

  let sectionCount    = 0;
  let currentContent  = null;
  let currentList     = null;
  let currentListType = null;

  function closeList() {
    currentList     = null;
    currentListType = null;
  }

  function ensureSection() {
    if (!currentContent) createSection('Note');
    return currentContent;
  }

  function createSection(title) {
    closeList();
    sectionCount++;

    const section = document.createElement('div');
    section.className = 'report-section';

    const hdr = document.createElement('div');
    hdr.className = 'report-section-header';

    const num = document.createElement('span');
    num.className   = 'section-number';
    num.textContent = String(sectionCount).padStart(2, '0');

    const titleEl = document.createElement('span');
    titleEl.className   = 'section-title';
    titleEl.textContent = title.toUpperCase();

    const divider = document.createElement('span');
    divider.className = 'section-divider';

    hdr.append(num, titleEl, divider);

    const content = document.createElement('div');
    content.className = 'section-content';

    section.append(hdr, content);
    reportLive.appendChild(section);
    currentContent = content;
  }

  function inlineFormat(raw) {
    return raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) { closeList(); continue; }
    if (/^#\s/.test(line))   continue;
    if (/^##\s+/.test(line)) { createSection(line.replace(/^##\s+/, '')); continue; }

    if (/^###\s+/.test(line)) {
      closeList();
      const sub = document.createElement('div');
      sub.className   = 'report-subheading';
      sub.textContent = line.replace(/^###\s+/, '');
      ensureSection().appendChild(sub);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const content = ensureSection();
      if (currentListType !== 'ul') {
        closeList();
        currentList = document.createElement('ul');
        currentList.className = 'report-ul';
        content.appendChild(currentList);
        currentListType = 'ul';
      }
      const li = document.createElement('li');
      li.className = 'report-li';
      li.innerHTML = inlineFormat(line.replace(/^[-*]\s+/, ''));
      currentList.appendChild(li);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const content = ensureSection();
      if (currentListType !== 'ol') {
        closeList();
        currentList = document.createElement('ol');
        currentList.className = 'report-ol';
        content.appendChild(currentList);
        currentListType = 'ol';
      }
      const li = document.createElement('li');
      li.className = 'report-li';
      li.innerHTML = inlineFormat(line.replace(/^\d+\.\s+/, ''));
      currentList.appendChild(li);
      continue;
    }

    closeList();
    const p = document.createElement('p');
    p.className = 'report-para';
    p.innerHTML = inlineFormat(line);
    ensureSection().appendChild(p);
  }

  ghostOverlay.style.display       = 'none';
  placeholderOverlay.style.display = 'none';
  reportLive.style.display         = 'flex';
}

// ── Helpers ────────────────────────────────────────────────────────────────
function setMeta(el, value) {
  el.textContent = value;
  el.classList.add('populated');
}

function clearMeta(el) {
  el.textContent = '—';
  el.classList.remove('populated');
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
