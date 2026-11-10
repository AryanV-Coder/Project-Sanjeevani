// ==========================================
// SANJEEVANI SHARED WEB3 & BACKEND UTILITIES
// ==========================================

// Automatically detect host IP so mobile phones on the same Wi-Fi connect seamlessly
const BACKEND_URL = `${window.location.protocol}//${window.location.hostname}:8000`;

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
 * Initializes MetaMask connection
 */
async function connectMetaMask() {
  if (!window.ethereum) {
    alert("MetaMask is not installed. Please install MetaMask to use Web3 features.");
    return null;
  }

  try {
    sharedProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await sharedProvider.send("eth_requestAccounts", []);
    if (accounts.length > 0) {
      sharedAddress = accounts[0];
      sharedSigner = await sharedProvider.getSigner();

      if (sharedConfig) {
        sharedContract = new ethers.Contract(
          sharedConfig.contractAddress,
          sharedConfig.abi,
          sharedSigner
        );
        sharedRole = await detectRole(sharedContract, sharedAddress);
      }
      updateNavbarWallet();
      return { address: sharedAddress, role: sharedRole, contract: sharedContract };
    }
  } catch (err) {
    console.error("MetaMask error:", err);
    showAlert("Failed to connect MetaMask: " + (err.message || err), "danger");
  }
  return null;
}

/**
 * Checks if user is already connected in this browser session
 */
async function autoDetectWallet() {
  if (window.ethereum) {
    sharedProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await sharedProvider.listAccounts();
    if (accounts.length > 0) {
      sharedAddress = accounts[0].address;
      sharedSigner = await sharedProvider.getSigner();
      if (sharedConfig) {
        sharedContract = new ethers.Contract(
          sharedConfig.contractAddress,
          sharedConfig.abi,
          sharedSigner
        );
        sharedRole = await detectRole(sharedContract, sharedAddress);
      }
      updateNavbarWallet();
    }

    // Auto-update UI if user switches accounts in MetaMask
    window.ethereum.on("accountsChanged", async (newAccounts) => {
      if (newAccounts.length > 0) {
        sharedAddress = newAccounts[0];
        sharedSigner = await sharedProvider.getSigner();
        if (sharedContract) {
          sharedRole = await detectRole(sharedContract, sharedAddress);
        }
        updateNavbarWallet();
        if (typeof onAccountChanged === "function") {
          onAccountChanged(sharedAddress, sharedRole);
        }
      } else {
        sharedAddress = null;
        sharedRole = "guest";
        updateNavbarWallet();
        if (typeof onAccountChanged === "function") {
          onAccountChanged(null, "guest");
        }
      }
    });
  }
}

/**
 * Queries smart contract on-chain to determine role
 */
async function detectRole(contract, address) {
  if (!contract || !address) return "guest";
  try {
    const admin = await contract.admin();
    if (admin.toLowerCase() === address.toLowerCase()) return "admin";

    const isMfg = await contract.manufacturers(address);
    if (isMfg) return "manufacturer";

    const isDist = await contract.distributors(address);
    if (isDist) return "distributor";

    return "guest";
  } catch (err) {
    console.error("Role query error:", err);
    return "guest";
  }
}

/**
 * Updates navbar wallet badge
 */
function updateNavbarWallet() {
  const btn = document.getElementById("connectWalletBtn");
  const badge = document.getElementById("walletBadge");
  const rolePill = document.getElementById("userRolePill");
  const addrPill = document.getElementById("userAddressPill");

  if (!btn || !badge) return;

  if (sharedAddress) {
    btn.classList.add("hidden");
    badge.classList.remove("hidden");
    if (addrPill) addrPill.textContent = `${sharedAddress.slice(0, 6)}...${sharedAddress.slice(-4)}`;
    if (rolePill) rolePill.textContent = sharedRole;
  } else {
    btn.classList.remove("hidden");
    badge.classList.add("hidden");
  }
}

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
 * Extracts batch ID from scanned text/URL and redirects to verify.html
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

  // 1. File Upload Scanner
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

  // 2. Camera Scanner
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

  // 3. Close Camera
  if (closeBtn && scannerBox) {
    closeBtn.addEventListener("click", async () => {
      if (html5QrCode) {
        try {
          await html5QrCode.stop();
        } catch (e) {}
      }
      scannerBox.classList.add("hidden");
    });
  }
}


