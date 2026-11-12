// ==========================================
// SANJEEVANI SHARED WEB3 & BACKEND UTILITIES
// ==========================================

const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:8000`;

// Hardcoded deployment bootstrap roles (zero-latency, offline-safe fallback)
const BOOTSTRAP_ROLES = {
  admin: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
  manufacturer: "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
  distributors: [
    "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
    "0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d",
    "0xd03ea8624C8C5987235048901fB614fDcA89b117",
    "0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC"
  ]
};

// EIP-6963 Multi-Wallet Discovery: MetaMask Priority 1, Rabby Priority 2
let eip6963Providers = {
  metamask: null,
  metamaskInfo: null,
  rabby: null,
  rabbyInfo: null
};

// Listen for EIP-6963 announcements continuously
window.addEventListener("eip6963:announceProvider", (event) => {
  if (!event.detail || !event.detail.info) return;
  const { info, provider } = event.detail;
  const rdns = (info.rdns || "").toLowerCase();
  const name = (info.name || "").toLowerCase();

  if (rdns.includes("metamask") || name.includes("metamask")) {
    eip6963Providers.metamask = provider;
    eip6963Providers.metamaskInfo = info;
  } else if (rdns.includes("rabby") || name.includes("rabby")) {
    eip6963Providers.rabby = provider;
    eip6963Providers.rabbyInfo = info;
  }
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

let sharedConfig = null;
let sharedProvider = null;
let sharedSigner = null;
let sharedContract = null;
let sharedAddress = null;
let sharedRole = "guest"; // 'admin', 'manufacturer', 'distributor', or 'guest'
let activeWeb3Provider = null;

/**
 * Attaches account switch listener strictly to the ACTIVE provider currently connected.
 * Never listens to competing inactive wallet extensions to avoid cross-wallet reload loops.
 */
function bindActiveProvider(ethProvider) {
  if (!ethProvider || typeof ethProvider.on !== "function") return;
  if (activeWeb3Provider === ethProvider) return;
  activeWeb3Provider = ethProvider;

  ethProvider.on("accountsChanged", async (accounts) => {
    const isHome = () => {
      const p = window.location.pathname;
      return p === "/" || p.endsWith("/index.html") || p.endsWith("index.html") || p === "";
    };

    const isVerify = () => {
      const p = window.location.pathname;
      return p.includes("verify.html");
    };

    if (!accounts || accounts.length === 0) {
      console.log("Wallet disconnected by user in extension");
      sharedAddress = null;
      sharedSigner = null;
      sharedRole = "guest";
      updateNavbarWallet();
      if (!isHome() && !isVerify()) {
        window.location.href = "index.html";
      } else if (typeof onAccountChanged === "function") {
        onAccountChanged(null, "guest");
      }
      return;
    }

    const newAddr = accounts[0];
    if (sharedAddress && newAddr && sharedAddress.toLowerCase() !== newAddr.toLowerCase()) {
      console.log(`Account switched from ${sharedAddress} to ${newAddr}`);
      sharedAddress = newAddr;

      // Re-bind signer and contract to the newly active account
      if (sharedProvider) {
        try {
          sharedSigner = await sharedProvider.getSigner();
          if (sharedConfig) {
            sharedContract = new ethers.Contract(sharedConfig.contractAddress, sharedConfig.abi, sharedSigner);
          }
        } catch (e) {
          console.warn("Could not re-acquire signer on account change:", e);
        }
      }

      if (sharedConfig && sharedContract) {
        sharedRole = await detectRole(sharedContract, sharedAddress);
      }
      updateNavbarWallet();

      // On verify.html, STAY on the page and update UI in place without navigating away!
      if (isVerify()) {
        if (typeof onAccountChanged === "function") {
          onAccountChanged(sharedAddress, sharedRole);
        }
        return;
      }

      // If user is inside an internal portal (e.g. admin or manufacturer) and changes account:
      // Redirect to home page so portal permissions re-evaluate!
      if (!isHome()) {
        window.location.href = "index.html";
      } else if (typeof onAccountChanged === "function") {
        onAccountChanged(sharedAddress, sharedRole);
      }
    }
  });
}

/**
 * Loads contract address, ABI, and role configuration from FastAPI backend
 */
async function loadConfig() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/config`);
    if (!res.ok) throw new Error("Could not load backend config");
    sharedConfig = await res.json();
    return sharedConfig;
  } catch (err) {
    console.error("Config load error:", err);
    showAlert("Warning: FastAPI backend is offline. Ensure it is running on port 8000.", "danger");
    return null;
  }
}

