/* ═══════════════════════════════════════════════════════
   LandSecure 2.0 — Frontend Application Logic
   Decentralized Land Title, AI OCR & Fraud Detection
   ═══════════════════════════════════════════════════════ */

const API_BASE = (typeof window !== "undefined" && window.location.origin && window.location.origin.includes(":5000"))
  ? window.location.origin
  : "http://localhost:5000";

// Global App State
let allLands = [];
let currentUser = {
  email: "citizen@karnataka.gov.in",
  name: "Citizen User",
  role: "citizen",
  department: "General Citizen"
};
let currentLang = "en"; // "en" or "kn"
let leafletMap = null;
let mapParcelLayers = [];
let statusChartInstance = null;
let districtChartInstance = null;
let lastRegisteredLand = null;

// ──────────────────────────────────────────────
//  1. Navigation & View Switching
// ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initLanguage();
  initMap();
  initChecklist();
  initFAQ();
  initDropzone();
  fetchInitialData();
  setupFeeCalculatorInputs();
});

function initNavigation() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarClose = document.getElementById("sidebarCloseBtn");
  const overlay = document.getElementById("sidebarOverlay");
  const sidebar = document.getElementById("appSidebar");
  const main = document.querySelector(".app-main");

  function openSidebar() {
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("active");
  }

  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
  }

  function toggleSidebar() {
    if (window.innerWidth <= 992) {
      if (sidebar && sidebar.classList.contains("open")) {
        closeSidebar();
      } else {
        openSidebar();
      }
    } else {
      if (sidebar) sidebar.classList.toggle("collapsed");
      if (main) main.classList.toggle("expanded");
    }
  }

  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      if (section) switchView(section);
      if (window.innerWidth <= 992) {
        closeSidebar();
      }
    });
  });

  if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);
  if (sidebarClose) sidebarClose.addEventListener("click", closeSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);
}

function switchView(viewId) {
  // Update sidebar active states
  document.querySelectorAll(".sidebar-link").forEach((l) => l.classList.remove("active"));
  const activeLink = document.querySelector(`[data-section="${viewId}"]`);
  if (activeLink) activeLink.classList.add("active");

  // Update view sections
  document.querySelectorAll(".view-section").forEach((s) => s.classList.remove("active"));
  const targetSection = document.getElementById(viewId);
  if (targetSection) {
    targetSection.classList.add("active");
  }

  // Close mobile sidebar if open
  const sidebar = document.getElementById("appSidebar");
  if (sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
  }

  // Refresh or trigger map resize when map view is opened
  if (viewId === "map") {
    setTimeout(() => {
      if (leafletMap) leafletMap.invalidateSize();
    }, 200);
  }

  // Refresh data on switching to views
  if (viewId === "dashboard" || viewId === "lands" || viewId === "fraud" || viewId === "blockchain") {
    fetchInitialData();
  }
}

// ──────────────────────────────────────────────
//  2. Toast Notifications
// ──────────────────────────────────────────────

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toast.innerHTML = `<span style="font-weight:bold; font-size: 1.1rem;">${icons[type] || "ℹ"}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ──────────────────────────────────────────────
//  3. Fetch Data & Dashboard Render
// ──────────────────────────────────────────────

async function fetchInitialData() {
  try {
    const res = await fetch(`${API_BASE}/api/lands`);
    const data = await res.json();

    if (data.success) {
      allLands = data.lands || [];
      updateDashboardStats(allLands);
      renderRecentTable(allLands);
      renderAllLandsTable(allLands);
      populateOfficerDropdown(allLands);
      loadMapParcels(allLands);
      fetchAnalytics();
      fetchBlockchainExplorer();
    }
  } catch (err) {
    console.warn("Could not connect to backend, running offline fallback data:", err.message);
  }
}

async function fetchAnalytics() {
  try {
    const res = await fetch(`${API_BASE}/api/analytics/stats`);
    const data = await res.json();
    if (data.success && data.stats) {
      renderCharts(data.stats);
    }
  } catch (e) {
    // Render charts from local lands
    renderChartsFromLocal(allLands);
  }
}

function updateDashboardStats(lands) {
  const total = lands.length;
  const genuine = lands.filter((l) => l.status === "Registered").length;
  const flagged = lands.filter((l) => l.status === "Flagged for Fraud").length;
  const review = lands.filter((l) => l.status === "Under Review" || l.status === "Pending Verification").length;
  const onChain = lands.filter((l) => l.blockchainHash).length;

  animateCounter("statTotal", total);
  animateCounter("statGenuine", genuine);
  animateCounter("statFlagged", flagged);
  animateCounter("statReview", review);
  animateCounter("statBlockchain", onChain);

  const totalBadge = document.getElementById("badgeTotalLands");
  if (totalBadge) totalBadge.textContent = total;

  const flagBadge = document.getElementById("badgeFlaggedCount");
  if (flagBadge) flagBadge.textContent = flagged;
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  if (current === target) return;

  const duration = 600;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(current + (target - current) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ──────────────────────────────────────────────
//  4. Chart.js Dashboard Visualizations
// ──────────────────────────────────────────────

function renderCharts(stats) {
  const statusCtx = document.getElementById("statusChart")?.getContext("2d");
  const districtCtx = document.getElementById("districtChart")?.getContext("2d");

  if (statusCtx) {
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: ["Genuine (Registered)", "Flagged for Fraud", "Under Review"],
        datasets: [
          {
            data: [stats.genuine || 1, stats.flagged || 0, stats.underReview || 0],
            backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
            borderWidth: 2,
            borderColor: "#0c152e"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#94a3b8", font: { family: "Plus Jakarta Sans" } } }
        }
      }
    });
  }

  if (districtCtx) {
    if (districtChartInstance) districtChartInstance.destroy();
    const labels = (stats.byDistrict || []).map((d) => d.district);
    const counts = (stats.byDistrict || []).map((d) => d.count);

    districtChartInstance = new Chart(districtCtx, {
      type: "bar",
      data: {
        labels: labels.length ? labels : ["Bengaluru Urban", "Bengaluru Rural", "Mysuru"],
        datasets: [
          {
            label: "Total Applications",
            data: counts.length ? counts : [2, 1, 1],
            backgroundColor: "rgba(0, 212, 255, 0.6)",
            borderColor: "#00d4ff",
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
          y: { ticks: { color: "#94a3b8", precision: 0 }, grid: { color: "rgba(255,255,255,0.05)" } }
        }
      }
    });
  }
}

function renderChartsFromLocal(lands) {
  const genuine = lands.filter((l) => l.status === "Registered").length;
  const flagged = lands.filter((l) => l.status === "Flagged for Fraud").length;
  const review = lands.filter((l) => l.status === "Under Review").length;
  renderCharts({ genuine, flagged, underReview: review, byDistrict: [] });
}

// ──────────────────────────────────────────────
//  5. Table Renderers
// ──────────────────────────────────────────────

function renderRecentTable(lands) {
  const tbody = document.getElementById("recentTableBody");
  if (!tbody) return;

  if (lands.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-muted);">No records found. Register your first land title!</td></tr>`;
    return;
  }

  const recent = [...lands].reverse().slice(0, 6);
  tbody.innerHTML = recent
    .map(
      (land) => `
      <tr>
        <td><span class="id-badge">${land.landId}</span></td>
        <td style="font-weight: 600;">${land.surveyNumber}</td>
        <td>${land.location || land.district}</td>
        <td>${Number(land.area).toLocaleString()}</td>
        <td>${land.ownerName}</td>
        <td>${getStatusBadge(land.status)}</td>
        <td><span style="font-weight:700; color:${getRiskColor(land.fraudProbability)}">${land.fraudProbability || 0}%</span></td>
        <td>
          <button class="btn-preset" onclick="openCertificateModal('${land.landId}')" title="Certificate">📜</button>
          <button class="btn-preset" onclick="openTimelineForLand('${land.landId}')" title="Audit">⏱️</button>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderAllLandsTable(lands) {
  const tbody = document.getElementById("allLandsTableBody");
  if (!tbody) return;

  if (lands.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">No matching land records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...lands]
    .reverse()
    .map(
      (land) => `
      <tr>
        <td><span class="id-badge">${land.landId}</span></td>
        <td style="font-weight: 600;">${land.surveyNumber}</td>
        <td>${land.location} <span style="font-size:0.75rem; color:var(--text-muted);">(${land.district})</span></td>
        <td>${Number(land.area).toLocaleString()} sq.ft</td>
        <td>${land.ownerName}</td>
        <td><code style="font-size:0.75rem; color:var(--text-secondary);">${land.ownerId}</code></td>
        <td>${getStatusBadge(land.status)}</td>
        <td>
          ${
            land.blockchainHash
              ? `<span class="blockchain-tag">⛓️ On-Chain</span>`
              : `<span style="font-size:0.75rem; color:var(--text-muted);">Database</span>`
          }
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-preset" onclick="openCertificateModal('${land.landId}')" title="Title Certificate">📜</button>
            <button class="btn-preset" onclick="openTimelineForLand('${land.landId}')" title="Audit History">⏱️</button>
            <button class="btn-preset" onclick="focusOnMapParcel('${land.landId}')" title="View on Map">🗺️</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

function filterLandsTable() {
  const query = (document.getElementById("registrySearchInput")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("registryStatusFilter")?.value || "ALL";
  const districtFilter = document.getElementById("registryDistrictFilter")?.value || "ALL";

  const filtered = allLands.filter((land) => {
    const matchesSearch =
      !query ||
      land.landId.toLowerCase().includes(query) ||
      land.ownerName.toLowerCase().includes(query) ||
      land.surveyNumber.toLowerCase().includes(query) ||
      (land.location && land.location.toLowerCase().includes(query));

    const matchesStatus = statusFilter === "ALL" || land.status === statusFilter;
    const matchesDistrict = districtFilter === "ALL" || land.district === districtFilter;

    return matchesSearch && matchesStatus && matchesDistrict;
  });

  renderAllLandsTable(filtered);
}

document.getElementById("registrySearchInput")?.addEventListener("input", filterLandsTable);

// ──────────────────────────────────────────────
//  6. AI Smart Document Scanner & OCR Pre-check
// ──────────────────────────────────────────────

function initDropzone() {
  const dropzone = document.getElementById("regDropzone");
  const fileInput = document.getElementById("regFileInput");

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      handleFileUpload(fileInput.files[0]);
    }
  });
}

