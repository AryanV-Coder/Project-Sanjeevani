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
  rabby: null
};

window.addEventListener("eip6963:announceProvider", (event) => {
  const { info, provider } = event.detail;
  if (info && info.rdns === "io.metamask") {
    eip6963Providers.metamask = provider;
  } else if (info && info.rdns === "io.rabby") {
    eip6963Providers.rabby = provider;
  }
});
window.dispatchEvent(new Event("eip6963:requestProvider"));

let sharedConfig = null;
let sharedProvider = null;
let sharedSigner = null;
let sharedContract = null;
let sharedAddress = null;
let sharedRole = "guest"; // 'admin', 'manufacturer', 'distributor', or 'guest'

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

/**
 * Gets injected Web3 provider: STRICTLY MetaMask first, Rabby secondary
 */
function getWeb3Provider() {
  // 1. EIP-6963 MetaMask (Priority 1)
  if (eip6963Providers.metamask) {
    return eip6963Providers.metamask;
  }

  // 2. window.ethereum.providers: find MetaMask (Priority 1)
  if (window.ethereum && Array.isArray(window.ethereum.providers) && window.ethereum.providers.length) {
    const mm = window.ethereum.providers.find(p => p.isMetaMask && !p.isRabby);
    if (mm) return mm;
  }

  // 3. window.ethereum pure MetaMask (Priority 1)
  if (window.ethereum && window.ethereum.isMetaMask && !window.ethereum.isRabby) {
    return window.ethereum;
  }

  // 4. EIP-6963 Rabby (Priority 2)
  if (eip6963Providers.rabby) {
    return eip6963Providers.rabby;
  }

  // 5. Dedicated window.rabby (Priority 2)
  if (window.rabby) {
    return window.rabby;
  }

  // 6. window.ethereum with isRabby (Priority 2)
  if (window.ethereum && window.ethereum.isRabby) {
    return window.ethereum;
  }

  // 7. General fallback
  return window.ethereum || null;
}

function getWalletName() {
  const p = getWeb3Provider();
  if (!p) return "Web3 Wallet";
  if (p.isMetaMask && !p.isRabby) return "MetaMask";
  if (p.isRabby) return "Rabby";
  return "Web3 Wallet";
}

/**
 * Connects the wallet (prioritizes MetaMask, Rabby secondary)
 */
async function connectWallet() {
  const ethProvider = getWeb3Provider();
  if (!ethProvider) {
    alert("No Web3 wallet detected. Please install MetaMask or Rabby Wallet extension in this browser.");
    return null;
  }

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

  // Redirect to home if not already there
  const path = window.location.pathname;
  const isHome = path === "/" || path.endsWith("/index.html") || path.endsWith("index.html") || path === "";
  if (!isHome) {
    window.location.href = "index.html";
  } else if (typeof onAccountChanged === "function") {
    onAccountChanged(null, "guest");
  }
}

/**
 * Auto-detect wallet on page load + listen for account switches
 */
async function autoDetectWallet() {
  const ethProvider = getWeb3Provider();
  if (!ethProvider) return;

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

  // When user switches account in Rabby toolbar → redirect to home so portal cards re-evaluate
  ethProvider.on("accountsChanged", async (newAccounts) => {
    if (newAccounts.length > 0) {
      sharedAddress = newAccounts[0];
      sharedSigner = await sharedProvider.getSigner();
      if (sharedConfig) {
        sharedContract = new ethers.Contract(sharedConfig.contractAddress, sharedConfig.abi, sharedSigner);
        sharedRole = await detectRole(sharedContract, sharedAddress);
      }
    } else {
      sharedAddress = null;
      sharedSigner = null;
      sharedRole = "guest";
    }
    updateNavbarWallet();

    // Always redirect to home on account switch so user picks the right portal
    const path = window.location.pathname;
    const isHome = path === "/" || path.endsWith("/index.html") || path.endsWith("index.html") || path === "";
    if (!isHome) {
      window.location.href = "index.html";
    } else if (typeof onAccountChanged === "function") {
      onAccountChanged(sharedAddress, sharedRole);
    }
  });
}

/**
 * Queries role with fallback to configuration roles
 */
async function detectRole(contract, address) {
  if (!address) return "guest";
  const cleanAddr = address.toLowerCase();

  // 1. Instant bootstrap lookup (hardcoded Ganache addresses, zero latency)
  if (BOOTSTRAP_ROLES.admin.toLowerCase() === cleanAddr) return "admin";
  if (BOOTSTRAP_ROLES.manufacturer.toLowerCase() === cleanAddr) return "manufacturer";
  if (BOOTSTRAP_ROLES.distributors.some(d => d.toLowerCase() === cleanAddr)) return "distributor";

  // 2. Fast, offline-proof lookup from deployment config
  if (sharedConfig && sharedConfig.roles) {
    const roles = sharedConfig.roles;
    if (roles.admin && roles.admin.toLowerCase() === cleanAddr) return "admin";
    if (roles.manufacturer && roles.manufacturer.toLowerCase() === cleanAddr) return "manufacturer";
    if (roles.distributor && roles.distributor.toLowerCase() === cleanAddr) return "distributor";
    if (Array.isArray(roles.distributors) && roles.distributors.some(d => d.toLowerCase() === cleanAddr)) return "distributor";
  }

  // 3. Query smart contract on-chain for dynamic roles
  if (contract) {
    try {
      const admin = await contract.admin();
      if (admin && admin.toLowerCase() === cleanAddr) return "admin";
      const isMfg = await contract.manufacturers(address);
      if (isMfg) return "manufacturer";
      const isDist = await contract.distributors(address);
      if (isDist) return "distributor";
    } catch (err) {
      console.warn("On-chain role query warning:", err);
    }
  }

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
    window.location.href = `verify.html?batch=${encodeURIComponent(batchId)}`;
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