function findMetaMaskDirect() {
  // 1. EIP-6963 MetaMask
  if (eip6963Providers.metamask) return eip6963Providers.metamask;

  // 2. window.ethereum.providers array (standard multi-extension array)
  if (window.ethereum && Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
    const mm = window.ethereum.providers.find(p => (p.isMetaMask && !p.isRabby && !p.isPhantom && !p.isBraveWallet) || (p._metamask && !p.isRabby));
    if (mm) return mm;
  }

  // 3. window.ethereum.providerMap (EIP-5749)
  if (window.ethereum && window.ethereum.providerMap && typeof window.ethereum.providerMap.get === "function") {
    const mm = window.ethereum.providerMap.get("MetaMask");
    if (mm && !mm.isRabby) return mm;
  }

  // 4. window.ethereum pure MetaMask
  if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isRabby) {
    return window.ethereum;
  }

  return null;
}

function findRabbyDirect() {
  if (eip6963Providers.rabby) return eip6963Providers.rabby;
  if (window.rabby) return window.rabby;
  if (window.ethereum && window.ethereum.isRabby) return window.ethereum;
  if (window.ethereum && Array.isArray(window.ethereum.providers)) {
    const rb = window.ethereum.providers.find(p => p.isRabby);
    if (rb) return rb;
  }
  return null;
}

/**
 * Asynchronously resolves injected Web3 provider: STRICTLY MetaMask first, Rabby secondary
 */
async function getWeb3ProviderAsync() {
  // 1. Try to find MetaMask immediately
  let mm = findMetaMaskDirect();
  if (mm) return mm;

  // 2. Request EIP-6963 and wait briefly (up to 180ms) for MetaMask to announce
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  for (let i = 0; i < 7; i++) {
    await new Promise(r => setTimeout(r, 25));
    mm = findMetaMaskDirect();
    if (mm) return mm;
  }

  // 3. Fallback to Rabby (Priority 2)
  const rb = findRabbyDirect();
  if (rb) return rb;

  // 4. Fallback to window.ethereum
  return window.ethereum || null;
}

function getWeb3Provider() {
  return findMetaMaskDirect() || findRabbyDirect() || window.ethereum || null;
}

function getWalletName(provider) {
  const p = provider || getWeb3Provider();
  if (!p) return "Web3 Wallet";
  if (p === eip6963Providers.metamask || (p.isMetaMask && !p.isRabby)) return "MetaMask";
  if (p === eip6963Providers.rabby || p.isRabby) return "Rabby";
  return "Web3 Wallet";
}

/**
 * Connects the wallet (prioritizes MetaMask, Rabby secondary)
 */
async function connectWallet() {
  const ethProvider = await getWeb3ProviderAsync();
  if (!ethProvider) {
    alert("No Web3 wallet detected. Please install MetaMask or Rabby Wallet extension in this browser.");
    return null;
  }

  bindActiveProvider(ethProvider);

  try {
    sharedProvider = new ethers.BrowserProvider(ethProvider);
    const accounts = await ethProvider.request({ method: "eth_requestAccounts" });
    if (accounts && accounts.length > 0) {
      sharedAddress = accounts[0];
      sharedSigner = await sharedProvider.getSigner();
      if (sharedConfig) {
        sharedContract = new ethers.Contract(sharedConfig.contractAddress, sharedConfig.abi, sharedSigner);
        sharedRole = await detectRole(sharedContract, sharedAddress);
      }
      updateNavbarWallet();
      if (typeof onAccountChanged === "function") {
        onAccountChanged(sharedAddress, sharedRole);
      }
      return { address: sharedAddress, role: sharedRole, contract: sharedContract };
    }
  } catch (err) {
    console.error("Wallet error:", err);
    showAlert("Failed to connect wallet: " + (err.message || err), "danger");
  }
  return null;
}

// Backwards-compatible alias
const connectMetaMask = connectWallet;

/**
 * Disconnects the wallet and redirects to home page
 */
function disconnectWallet() {
  sharedAddress = null;
  sharedSigner = null;
  sharedRole = "guest";
  sharedContract = null;
  updateNavbarWallet();
  closeWalletModal();

  // Redirect to home only if inside a restricted internal portal; stay in place on home or verify page
  const path = window.location.pathname;
  const isHome = path === "/" || path.endsWith("/index.html") || path.endsWith("index.html") || path === "";
  const isVerify = path.includes("verify.html");
  if (!isHome && !isVerify) {
    window.location.href = "index.html";
  } else if (typeof onAccountChanged === "function") {
    onAccountChanged(null, "guest");
  }
}