function handleFileUpload(file) {
  document.getElementById("regFileLabel").textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;

  const reader = new FileReader();
  reader.onload = (e) => {
    const textContent = e.target.result || "";
    document.getElementById("regDocumentText").value = textContent;
    runRegistrationOCRPreCheck(file.name, textContent);
  };
  reader.readAsText(file);
}

function fillRegisterPreset(type) {
  const idInput = document.getElementById("regLandId");
  const surveyInput = document.getElementById("regSurveyNumber");
  const areaInput = document.getElementById("regArea");
  const ownerInput = document.getElementById("regOwnerName");
  const ownerIdInput = document.getElementById("regOwnerId");
  const locationInput = document.getElementById("regLocation");
  const docTextInput = document.getElementById("regDocumentText");
  const fileLabel = document.getElementById("regFileLabel");

  if (type === "genuine") {
    idInput.value = `KA-BLR-${Math.floor(2000 + Math.random() * 800)}`;
    surveyInput.value = "452/3";
    areaInput.value = "1200";
    ownerInput.value = "Ravi Kumar";
    ownerIdInput.value = "AADHAAR-8901-2345-6789";
    locationInput.value = "Devanahalli, Bengaluru Rural";
    docTextInput.value = "KARNATAKA LAND TITLE DEED: Survey No: 452/3. Total area: 1200 sq.ft. Registered in favour of purchaser Ravi Kumar. Location: Devanahalli.";
    fileLabel.textContent = "Preset: Genuine_Sale_Deed_452_3.pdf";
    showToast("Loaded Genuine Deed preset (1,200 sq.ft & Sy 452/3)", "success");
  } else if (type === "mismatch") {
    idInput.value = `KA-BLR-${Math.floor(2000 + Math.random() * 800)}`;
    surveyInput.value = "452/3";
    areaInput.value = "1200"; // Form says 1200
    ownerInput.value = "Ravi Kumar";
    ownerIdInput.value = "AADHAAR-8901-2345-6789";
    locationInput.value = "Devanahalli, Bengaluru Rural";
    docTextInput.value = "KARNATAKA LAND TITLE DEED: Survey No: 452/3. Total extent: 1500 sq.ft. Vendor conveys property to Ravi Kumar."; // Deed says 1500!
    fileLabel.textContent = "Preset: Mismatched_Area_Deed.pdf";
    showToast("Loaded Mismatch preset: Form says 1,200 sq.ft, but Deed contains 1,500 sq.ft!", "error");
  } else if (type === "survey_diff") {
    idInput.value = `KA-BLR-${Math.floor(2000 + Math.random() * 800)}`;
    surveyInput.value = "452/3"; // Form says 452/3
    areaInput.value = "1200";
    ownerInput.value = "Ravi Kumar";
    ownerIdInput.value = "AADHAAR-8901-2345-6789";
    locationInput.value = "Devanahalli, Bengaluru Rural";
    docTextInput.value = "KARNATAKA LAND TITLE DEED: Survey No: 99/2. Extent: 1200 sq.ft. Purchaser: Ravi Kumar."; // Deed says 99/2!
    fileLabel.textContent = "Preset: Survey_Discrepancy_Deed.pdf";
    showToast("Loaded Survey Number Discrepancy preset (Form: 452/3, Deed: 99/2)", "error");
  }

  calculateFeePreview();
  runRegistrationOCRPreCheck(fileLabel.textContent, docTextInput.value);
}

function runRegistrationOCRPreCheck(fileName, rawText) {
  const formArea = Number(document.getElementById("regArea")?.value);
  const formSurvey = (document.getElementById("regSurveyNumber")?.value || "").trim();
  const formOwner = (document.getElementById("regOwnerName")?.value || "").trim();

  // Basic regex extract for instant client preview
  let extractedArea = null;
  const sqftMatch = rawText.match(/(\d{3,6})\s*(sq\.?\s*ft|sqft|square feet)/i);
  if (sqftMatch) extractedArea = parseInt(sqftMatch[1], 10);

  let extractedSurvey = null;
  const syMatch = rawText.match(/(?:survey\s*(?:no\.?|number)|sy\s*no\.?)\s*[:=-]?\s*([0-9]{1,4}(?:[\/\-][0-9]{1,3}[A-Za-z]?)?)/i);
  if (syMatch) extractedSurvey = syMatch[1].trim();

  const isAreaMismatch = extractedArea && formArea && Math.abs(extractedArea - formArea) > 5;
  const isSurveyMismatch = extractedSurvey && formSurvey && extractedSurvey.toLowerCase() !== formSurvey.toLowerCase();

  const container = document.getElementById("ocrPreCheckContent");
  if (!container) return;

  if (!rawText) {
    container.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted);">No document uploaded yet.</div>`;
    return;
  }

  const hasIssues = isAreaMismatch || isSurveyMismatch;

  container.innerHTML = `
    <div class="ocr-panel ${hasIssues ? "mismatch-alert" : "verified"}">
      <div class="ocr-item">
        <span class="ocr-key">File Analyzed:</span>
        <span class="ocr-val">${fileName}</span>
      </div>
      <div class="ocr-item">
        <span class="ocr-key">Claimed Area vs Deed:</span>
        <span class="ocr-val ${isAreaMismatch ? "highlight-diff" : ""}">
          ${formArea || "?"} sq.ft vs ${extractedArea ? extractedArea + " sq.ft" : "Not detected"}
        </span>
      </div>
      <div class="ocr-item">
        <span class="ocr-key">Survey No. Match:</span>
        <span class="ocr-val ${isSurveyMismatch ? "highlight-diff" : ""}">
          ${formSurvey || "?"} vs ${extractedSurvey || "Not detected"}
        </span>
      </div>
      <div class="mismatch-banner ${hasIssues ? "danger" : "success"}">
        <span>${hasIssues ? "⚠️" : "✅"}</span>
        <div>
          ${
            hasIssues
              ? `<strong>Discrepancy Detected!</strong> ${isAreaMismatch ? `Area in form (${formArea} sq.ft) differs from deed extract (${extractedArea} sq.ft). ` : ""}${isSurveyMismatch ? `Survey number in form (${formSurvey}) does not match deed (${extractedSurvey}). ` : ""}This application will be flagged for officer review.`
              : `<strong>Consistent Document:</strong> Extracted particulars match form inputs perfectly.`
          }
        </div>
      </div>
    </div>
  `;
}

// Standalone Document Scanner Lab (`#scanner`)
function setScannerPreset(mode) {
  const areaInput = document.getElementById("scanClaimedArea");
  const syInput = document.getElementById("scanClaimedSurvey");
  const ownerInput = document.getElementById("scanClaimedOwner");
  const textInput = document.getElementById("scanDocumentText");

  if (mode === "genuine") {
    areaInput.value = "1200";
    syInput.value = "452/3";
    ownerInput.value = "Ravi Kumar";
    textInput.value = "ABSOLUTE SALE DEED: In Bengaluru. Sy No: 452/3. Total extent: 1200 sq ft conveyed to purchaser Ravi Kumar.";
  } else if (mode === "area_mismatch") {
    areaInput.value = "1200";
    syInput.value = "452/3";
    ownerInput.value = "Ravi Kumar";
    textInput.value = "ABSOLUTE SALE DEED: In Bengaluru. Sy No: 452/3. Total extent: 1500 sq ft conveyed to purchaser Ravi Kumar.";
  } else if (mode === "survey_mismatch") {
    areaInput.value = "1200";
    syInput.value = "452/3";
    ownerInput.value = "Ravi Kumar";
    textInput.value = "ABSOLUTE SALE DEED: In Bengaluru. Sy No: 99/2. Total extent: 1200 sq ft conveyed to purchaser Ravi Kumar.";
  }
}