/**
 * Auto-detect wallet on page load + listen for account switches
 */
async function autoDetectWallet() {
  const ethProvider = await getWeb3ProviderAsync();
  if (!ethProvider) return;

  bindActiveProvider(ethProvider);

  sharedProvider = new ethers.BrowserProvider(ethProvider);
  try {
    const accounts = await sharedProvider.listAccounts();
    if (accounts.length > 0) {
      sharedAddress = accounts[0].address;
      sharedSigner = await sharedProvider.getSigner();
      if (sharedConfig) {
        sharedContract = new ethers.Contract(sharedConfig.contractAddress, sharedConfig.abi, sharedSigner);
        sharedRole = await detectRole(sharedContract, sharedAddress);
      }
      updateNavbarWallet();
      if (typeof onAccountChanged === "function") {
        onAccountChanged(sharedAddress, sharedRole);
      }
    } else {
      updateNavbarWallet();
    }
  } catch (e) {
    updateNavbarWallet();
  }
}

/**
 * Queries role with ON-CHAIN smart contract as absolute source of truth.
 * Revocation by admin takes immediate effect.
 */
async function detectRole(contract, address) {
  if (!address) return "guest";
  const cleanAddr = address.toLowerCase();

  // 1. PRIMARY SOURCE OF TRUTH: Query live smart contract on-chain
  if (contract) {
    try {
      // Check admin
      const admin = await contract.admin();
      if (admin && admin.toLowerCase() === cleanAddr) return "admin";

      // Check manufacturer status on-chain
      const isMfg = await contract.manufacturers(address);
      if (isMfg) return "manufacturer";

      // Check distributor status on-chain
      const isDist = await contract.distributors(address);
      if (isDist) return "distributor";

      // Successfully queried on-chain and address has no active roles
      return "guest";
    } catch (err) {
      console.warn("On-chain role query error, falling back to static config:", err);
    }
  }

  // 2. Fallback ONLY if contract instance is not available or RPC failed
  if (sharedConfig && sharedConfig.roles) {
    const roles = sharedConfig.roles;
    if (roles.admin && roles.admin.toLowerCase() === cleanAddr) return "admin";
    if (roles.manufacturer && roles.manufacturer.toLowerCase() === cleanAddr) return "manufacturer";
    if (roles.distributor && roles.distributor.toLowerCase() === cleanAddr) return "distributor";
    if (Array.isArray(roles.distributors) && roles.distributors.some(d => d.toLowerCase() === cleanAddr)) return "distributor";
  }

  if (BOOTSTRAP_ROLES.admin.toLowerCase() === cleanAddr) return "admin";
  if (BOOTSTRAP_ROLES.manufacturer.toLowerCase() === cleanAddr) return "manufacturer";
  if (BOOTSTRAP_ROLES.distributors.some(d => d.toLowerCase() === cleanAddr)) return "distributor";

  return "guest";
}

/**
 * Updates navbar wallet badge, logout button, and connect button
 */
function updateNavbarWallet() {
  const btn = document.getElementById("connectWalletBtn");
  const badge = document.getElementById("walletBadge");
  const rolePill = document.getElementById("userRolePill");
  const addrPill = document.getElementById("userAddressPill");
  const logoutBtn = document.getElementById("logoutWalletBtn");

  if (sharedAddress) {
    if (btn) btn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (badge) {
      badge.classList.remove("hidden");
      if (addrPill) addrPill.textContent = `${sharedAddress.slice(0, 6)}...${sharedAddress.slice(-4)}`;
      if (rolePill) rolePill.textContent = sharedRole;
    }
  } else {
    if (btn) btn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (badge) badge.classList.add("hidden");
  }
}

// Auto-bind logout button if present on page
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutWalletBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", disconnectWallet);
  }
});


// =============================================
// IN-PAGE WALLET MODAL
// =============================================

/**
 * Creates the wallet modal overlay in the DOM (called once on page load)
 */