async function runDocumentScannerTest() {
  const claimedArea = document.getElementById("scanClaimedArea").value;
  const claimedSurvey = document.getElementById("scanClaimedSurvey").value;
  const claimedOwner = document.getElementById("scanClaimedOwner").value;
  const rawText = document.getElementById("scanDocumentText").value;

  try {
    const res = await fetch(`${API_BASE}/api/documents/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: claimedArea,
        surveyNumber: claimedSurvey,
        ownerName: claimedOwner,
        rawText
      })
    });

    const data = await res.json();
    const output = document.getElementById("scannerResultsOutput");
    output.style.display = "block";

    if (data.success && data.analysis) {
      const a = data.analysis;
      output.innerHTML = `
        <div class="ocr-result-grid">
          <div class="ocr-panel">
            <h4 style="color:var(--cyan); margin-bottom:12px;">📋 Claimed Form Inputs</h4>
            <div class="ocr-item"><span class="ocr-key">Area:</span><span class="ocr-val">${claimedArea} sq.ft</span></div>
            <div class="ocr-item"><span class="ocr-key">Survey Number:</span><span class="ocr-val">${claimedSurvey}</span></div>
            <div class="ocr-item"><span class="ocr-key">Owner:</span><span class="ocr-val">${claimedOwner}</span></div>
          </div>

          <div class="ocr-panel ${a.mismatchDetected ? "mismatch-alert" : "verified"}">
            <h4 style="color:${a.mismatchDetected ? "var(--danger)" : "var(--success)"}; margin-bottom:12px;">
              ${a.mismatchDetected ? "⚠️ OCR Discrepancies Detected" : "✅ OCR Verification Passed"}
            </h4>
            <div class="ocr-item"><span class="ocr-key">Extracted Area:</span><span class="ocr-val ${a.mismatches.some((m) => m.field === "area") ? "highlight-diff" : ""}">${a.extractedArea ? a.extractedArea + " sq.ft" : "—"}</span></div>
            <div class="ocr-item"><span class="ocr-key">Extracted Survey:</span><span class="ocr-val ${a.mismatches.some((m) => m.field === "surveyNumber") ? "highlight-diff" : ""}">${a.extractedSurvey || "—"}</span></div>
            <div class="ocr-item"><span class="ocr-key">Extracted Owner:</span><span class="ocr-val">${a.extractedOwner || "—"}</span></div>
            <div class="ocr-item"><span class="ocr-key">SHA-256 Hash:</span><span class="hash-text" style="font-size:0.7rem;">${a.fileHash.substring(0, 24)}...</span></div>
          </div>
        </div>

        <div class="mismatch-banner ${a.mismatchDetected ? "danger" : "success"}" style="margin-top:16px;">
          <span>${a.mismatchDetected ? "🚩" : "✓"}</span>
          <div>${a.summary}</div>
        </div>
      `;
    }
  } catch (err) {
    showToast("Error running OCR scan: " + err.message, "error");
  }
}

async function runBlockchainTamperCheck() {
  const landId = document.getElementById("verifyTamperLandId").value;
  const mode = document.getElementById("tamperTestMode").value;

  const targetLand = allLands.find((l) => l.landId === landId);
  if (!targetLand) {
    showToast("Please choose a valid registered land record", "error");
    return;
  }

  let hashToVerify = targetLand.primaryDocumentHash || targetLand.blockchainHash || "0x3a9f0001";
  if (mode === "tampered") {
    // Intentionally alter characters in hash
    hashToVerify = "0x" + "deadbeef" + hashToVerify.slice(10);
  }

  try {
    const res = await fetch(`${API_BASE}/api/documents/verify-integrity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        landId,
        providedHash: hashToVerify
      })
    });

    const data = await res.json();
    const output = document.getElementById("tamperCheckOutput");
    output.style.display = "block";

    if (data.success && data.verification) {
      const v = data.verification;
      output.innerHTML = `
        <div class="mismatch-banner ${v.verified ? "success" : "danger"}">
          <span style="font-size:1.8rem;">${v.verified ? "✅" : "❌"}</span>
          <div>
            <h4 style="margin-bottom:4px;">${v.verified ? "Document Integrity Verified on Blockchain" : "CRITICAL ALERT: Document Tampering Detected!"}</h4>
            <p>${v.message}</p>
            <div style="margin-top:10px; font-family:var(--font-mono); font-size:0.76rem;">
              <div>On-Chain Hash: <span class="hash-text">${v.onChainHash}</span></div>
              <div>Checked Hash:  <span class="hash-text" style="color:${v.verified ? "var(--cyan)" : "var(--danger)"}">${v.uploadedHash}</span></div>
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    showToast("Verification failed: " + err.message, "error");
  }
}

// ──────────────────────────────────────────────
//  7. Register Land Form Submit
// ──────────────────────────────────────────────

document.getElementById("landRegisterForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("btnSubmitRegistration");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span>⏳</span> Processing AI Screening & Blockchain Anchor...`;

  const landId = document.getElementById("regLandId").value.trim();
  const surveyNumber = document.getElementById("regSurveyNumber").value.trim();
  const district = document.getElementById("regDistrict").value;
  const location = document.getElementById("regLocation").value.trim();
  const area = Number(document.getElementById("regArea").value);
  const transactionType = document.getElementById("regTxType").value;
  const ownerName = document.getElementById("regOwnerName").value.trim();
  const ownerId = document.getElementById("regOwnerId").value.trim();
  const ownerEmail = document.getElementById("regOwnerEmail").value.trim();
  const documentText = document.getElementById("regDocumentText").value;

  const payload = {
    landId,
    surveyNumber,
    district,
    location,
    area,
    transactionType,
    ownerName,
    ownerId,
    ownerEmail,
    documentText
  };

  try {
    const res = await fetch(`${API_BASE}/api/lands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, "success");
      lastRegisteredLand = data.land;

      // Reveal Post-Submit card
      const postCard = document.getElementById("postSubmitResultCard");
      postCard.style.display = "block";

      const verdictEl = document.getElementById("postResultVerdict");
      verdictEl.textContent = `${data.land.status} (ML Score: ${data.mlResult.fraud_probability}%)`;
      verdictEl.style.color = data.land.status === "Registered" ? "var(--success)" : "var(--danger)";

      document.getElementById("postResultTxHash").textContent = data.blockchain.transactionHash || "Anchored";

      // Refresh lands registry
      fetchInitialData();
    } else {
      showToast(data.message || "Registration failed", "error");
    }
  } catch (err) {
    showToast("Error submitting registration: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

function viewCertificateFromLastSubmit() {
  if (lastRegisteredLand) {
    openCertificateModal(lastRegisteredLand.landId);
  }
}

function viewTimelineFromLastSubmit() {
  if (lastRegisteredLand) {
    openTimelineForLand(lastRegisteredLand.landId);
  }
}

// ──────────────────────────────────────────────
//  8. AI Fraud Risk Center & Review
// ──────────────────────────────────────────────

function populateOfficerDropdown(lands) {
  const select = document.getElementById("reviewSelectLand");
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose Application to Inspect --</option>';

  lands.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l.landId;
    opt.textContent = `${l.landId} - Sy ${l.surveyNumber} (${l.ownerName}) [${l.status}]`;
    select.appendChild(opt);
  });

  // Pick first flagged or review land by default
  const flagged = lands.find((l) => l.status === "Flagged for Fraud" || l.status === "Under Review");
  if (flagged) {
    select.value = flagged.landId;
    loadLandForOfficerReview(flagged.landId);
  } else if (lands.length) {
    select.value = lands[0].landId;
    loadLandForOfficerReview(lands[0].landId);
  }
}

function loadLandForOfficerReview(landId) {
  if (!landId) return;
  const land = allLands.find((l) => l.landId === landId);
  if (!land) return;

  const score = land.fraudProbability || 5;
  const dial = document.getElementById("fraudRiskDial");
  const pctEl = document.getElementById("fraudDialPct");
  const verdictEl = document.getElementById("fraudDialVerdict");
  const confEl = document.getElementById("fraudDialConfidence");

  pctEl.textContent = `${score}%`;
  dial.style.setProperty("--gauge-pct", score);

  let gaugeColor = "#10b981";
  let verdictText = "LOW RISK";
  let verdictClass = "genuine";

  if (score >= 60) {
    gaugeColor = "#ef4444";
    verdictText = "HIGH RISK / FLAGGED";
    verdictClass = "fraud";
  } else if (score >= 30) {
    gaugeColor = "#f59e0b";
    verdictText = "MEDIUM RISK / REVIEW";
    verdictClass = "review";
  }

  dial.style.setProperty("--gauge-color", gaugeColor);
  verdictEl.textContent = verdictText;
  verdictEl.className = `risk-verdict-tag ${verdictClass}`;
  confEl.textContent = `Model Confidence: ${land.fraudDetails?.confidence || 94.5}%`;

  // Update Status Pill
  const statusBadge = document.getElementById("officerSelectedLandStatus");
  if (statusBadge) {
    statusBadge.textContent = land.status;
    statusBadge.className = `status-badge ${getStatusBadgeClass(land.status)}`;
  }

  // Update Factor breakdown cards
  const factors = land.fraudDetails?.factors || {};
  updateFactorCard("factorArea", factors.areaAnomaly, "High discrepancy in land extent", "Within standard revenue bounds");
  updateFactorCard("factorId", !factors.idValid, "Aadhaar/PAN format incomplete", "Government ID validated");
  updateFactorCard("factorSurvey", !factors.surveyValid, "Unrecognized cadastral survey number", "Valid survey sub-division");
  updateFactorCard("factorDocs", !factors.documentComplete, "Missing mandatory deeds", "Required deeds present");
  updateFactorCard("factorOCR", factors.ocrMismatch, "Discrepancy between form and deed", "OCR matches form inputs");
}

function updateFactorCard(elementId, isBad, badText, goodText) {
  const card = document.getElementById(elementId);
  if (!card) return;
  const statusEl = card.querySelector(".factor-status");
  if (isBad) {
    card.classList.remove("passed");
    card.classList.add("flagged");
    if (statusEl) statusEl.textContent = badText;
  } else {
    card.classList.remove("flagged");
    card.classList.add("passed");
    if (statusEl) statusEl.textContent = goodText;
  }
}

async function submitOfficerDecision(decision) {
  const landId = document.getElementById("reviewSelectLand")?.value;
  const remarks = document.getElementById("officerRemarks")?.value || "";

  if (!landId) {
    showToast("Please choose an application first", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/lands/${landId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        officerName: currentUser.name || "Officer S. Patil",
        role: currentUser.role || "officer",
        remarks
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, "success");
      fetchInitialData();
    } else {
      showToast(data.message || "Failed to update review", "error");
    }
  } catch (e) {
    showToast("Error updating review: " + e.message, "error");
  }
}

// ──────────────────────────────────────────────
//  9. Interactive Cadastral Map (Leaflet)
// ──────────────────────────────────────────────

function initMap() {
  const mapEl = document.getElementById("leafletMapContainer");
  if (!mapEl) return;

  // Center on Bengaluru / Karnataka
  leafletMap = L.map("leafletMapContainer").setView([13.0827, 77.5877], 11);

  // CartoDB Dark Matter tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &bull; LandSecure Karnataka',
    maxZoom: 19
  }).addTo(leafletMap);
}

function loadMapParcels(lands) {
  if (!leafletMap) return;

  // Clear existing layers
  mapParcelLayers.forEach((layer) => leafletMap.removeLayer(layer));
  mapParcelLayers = [];

  lands.forEach((land) => {
    if (!land.coordinates) return;

    const lat = land.coordinates.lat || 13.0827;
    const lng = land.coordinates.lng || 77.5877;
    const polyCoords = land.coordinates.polygon || [];

    let color = "#10b981"; // green
    if (land.status === "Flagged for Fraud") color = "#ef4444";
    else if (land.status === "Under Review") color = "#f59e0b";

    let layer;

    if (polyCoords.length >= 3) {
      const latLngs = polyCoords.map((p) => [p.lat, p.lng]);
      layer = L.polygon(latLngs, {
        color: color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.35
      }).addTo(leafletMap);
    } else {
      // Circle marker fallback
      layer = L.circle([lat, lng], {
        radius: 200,
        color: color,
        fillColor: color,
        fillOpacity: 0.4
      }).addTo(leafletMap);
    }

    const popupContent = `
      <div style="font-family:'Plus Jakarta Sans', sans-serif; min-width:180px;">
        <h4 style="margin:0 0 4px 0; color:#0f172a;">${land.landId} &bull; Sy ${land.surveyNumber}</h4>
        <div style="font-size:12px; color:#64748b; margin-bottom:6px;">${land.location}</div>
        <div style="font-size:12px;"><strong>Owner:</strong> ${land.ownerName}</div>
        <div style="font-size:12px;"><strong>Extent:</strong> ${Number(land.area).toLocaleString()} sq.ft</div>
        <div style="margin-top:8px;">
          <span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; color:#fff; background:${color}">
            ${land.status}
          </span>
        </div>
      </div>
    `;

    layer.bindPopup(popupContent);
    layer._landData = land;
    mapParcelLayers.push(layer);
  });
}

function searchMapParcel() {
  const query = (document.getElementById("mapSurveySearchInput")?.value || "").toLowerCase().trim();
  if (!query) {
    showToast("Enter a survey number to locate", "info");
    return;
  }

  const foundLayer = mapParcelLayers.find((layer) => {
    const data = layer._landData;
    return (
      data &&
      (data.surveyNumber.toLowerCase().includes(query) ||
        data.landId.toLowerCase().includes(query))
    );
  });

  if (foundLayer && leafletMap) {
    const bounds = foundLayer.getBounds ? foundLayer.getBounds() : L.latLngBounds([foundLayer.getLatLng()]);
    leafletMap.fitBounds(bounds, { maxZoom: 15, padding: [40, 40] });
    foundLayer.openPopup();
    showToast(`Located Parcel Sy ${foundLayer._landData.surveyNumber}`, "success");
  } else {
    showToast(`No parcel found matching survey "${query}"`, "error");
  }
}

function resetMapView() {
  if (leafletMap) {
    leafletMap.setView([13.0827, 77.5877], 11);
  }
}

function focusOnMapParcel(landId) {
  switchView("map");
  setTimeout(() => {
    const foundLayer = mapParcelLayers.find((l) => l._landData && l._landData.landId === landId);
    if (foundLayer && leafletMap) {
      const bounds = foundLayer.getBounds ? foundLayer.getBounds() : L.latLngBounds([foundLayer.getLatLng()]);
      leafletMap.fitBounds(bounds, { maxZoom: 15, padding: [40, 40] });
      foundLayer.openPopup();
    }
  }, 300);
}

// ──────────────────────────────────────────────
//  10. Blockchain Explorer
// ──────────────────────────────────────────────

async function fetchBlockchainExplorer() {
  try {
    const res = await fetch(`${API_BASE}/api/blockchain/explorer`);
    const data = await res.json();
    if (data.success && data.explorer) {
      const exp = data.explorer;
      document.getElementById("expCurrentBlock").textContent = `#${exp.currentBlock || 1422}`;
      document.getElementById("expNetwork").textContent = exp.network;
      document.getElementById("lblNodeStatus").textContent = exp.isConnected ? "Hardhat Node Online" : "Cryptographic Ledger Active";
      document.getElementById("lblBlockHeight").textContent = `Block #${exp.currentBlock} • Synced`;

      renderExplorerTable(exp.transactions || []);
    }
  } catch (e) {
    // fallback
    renderExplorerTable([
      { blockNumber: 1422, type: "REGISTRATION", landId: "KA-BLR-1004", txHash: "0x7a8b...1422", ownerName: "TechCorp", timestamp: new Date().toISOString() },
      { blockNumber: 1421, type: "REGISTRATION", landId: "KA-MYS-1003", txHash: "0x8901...1421", ownerName: "Anand Murthy", timestamp: new Date().toISOString() },
      { blockNumber: 1420, type: "FLAGGED_RISK", landId: "KA-BLR-1002", txHash: "0x3412...1420", ownerName: "Priya C", timestamp: new Date().toISOString() },
      { blockNumber: 1419, type: "REGISTRATION", landId: "KA-BLR-1001", txHash: "0x12ef...1419", ownerName: "Ramesh Gowda", timestamp: new Date().toISOString() }
    ]);
  }
}

function renderExplorerTable(txs) {
  const tbody = document.getElementById("explorerTableBody");
  if (!tbody) return;

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No blockchain transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = txs
    .map(
      (tx) => `
      <tr>
        <td><span class="id-badge">#${tx.blockNumber}</span></td>
        <td><span class="blockchain-tag">${tx.type}</span></td>
        <td style="font-weight:600;">${tx.landId}</td>
        <td><span class="hash-text">${tx.txHash ? tx.txHash.substring(0, 18) + "..." : "0x3a9f..."}</span></td>
        <td>${tx.ownerName || tx.newOwnerName || "System"}</td>
        <td>${formatDate(tx.timestamp)}</td>
      </tr>
    `
    )
    .join("");
}

// ──────────────────────────────────────────────
//  11. Audit & Ownership Timeline
// ──────────────────────────────────────────────

function openTimelineForLand(landId) {
  switchView("timeline");
  const input = document.getElementById("timelineSearchId");
  if (input) input.value = landId;
  loadAuditTimelineForParcel(landId);
}

function loadAuditTimelineForParcel(specificId) {
  const landId = specificId || (document.getElementById("timelineSearchId")?.value || "").trim();
  const land = allLands.find((l) => l.landId.toLowerCase() === landId.toLowerCase());
  const container = document.getElementById("timelineContainerArea");

  if (!land) {
    container.innerHTML = `<div style="padding:20px; color:var(--danger);">Land ID "${landId}" not found in system.</div>`;
    return;
  }

  const events = land.auditTimeline || [];

  container.innerHTML = `
    <div style="background:var(--bg-surface); padding:16px 20px; border-radius:12px; margin-bottom:20px; border:1px solid var(--border);">
      <h3 style="color:var(--cyan); margin-bottom:4px;">Parcel: ${land.landId} (Sy ${land.surveyNumber})</h3>
      <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Owner: <strong>${land.ownerName}</strong> &bull; Extent: <strong>${Number(land.area).toLocaleString()} sq.ft</strong> &bull; Status: ${getStatusBadge(land.status)}</p>
    </div>

    <div class="timeline-container">
      ${
        events.length
          ? events
              .map(
                (ev) => `
          <div class="timeline-event">
            <div class="timeline-dot ${getTimelineDotClass(ev.status)}">
              ${ev.status === "Mismatch Flagged" || ev.status === "FRAUD" ? "⚠️" : "✓"}
            </div>
            <div class="timeline-card">
              <div class="timeline-title-row">
                <span class="timeline-stage">${ev.stage}</span>
                <span class="timeline-time">${formatDate(ev.timestamp)}</span>
              </div>
              <div class="timeline-actor">${ev.actionBy} (${ev.role || "Official"})</div>
              <div class="timeline-notes">${ev.notes}</div>
            </div>
          </div>
        `
              )
              .join("")
          : `<p style="color:var(--text-muted);">No timeline events recorded yet.</p>`
      }
    </div>
  `;
}

function getTimelineDotClass(status) {
  if (status === "Mismatch Flagged" || status === "FRAUD" || status === "Flagged for Fraud") return "danger";
  if (status === "Immutable On-Chain" || status === "Verified") return "purple";
  return "success";
}

// ──────────────────────────────────────────────
//  12. Smart Government Document Checklist
// ──────────────────────────────────────────────