function initWalletModal() {
  if (document.getElementById("walletModal")) return;

  const overlay = document.createElement("div");
  overlay.id = "walletModal";
  overlay.className = "wm-overlay hidden";
  overlay.innerHTML = `
    <div class="wm-panel" onclick="event.stopPropagation()">
      <div class="wm-header">
        <span style="font-weight:700; font-size:1.05rem;">Wallet</span>
        <button class="wm-close" onclick="closeWalletModal()" title="Close">&times;</button>
      </div>
      <div class="wm-body">
        <div class="wm-role-badge" id="wmRoleBadge">guest</div>
        <div class="wm-address" id="wmAddress">0x...</div>
        <button class="wm-copy-btn" id="wmCopyBtn" title="Copy full address">Copy Address</button>
        <div class="wm-divider"></div>
        <p class="wm-hint">Connected with <strong id="wmWalletType">Web3 Wallet</strong>. To switch accounts, open your <strong>MetaMask</strong> or <strong>Rabby</strong> extension in your browser toolbar and select your account. This page will auto-update instantly.</p>
        <div class="wm-divider"></div>
        <button class="wm-disconnect-btn" id="wmDisconnectBtn">Disconnect Wallet</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close when clicking backdrop
  overlay.addEventListener("click", closeWalletModal);

  // Copy address
  document.getElementById("wmCopyBtn").addEventListener("click", () => {
    if (sharedAddress) {
      navigator.clipboard.writeText(sharedAddress).then(() => {
        document.getElementById("wmCopyBtn").textContent = "Copied!";
        setTimeout(() => { document.getElementById("wmCopyBtn").textContent = "Copy Address"; }, 1500);
      });
    }
  });

  // Disconnect
  document.getElementById("wmDisconnectBtn").addEventListener("click", disconnectWallet);
}

function openWalletModal() {
  initWalletModal();
  const modal = document.getElementById("walletModal");
  const badge = document.getElementById("wmRoleBadge");
  const addr = document.getElementById("wmAddress");
  const walletType = document.getElementById("wmWalletType");

  if (badge) badge.textContent = sharedRole;
  if (walletType) walletType.textContent = getWalletName();
  if (addr && sharedAddress) {
    addr.textContent = `${sharedAddress.slice(0, 10)}...${sharedAddress.slice(-8)}`;
  }
  if (modal) modal.classList.remove("hidden");
}

function closeWalletModal() {
  const modal = document.getElementById("walletModal");
  if (modal) modal.classList.add("hidden");
}


// =============================================
// UTILITIES
// =============================================

function showAlert(msg, type = "info") {
  const alertBox = document.getElementById("statusAlert");
  if (!alertBox) return;
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove("hidden");
}

function hideAlert() {
  const alertBox = document.getElementById("statusAlert");
  if (alertBox) alertBox.classList.add("hidden");
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

/**
 * QR Code Decoding & Verification Helper
 */
function handleDecodedQr(decodedText) {
  let batchId = decodedText.trim();
  try {
    const url = new URL(decodedText);
    const param = url.searchParams.get("batch");
    if (param) batchId = param;
  } catch (e) {
    const match = decodedText.match(/[?&]batch=([^&]+)/);
    if (match && match[1]) {
      batchId = decodeURIComponent(match[1]);
    }
  }

  if (batchId) {
    const cur = new URL(window.location.href);
    if (cur.pathname.includes("/frontend/")) {
      window.location.href = `verify.html?batch=${encodeURIComponent(batchId)}`;
    } else {
      const basePath = cur.pathname.substring(0, cur.pathname.lastIndexOf("/") + 1);
      window.location.href = `${cur.origin}${basePath}frontend/verify.html?batch=${encodeURIComponent(batchId)}`;
    }
  } else {
    alert("Could not extract a valid Batch ID from this QR code.");
  }
}

/**
 * Initializes a Camera & File Upload QR scanner
 */
function initQrScanner({
  readerElementId,
  startCameraBtnId,
  fileInputId,
  scannerBoxId,
  closeCameraBtnId
}) {
  let html5QrCode = null;

  const startBtn = document.getElementById(startCameraBtnId);
  const fileInput = document.getElementById(fileInputId);
  const scannerBox = document.getElementById(scannerBoxId);
  const closeBtn = document.getElementById(closeCameraBtnId);

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      const scanner = new Html5Qrcode(readerElementId);
      try {
        const decodedText = await scanner.scanFile(file, true);
        handleDecodedQr(decodedText);
      } catch (err) {
        alert("No valid QR code detected in this image. Please upload a clear photo of the medicine box QR sticker.");
      }
    });
  }

  if (startBtn && scannerBox) {
    startBtn.addEventListener("click", async () => {
      scannerBox.classList.remove("hidden");
      html5QrCode = new Html5Qrcode(readerElementId);
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            html5QrCode.stop().then(() => {
              scannerBox.classList.add("hidden");
              handleDecodedQr(decodedText);
            });
          },
          (errorMessage) => {}
        );
      } catch (err) {
        alert("Could not access camera. Please allow camera permissions or upload an image instead.");
        scannerBox.classList.add("hidden");
      }
    });
  }

  if (closeBtn && scannerBox) {
    closeBtn.addEventListener("click", async () => {
      if (html5QrCode) {
        try { await html5QrCode.stop(); } catch (e) {}
      }
      scannerBox.classList.add("hidden");
    });
  }
}

/**
 * Unified, standardized batch timeline renderer
 * Identical across both Verify and Admin portals.
 * Renders the initial Manufacturer Origin followed by all Distributor Transit checkpoints.
 */
function renderBatchTimelineHtml(batch) {
  if (!batch) return "";

  const minTemp = Number(batch.minTemp);
  const maxTemp = Number(batch.maxTemp);
  const history = batch.history || [];
  const mfg = batch.manufacturer || "Unknown Manufacturer";
  const mfgShort = mfg.length > 14 ? `${mfg.slice(0, 8)}...${mfg.slice(-6)}` : mfg;
  const expiryStr = batch.expiryDate ? new Date(Number(batch.expiryDate) * 1000).toLocaleDateString() : "";

  let itemsHtml = "";

  // 1. Manufacturer Origin Checkpoint
  itemsHtml += `
    <div class="timeline-item">
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-loc">Origin: Manufacturer Facility</span>
          <span class="timeline-time">Batch Minted</span>
        </div>
        <div class="timeline-temp ok">
          Cold-Chain Specification: ${minTemp}°C to ${maxTemp}°C <span style="font-size:0.75rem; font-weight:normal;">(Manufacturer Base)</span>
        </div>
        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
          Logged by Manufacturer: <code title="${escapeHtml(mfg)}">${escapeHtml(mfgShort)}</code>
          ${expiryStr ? ` &bull; Expiry: <span>${expiryStr}</span>` : ""}
        </div>
      </div>
    </div>
  `;

  // 2. If no distributor checkpoints yet
  if (history.length === 0) {
    itemsHtml += `
      <div class="timeline-item" style="opacity:0.85;">
        <div class="timeline-content" style="background:#f8fafc; border:1px dashed #cbd5e1;">
          <div class="timeline-header">
            <span class="timeline-loc" style="color:var(--text-muted);">Transit in Progress: Awaiting Checkpoint #1</span>
            <span class="timeline-time">In Transit</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
            Product departed manufacturer origin. Required distributor verifications: <strong>${batch.minCheckpoints || 1}</strong>.
          </div>
        </div>
      </div>
    `;
    return itemsHtml;
  }

  // 3. Distributor Transit Checkpoints
  history.forEach((rec, idx) => {
    const tempNum = Number(rec.temperature);
    const isBreach = tempNum < minTemp || tempNum > maxTemp;
    const timeStr = rec.timestamp ? new Date(Number(rec.timestamp) * 1000).toLocaleString() : "Timestamp Recorded";
    const dist = rec.loggedBy || "Unknown Distributor";
    const distShort = dist.length > 14 ? `${dist.slice(0, 8)}...${dist.slice(-6)}` : dist;
    const tempClass = isBreach ? "bad" : "ok";
    const tempTag = isBreach ? "(TEMPERATURE BREACH!)" : "(Safe & Compliant)";

    const proofLink = rec.imageCID ? `
      <div class="timeline-proof" style="margin-top:6px;">
        <a href="${BACKEND_URL}/ipfs/${escapeHtml(rec.imageCID)}" target="_blank" rel="noopener">
          View Thermometer Photo Proof (IPFS: ${escapeHtml(rec.imageCID.slice(0, 10))}...)
        </a>
      </div>
    ` : "";

    itemsHtml += `
      <div class="timeline-item ${isBreach ? "breach" : ""}">
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-loc">Checkpoint #${idx + 1}: ${escapeHtml(rec.location || "In Transit")}</span>
            <span class="timeline-time">${timeStr}</span>
          </div>
          <div class="timeline-temp ${tempClass}">
            Recorded Temperature: ${tempNum}°C <span style="font-size:0.75rem; font-weight:normal;">${tempTag}</span>
          </div>
          <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
            Logged by Distributor: <code title="${escapeHtml(dist)}">${escapeHtml(distShort)}</code>
          </div>
          ${proofLink}
        </div>
      </div>
    `;
  });

  return itemsHtml;
}