const checklistDatabase = {
  sale: [
    { title: "Original Title Deed / Sale Deed (ಮೂಲ ಖರೀದಿ ಪತ್ರ)", req: "mandatory", desc: "Proof of title conveyance registered in Kaveri Sub-Registrar office.", ref: "Registration Act 1908, Sec 17" },
    { title: "Bhoomi RTC / Pahani Extract (ಪಹಣಿ ಪತ್ರ)", req: "mandatory", desc: "Updated Record of Rights, Tenancy, and Crops showing current landholder column 9 & 12.", ref: "Karnataka Land Revenue Act 1964, Sec 128" },
    { title: "Nil-Encumbrance Certificate (EC Form 15) (ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರ)", req: "mandatory", desc: "Demonstrates 15+ years of encumbrance-free title.", ref: "Kaveri 2.0 Digital EC" },
    { title: "Mojini 11E Survey Sketch (ಮೋಜಣಿ ಸರ್ವೆ ನಕ್ಷೆ)", req: "mandatory", desc: "Mandatory digitized cadastral sub-division sketch approved by Revenue Surveyor.", ref: "Revenue Dept Circular 2023" },
    { title: "Identity Proof (Aadhaar & PAN) (ಗುರುತಿನ ಚೀಟಿ)", req: "mandatory", desc: "Verified biometrically or OTP-authenticated for both buyer and seller.", ref: "UIDAI e-KYC" }
  ],
  gift: [
    { title: "Gift Deed in Stamp Paper (ದಾನ ಪತ್ರ)", req: "mandatory", desc: "Executed in favour of immediate family member without monetary consideration.", ref: "Karnataka Stamp Act, Article 28" },
    { title: "RTC Pahani Extract (ಪಹಣಿ)", req: "mandatory", desc: "Reflecting current titleholder donor name.", ref: "Bhoomi Portal" },
    { title: "Genealogy Tree (Vamsha Vruksha) (ವಂಶವೃಕ್ಷ)", req: "mandatory", desc: "Attested by Village Accountant or Tahsildar proving blood relation.", ref: "Revenue Rules" },
    { title: "Encumbrance Certificate (EC)", req: "optional", desc: "Verifying absence of pending bank mortgages on the gifted extent.", ref: "Sub-Registrar" }
  ],
  inheritance: [
    { title: "Death Certificate of Deceased Khatedar (ಮರಣ ಪ್ರಮಾಣಪತ್ರ)", req: "mandatory", desc: "Issued by Municipal / Gram Panchayat Registrar of Births & Deaths.", ref: "Registration of Births Act 1969" },
    { title: "Attested Family Tree (ವಾರಸುದಾರಿಕೆ ವಂಶವೃಕ್ಷ)", req: "mandatory", desc: "Approved by Tahsildar after public 30-day notice period.", ref: "Karnataka Land Revenue Act Sec 128" },
    { title: "Surviving Legal Heirs Consent (ಸಮ್ಮತಿ ಪತ್ರ)", req: "mandatory", desc: "NOC or consent affidavit from all surviving children and spouse.", ref: "Civil Code" },
    { title: "RTC / Pahani Extract (ಪಹಣಿ)", req: "mandatory", desc: "Original RTC under deceased person's Khata.", ref: "Bhoomi" }
  ],
  partition: [
    { title: "Family Partition Deed (ವಿಭಾಗ ಪತ್ರ)", req: "mandatory", desc: "Mutual agreement partitioning ancestral property between co-parceners.", ref: "Hindu Succession Act" },
    { title: "11E Mojini Sketch for Each Share (ಪ್ರತ್ಯೇಕ ಮೋಜಣಿ ನಕ್ಷೆ)", req: "mandatory", desc: "Independent survey sub-division sketches for each demarcated share.", ref: "Mojini Portal" },
    { title: "Joint RTC Extract (ಜಂಟಿ ಪಹಣಿ)", req: "mandatory", desc: "Showing joint ownership prior to partition.", ref: "Bhoomi" }
  ]
};

function initChecklist() {
  renderGovernmentChecklist();
}

function renderGovernmentChecklist() {
  const type = document.getElementById("chkTxType")?.value || "sale";
  const items = checklistDatabase[type] || checklistDatabase.sale;
  const container = document.getElementById("checklistItemsList");
  if (!container) return;

  container.innerHTML = items
    .map(
      (item, idx) => `
      <div class="checklist-item">
        <input type="checkbox" class="checklist-checkbox" id="chk_${idx}" onchange="updateChecklistProgress()">
        <div class="checklist-info">
          <div class="checklist-title">
            <span>${item.title}</span>
            <span class="checklist-req ${item.req}">${item.req}</span>
          </div>
          <div class="checklist-desc">${item.desc}</div>
          <div class="checklist-ref">Statutory Source: ${item.ref}</div>
        </div>
      </div>
    `
    )
    .join("");

  updateChecklistProgress();
}

function updateChecklistProgress() {
  const total = document.querySelectorAll(".checklist-checkbox").length;
  const checked = document.querySelectorAll(".checklist-checkbox:checked").length;
  const ratioEl = document.getElementById("chkCompletedRatio");
  if (ratioEl) ratioEl.textContent = `${checked} of ${total} Ready`;
}

// ──────────────────────────────────────────────
//  13. Registration Fee Estimator
// ──────────────────────────────────────────────

function setupFeeCalculatorInputs() {
  calculateGovFees();
}

function calculateGovFees() {
  const extent = Number(document.getElementById("feeArea")?.value || 1200);
  const rate = Number(document.getElementById("feeGuidanceRate")?.value || 2500);
  const consideration = Number(document.getElementById("feeConsideration")?.value || 3000000);
  const jurisdiction = document.getElementById("feeJurisdiction")?.value || "bbmp";

  const guidanceVal = extent * rate;
  const taxableVal = Math.max(guidanceVal, consideration);

  // Karnataka Stamp Act rates
  let dutyPct = 0.05; // 5%
  let cessPct = 0.10; // 10% of stamp duty

  if (jurisdiction === "gram") {
    dutyPct = 0.03; // reduced for rural gram panchayat
  }

  const stampDuty = Math.round(taxableVal * dutyPct);
  const regFee = Math.round(taxableVal * 0.01); // 1%
  const cess = Math.round(stampDuty * cessPct);
  const total = stampDuty + regFee + cess;

  document.getElementById("calcGuidanceVal").textContent = `₹${guidanceVal.toLocaleString("en-IN")}`;
  document.getElementById("calcStampDuty").textContent = `₹${stampDuty.toLocaleString("en-IN")} (${(dutyPct * 100).toFixed(1)}%)`;
  document.getElementById("calcRegFee").textContent = `₹${regFee.toLocaleString("en-IN")} (1.0%)`;
  document.getElementById("calcCess").textContent = `₹${cess.toLocaleString("en-IN")}`;
  document.getElementById("calcTotalDues").textContent = `₹${total.toLocaleString("en-IN")}`;
}

function calculateFeePreview() {
  const area = Number(document.getElementById("regArea")?.value || 1200);
  const val = area * 2500;
  const duty = Math.round(val * 0.05);
  const reg = Math.round(val * 0.01);
  const cess = Math.round(duty * 0.1);
  const tot = duty + reg + cess;

  document.getElementById("prevStampDuty").textContent = `₹${duty.toLocaleString("en-IN")}`;
  document.getElementById("prevRegFee").textContent = `₹${reg.toLocaleString("en-IN")}`;
  document.getElementById("prevCess").textContent = `₹${cess.toLocaleString("en-IN")}`;
  document.getElementById("prevTotalFee").textContent = `₹${tot.toLocaleString("en-IN")}`;
}

document.getElementById("regArea")?.addEventListener("input", calculateFeePreview);

// ──────────────────────────────────────────────
//  14. Citizen Assistant & FAQ (Kannada + English)
// ──────────────────────────────────────────────

const faqDatabase = [
  {
    q_en: "How does LandSecure detect fraud?",
    q_kn: "ಲ್ಯಾಂಡ್‌ಸೆಕ್ಯೂರ್ ಭೂ ವಂಚನೆಯನ್ನು ಹೇಗೆ ಪತ್ತೆಹಚ್ಚುತ್ತದೆ?",
    a_en: "LandSecure employs a Random Forest ML model alongside an automated OCR parser. When you upload your deed or survey sketch, it extracts the actual area and survey numbers and detects mismatches against the application. Flagged applications are held for manual sub-registrar inspection.",
    a_kn: "ಲ್ಯಾಂಡ್‌ಸೆಕ್ಯೂರ್ ಯಂತ್ರ ಕಲಿಕೆ (ML) ಮತ್ತು ಸ್ವಯಂಚಾಲಿತ OCR ಸ್ಕ್ಯಾನರ್ ಬಳಸುತ್ತದೆ. ನಿಮ್ಮ ಪಹಣಿ ಅಥವಾ ಖರೀದಿ ಪತ್ರದ ವಿಸ್ತೀರ್ಣ ಮತ್ತು ಸರ್ವೆ ನಂಬರ್ ಅರ್ಜಿಯೊಂದಿಗೆ ತಾಳೆಯಾಗದಿದ್ದರೆ ತಕ್ಷಣ ಎಚ್ಚರಿಕೆ ನೀಡುತ್ತದೆ."
  },
  {
    q_en: "Why is blockchain used instead of a regular database?",
    q_kn: "ಸಾಮಾನ್ಯ ಡೇಟಾಬೇಸ್ ಬದಲಿಗೆ ಬ್ಲಾಕ್‌ಚೈನ್ ಏಕೆ ಬಳಸಲಾಗುತ್ತದೆ?",
    a_en: "Regular databases can be altered by unauthorized administrators or malicious insiders. Blockchain generates a permanent, tamper-evident cryptographic block for every registration. If someone modifies a deed later, the SHA-256 hash check reveals the tampering immediately.",
    a_kn: "ಸಾಮಾನ್ಯ ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಮಾಹಿತಿ ಬದಲಾಯಿಸುವ ಅಪಾಯವಿರುತ್ತದೆ. ಬ್ಲಾಕ್‌ಚೈನ್‌ನಲ್ಲಿ ದಾಖಲಾದ ಮಾಹಿತಿಯನ್ನು ಯಾರೂ ಅಳಿಸಲು ಅಥವಾ ಬದಲಾಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಾಖಲೆ ತಿದ್ದಿದರೆ ತಕ್ಷಣ ಪತ್ತೆಯಾಗುತ್ತದೆ."
  },
  {
    q_en: "What should I do if my application is flagged 'Under Review'?",
    q_kn: "ನನ್ನ ಅರ್ಜಿಯು 'Under Review' ಎಂದು ಕಂಡುಬಂದರೆ ಏನು ಮಾಡಬೇಕು?",
    a_en: "A review alert is not proof of fraud. It simply indicates a minor discrepancy (such as an area variance between old deeds and metric surveys). A Verification Officer will inspect your Mojini 11E sketch and approve it or request field clarification.",
    a_kn: "ಇದು ವಂಚನೆಯ ತೀರ್ಪಲ್ಲ. ಹಳೆಯ ದಾಖಲೆಗಳಲ್ಲಿ ಅಳತೆ ವ್ಯತ್ಯಾಸವಿದ್ದರೆ ಪರಿಶೀಲನೆಗೆ ಇಡಲಾಗುತ್ತದೆ. ಉಪ-ನೋಂದಣಾಧಿಕಾರಿಗಳು ಪರಿಶೀಲಿಸಿ ಅನುಮೋದನೆ ನೀಡುತ್ತಾರೆ."
  },
  {
    q_en: "How are registration fees and stamp duty calculated in Karnataka?",
    q_kn: "ಕರ್ನಾಟಕದಲ್ಲಿ ನೋಂದಣಿ ಶುಲ್ಕ ಮತ್ತು ಮುದ್ರಾಂಕ ಶುಲ್ಕವನ್ನು ಹೇಗೆ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ?",
    a_en: "Under the Karnataka Stamp Act, Stamp Duty is 5% in BBMP/corporation areas, Registration Fee is 1%, and Infrastructure Cess is 10% on the stamp duty. Rural Gram Panchayats enjoy lower rates.",
    a_kn: "ಕರ್ನಾಟಕ ಮುದ್ರಾಂಕ ಕಾಯ್ದೆಯಡಿ ಮುದ್ರಾಂಕ ಶುಲ್ಕ 5%, ನೋಂದಣಿ ಶುಲ್ಕ 1% ಮತ್ತು ಸೆಸ್ 10% ಇರುತ್ತದೆ."
  }
];

function initFAQ() {
  renderFAQList(faqDatabase);
}

function renderFAQList(list) {
  const container = document.getElementById("faqAccordionArea");
  if (!container) return;

  container.innerHTML = list
    .map(
      (item, idx) => `
      <div class="card" style="margin-bottom:8px; padding:18px 22px; cursor:pointer;" onclick="toggleFaq(${idx})">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:0.95rem; color:var(--text-primary); margin:0;">
            ${currentLang === "kn" ? item.q_kn : item.q_en}
          </h4>
          <span style="color:var(--cyan); font-weight:700;">+</span>
        </div>
        <div id="faqAns_${idx}" style="display:none; margin-top:12px; font-size:0.86rem; color:var(--text-secondary); line-height:1.6; border-top:1px solid rgba(255,255,255,0.06); padding-top:12px;">
          ${currentLang === "kn" ? item.a_kn : item.a_en}
        </div>
      </div>
    `
    )
    .join("");
}

function toggleFaq(idx) {
  const ans = document.getElementById(`faqAns_${idx}`);
  if (ans) {
    ans.style.display = ans.style.display === "block" ? "none" : "block";
  }
}

function searchFAQ(query) {
  const q = (query || "").toLowerCase();
  const filtered = faqDatabase.filter((f) => {
    return (
      f.q_en.toLowerCase().includes(q) ||
      f.a_en.toLowerCase().includes(q) ||
      f.q_kn.includes(q) ||
      f.a_kn.includes(q)
    );
  });
  renderFAQList(filtered);
}

// ──────────────────────────────────────────────
//  15. Language Toggle (English / ಕನ್ನಡ)
// ──────────────────────────────────────────────

function initLanguage() {
  const toggleBtn = document.getElementById("langToggleBtn");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      currentLang = currentLang === "en" ? "kn" : "en";
      applyLanguage(currentLang);
    });
  }
}

function applyLanguage(lang) {
  const txtCurrentLang = document.getElementById("txtCurrentLang");
  if (txtCurrentLang) txtCurrentLang.textContent = lang === "en" ? "ಕನ್ನಡ" : "English";

  if (lang === "kn") {
    document.body.classList.add("kannada-mode");
    document.getElementById("txtBrandSubtitle").textContent = "ಕರ್ನಾಟಕ ಭೂ ಸುರಕ್ಷತೆ";
    document.getElementById("txtHeaderTagline").textContent = "ಕಾವೇರಿ 2.0 / ಭೂಮಿ ನೋಂದಣಿ ಪೋರ್ಟಲ್";
    document.getElementById("navTextDashboard").textContent = "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್";
    document.getElementById("navTextRegister").textContent = "ಭೂಮಿ ನೋಂದಣಿ";
    document.getElementById("navTextLands").textContent = "ಎಲ್ಲಾ ಅರ್ಜಿಗಳು";
    document.getElementById("navTextScanner").textContent = "ದಾಖಲೆ ಸ್ಕ್ಯಾನರ್";
    document.getElementById("navTextFraud").textContent = "ವಂಚನೆ ನಿಯಂತ್ರಣ";
    document.getElementById("navTextMap").textContent = "ಭೂ ನಕ್ಷೆ (ಮ್ಯಾಪ್)";
    document.getElementById("navTextBlockchain").textContent = "ಬ್ಲಾಕ್‌ಚೈನ್";
    document.getElementById("navTextTimeline").textContent = "ಮಾಲೀಕತ್ವ ಇತಿಹಾಸ";
    document.getElementById("navTextChecklist").textContent = "ದಾಖಲೆಗಳ ಪಟ್ಟಿ";
    document.getElementById("navTextFees").textContent = "ಶುಲ್ಕ ಕ್ಯಾಲ್ಕುಲೇಟರ್";
    document.getElementById("navTextAssistant").textContent = "ನಾಗರಿಕ ಸಹಾಯವಾಣಿ";
    showToast("ಭಾಷೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ", "info");
  } else {
    document.body.classList.remove("kannada-mode");
    document.getElementById("txtBrandSubtitle").textContent = "Karnataka Portal";
    document.getElementById("txtHeaderTagline").textContent = "Next-Gen Land Registry & Fraud Prevention";
    document.getElementById("navTextDashboard").textContent = "Dashboard";
    document.getElementById("navTextRegister").textContent = "Register Land";
    document.getElementById("navTextLands").textContent = "All Applications";
    document.getElementById("navTextScanner").textContent = "AI Document Scanner";
    document.getElementById("navTextFraud").textContent = "AI Fraud Risk Center";
    document.getElementById("navTextMap").textContent = "Interactive Land Map";
    document.getElementById("navTextBlockchain").textContent = "Blockchain Explorer";
    document.getElementById("navTextTimeline").textContent = "Audit & Ownership";
    document.getElementById("navTextChecklist").textContent = "Document Checklist";
    document.getElementById("navTextFees").textContent = "Fee Estimator";
    document.getElementById("navTextAssistant").textContent = "Citizen Assistant (ಕನ್ನಡ)";
    showToast("Switched language to English", "info");
  }

  renderFAQList(faqDatabase);
}

// ──────────────────────────────────────────────
//  16. Authentication & Email OTP Modal
// ──────────────────────────────────────────────

document.getElementById("btnOpenAuthModal")?.addEventListener("click", () => {
  openAuthModal();
});

function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.add("active");
  resetAuthModal();
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("active");
}

function resetAuthModal() {
  document.getElementById("authStepRequest").style.display = "block";
  document.getElementById("authStepVerify").style.display = "none";
  document.getElementById("authOtpInput").value = "";
  document.getElementById("authDevOtpHint").textContent = "";
}

async function sendAuthOTP() {
  const email = document.getElementById("authEmailInput").value.trim();
  const role = document.getElementById("authRoleSelect").value;
  const btn = document.getElementById("btnSendOTP");

  if (!email || !email.includes("@")) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>⏳</span> Generating & Sending Code...`;

  try {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role })
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message, data.delivered ? "success" : "info");
      document.getElementById("authStepRequest").style.display = "none";
      document.getElementById("authStepVerify").style.display = "block";
      document.getElementById("authTargetEmailDisplay").textContent = email;

      const hintEl = document.getElementById("authDevOtpHint");
      if (data.delivered) {
        hintEl.innerHTML = `<div style="margin-top: 6px; color: var(--success); font-weight: 600;">✅ Verification code sent to your email inbox! Please check your email.</div>`;
        hintEl.style.cursor = "default";
        hintEl.onclick = null;
      } else if (data.devOtp) {
        hintEl.innerHTML = `
          <div style="margin-top: 8px; padding: 10px 12px; background: rgba(0, 212, 255, 0.1); border: 1px dashed var(--cyan); border-radius: 8px; text-align: left;">
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 4px;">
              ℹ️ <strong>Demo Mode</strong> (SMTP not configured in backend/.env):
            </div>
            <div style="font-size: 0.95rem; font-weight: 700; color: var(--cyan);">
              🔑 Demo Code: <span style="font-family: monospace; letter-spacing: 2px;">${data.devOtp}</span>
              <span style="font-size: 0.74rem; font-weight: 400; color: var(--text-secondary); margin-left: 6px;">(Click to auto-fill)</span>
            </div>
          </div>
        `;
        hintEl.style.cursor = "pointer";
        hintEl.onclick = () => {
          document.getElementById("authOtpInput").value = data.devOtp;
        };
        // Auto-fill in demo mode for instant testing
        document.getElementById("authOtpInput").value = data.devOtp;
      }
    } else {
      showToast(data.message || "Failed to send OTP", "error");
    }
  } catch (err) {
    showToast("Error requesting OTP: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>📧</span> Send 6-Digit OTP to Email`;
  }
}

async function verifyAuthOTP() {
  const email = document.getElementById("authEmailInput").value.trim();
  const otp = document.getElementById("authOtpInput").value.trim();
  const role = document.getElementById("authRoleSelect").value;
  const btn = document.getElementById("btnVerifyOTP");

  if (!otp || otp.length < 6) {
    showToast("Please enter the 6-digit verification code", "error");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>⏳</span> Verifying Code...`;

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, role })
    });

    const data = await res.json();

    if (data.success && data.user) {
      currentUser = data.user;
      showToast(`Welcome back, ${data.user.name}! Role: ${data.user.role.toUpperCase()}`, "success");

      // Update user badge in header
      document.getElementById("userNameDisplay").textContent = data.user.name;
      document.getElementById("userRoleDisplay").textContent = data.user.role.toUpperCase();
      document.getElementById("userAvatar").textContent = data.user.name.charAt(0).toUpperCase();
      document.getElementById("txtAuthBtnLabel").textContent = "Switch Role";

      closeAuthModal();
    } else {
      showToast(data.message || "Verification failed", "error");
    }
  } catch (err) {
    showToast("Verification error: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>✅</span> Verify Code & Sign In`;
  }
}

// ──────────────────────────────────────────────
//  17. Official Prototype Certificate Modal
// ──────────────────────────────────────────────

function openCertificateModal(landId) {
  const land = allLands.find((l) => l.landId === landId);
  if (!land) return;

  document.getElementById("certLandId").textContent = land.landId;
  document.getElementById("certSurvey").textContent = land.surveyNumber;
  document.getElementById("certOwner").textContent = `${land.ownerName} (${land.ownerId})`;
  document.getElementById("certArea").textContent = `${Number(land.area).toLocaleString()} sq. ft.`;
  document.getElementById("certDistrict").textContent = `${land.location}, ${land.district}`;
  document.getElementById("certStatus").textContent = land.status;
  document.getElementById("certDocHash").textContent = land.primaryDocumentHash || "0x3a9f00192847284918239478129348";
  document.getElementById("certTxHash").textContent = `${land.blockchainHash || "0x12984928174928"} (Block #${land.blockchainDetails?.blockNumber || 1422})`;

  // Generate QR Code
  const qrContainer = document.getElementById("certQrBox");
  qrContainer.innerHTML = "";
  if (window.QRCode) {
    new QRCode(qrContainer, {
      text: `https://landsecure.karnataka.gov.in/verify/${land.landId}?hash=${land.blockchainHash}`,
      width: 82,
      height: 82,
      colorDark: "#0f172a",
      colorLight: "#ffffff"
    });
  }

  const modal = document.getElementById("certModal");
  if (modal) modal.classList.add("active");
}

function closeCertModal() {
  const modal = document.getElementById("certModal");
  if (modal) modal.classList.remove("active");
}

// ──────────────────────────────────────────────
//  18. Utility Helpers
// ──────────────────────────────────────────────

function getStatusBadge(status) {
  const cls = getStatusBadgeClass(status);
  return `<span class="status-badge ${cls}">${status}</span>`;
}

function getStatusBadgeClass(status) {
  if (status === "Registered") return "registered";
  if (status === "Flagged for Fraud") return "flagged";
  if (status === "Under Review" || status === "Pending Verification") return "review";
  return "rejected";
}

function getRiskColor(prob) {
  if (prob >= 60) return "var(--danger)";
  if (prob >= 30) return "var(--warning)";
  return "var(--success)";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date 