# ❄️ Sanjeevani – Decentralized Cold-Chain Tracking & AI Verification System

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![Web3.py](https://img.shields.io/badge/Web3.py-v6-f16822.svg)](https://web3py.readthedocs.io/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-627eea.svg)](https://docs.ethers.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Sanjeevani** is an end-to-end, decentralized pharmaceutical cold-chain verification platform designed to guarantee the physical integrity of temperature-sensitive medicines (vaccines, insulin, biologics, and mRNA treatments) from the manufacturer's sterile facility to the patient.

It eliminates traditional centralized databases, mutable audit trails, and single points of failure by combining:
1. **Ethereum Smart Contracts (`PharmaChain.sol`)** for on-chain Role-Based Access Control (RBAC), permanent safety invariants, and immutable milestone logging.
2. **AI / Computer Vision (OCR)** to solve the blockchain "Oracle Problem" by extracting physical freezer gauge readings from photos before anchoring data to the blockchain.
3. **Decentralized Storage (IPFS)** for storing cryptographic proof of thermometer photos.
4. **Frictionless Patient Verification** requiring zero crypto knowledge, gas fees, or browser extensions.

---

## 🚨 The Core Problem

Temperature-sensitive pharmaceuticals require strict, unbroken storage conditions (typically $2^\circ\text{C}$ to $8^\circ\text{C}$ or deep-freeze at $-20^\circ\text{C}$ to $-70^\circ\text{C}$).

* **The Spoilage Crisis:** The World Health Organization (WHO) estimates that up to **50% of vaccines are wasted globally each year** due to cold-chain failures and unmonitored logistics breakdowns.
* **Silent Spoilage:** Thermally compromised pharmaceuticals look identical to potent ones. Patients and healthcare providers cannot tell with the naked eye whether a vaccine vial was exposed to ambient heat during shipment.
* **The Oracle Problem (*Garbage-In, Garbage-Out*):** Blockchains guarantee that data cannot be altered once written, but they cannot verify if the data was true when entered. If a distributor manually enters `4°C` while the vehicle refrigerator is failing at `22°C`, the blockchain records a lie.
* **Sanjeevani's Answer:** Field workers must upload a physical photograph of the thermometer gauge. Our AI OCR engine inspects the photo, cross-validates the needle/digital reading against the typed entry, and uploads the photo to IPFS. Only verified readings can be signed and anchored on-chain.

---

## 📌 Architecture & Role Separation

The platform enforces strict cryptographic role separation on-chain:

```
                            [ Sanjeevani Ecosystem ]
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  [ Administrator ]             [ Manufacturer ]               [ Distributor ]
  Account 0 (RBAC)              Account 1                      Accounts 2, 3, 4, 5
  - Manages permissions         - Mints new medicine batch     - Logs physical checkpoints
  - Whitelists/revokes roles    - Sets temp specs & expiry     - Submits thermometer photos
  - Global ledger audit view    - Prints physical QR sticker   - AI OCR verifies readings
  - Blocked from Mfg portal     - Blocked from Admin portal    - Anchors on-chain via Web3
  - Cannot log transit          - Cannot log transit           - Only role permitted to log
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       ▼
                             [ Patient / Customer ]
                                Gasless / No Wallet
                    - Scans QR sticker via phone camera or web
                    - Inspects instant authenticity verdict
                    - Reads complete chronological checkpoint path
```

### Strict Role-Based Rules:
1. **Administrator (`admin.html`)**:
   - Manages role authorizations (grant/revoke Manufacturer and Distributor rights).
   - Audits all medicine batches with a global ledger search, metrics counters, and detailed checkpoint logs.
   - Restricted from accessing the Manufacturer Portal and cannot log transit checkpoints.
2. **Manufacturer (`manufacturer.html`)**:
   - Mints batches on the blockchain with strict parameters: Medicine Name, Safe Temperature Range, Minimum Required Checkpoints, and Expiry Date.
   - Generates downloadable, physical QR Code stickers linking directly to verification.
   - Restricted from accessing the Admin Portal and cannot log transit checkpoints.
3. **Distributor (`verify.html`)**:
   - The **only** role permitted to log transit checkpoints. Administrators, Manufacturers, and Customers are strictly prohibited both in the UI and on-chain by the smart contract's `onlyDistributor` modifier.
   - Uses the header **"Distributor Login"** / **"+ Log Checkpoint"** to open the AI-backed submission modal.
4. **Customer / Public (`verify.html`)**:
   - Zero wallet, browser extension, or crypto required.
   - Direct access to the authenticity verdict, temperature history, and manufacturer origin.

---

## 📂 Project Structure

```
Project_Sanjeevani/
│
├── contracts/
│   └── PharmaChain.sol          # Solidity 0.8.20 Smart Contract (RBAC, safety latches, events)
│
├── scripts/
│   └── deploy.py                # Compiles & deploys contract to Ganache; pre-authorizes test roles
│
├── backend/
│   ├── app.py                   # FastAPI application & REST endpoints
│   ├── config.py                # Web3 connection & build artifact loader
│   ├── services/
│   │   ├── ocr_service.py       # Tesseract OCR thermometer gauge validation
│   │   └── ipfs_service.py      # IPFS CID generation & content-addressable photo storage
│   └── storage/
│       └── ipfs/                # Local IPFS photo repository
│
├── frontend/
│   ├── index.html               # Main Navigation Hub & Integrated Camera/File QR Scanner
│   ├── verify.html              # Authenticity Verdict & Distributor Checkpoint Logger
│   ├── manufacturer.html        # Manufacturer Portal: Batch Minting & QR Sticker Generator
│   ├── admin.html               # Administrator Portal: RBAC Management & Global Ledger Audit
│   ├── common.js                # Unified Web3 wallet connector, on-chain role detector & timeline
│   └── styles.css               # Clinical, clean, responsive styling
│
├── build/
│   ├── PharmaChain_ABI.json     # Compiled contract ABI
│   └── deployed_contract.json   # Contract address, deployment block & bootstrapped test accounts
│
├── requirements.txt             # Python dependencies
├── .vscode/
│   └── settings.json            # Live Server ignore configuration (prevents auto-reload on file writes)
└── README.md                    # Project documentation
```

---

## 🛠️ Prerequisites & Installation

### 1. System Requirements
- **macOS / Linux / Windows**
- **Python 3.10+** (tested up to Python 3.14)
- **Node.js 18+** & `npm`
- **Tesseract OCR** (for the AI gauge validation engine):
  - **macOS:** `brew install tesseract`
  - **Ubuntu / Debian:** `sudo apt-get install tesseract-ocr`
  - **Windows:** Download and install from [UB-Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki) and ensure it is on your system `PATH`.
- **VS Code** with the **Live Server** extension (by Ritwick Dey).
- **MetaMask** or **Rabby Wallet** browser extension.

### 2. Install Ganache Globally
```bash
npm install -g ganache
```

### 3. Setup Python Virtual Environment
Open your terminal inside the `Project_Sanjeevani` directory:
```bash
# Create virtual environment (if not already created)
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate       # Windows PowerShell

# Install dependencies
pip install -r requirements.txt
```

---

## 🚀 Local Development Run Guide

To run Sanjeevani locally, follow these 4 steps in order:

### Terminal 1: Start Ganache Local Blockchain
Start a local EVM instance listening on port `8545`:
```bash
ganache -h 0.0.0.0 -p 8545
```
> **Keep this terminal running.** Ganache will print 10 test accounts with private keys and 1000 ETH each.

---

### Terminal 2: Deploy the Smart Contract
Activate your virtual environment and run the deployment script:
```bash
source .venv/bin/activate
python scripts/deploy.py
```
This script will:
1. Compile `contracts/PharmaChain.sol`.
2. Deploy the contract to Ganache via **Account 0 (Admin)**.
3. Automatically configure initial on-chain authorizations:
   - **Account 1** &rarr; Authorized Manufacturer
   - **Accounts 2, 3, 4, 5** &rarr; Authorized Distributors
4. Output `build/deployed_contract.json` and `build/PharmaChain_ABI.json`.

---

### Terminal 3: Start FastAPI Backend
Launch the backend server using `uvicorn` with hot-reloading:
```bash
source .venv/bin/activate
uvicorn backend.app:app --reload
```
* **API Documentation (Swagger UI):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **API Health Check:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

---

### Step 4: Run the Frontend with VS Code Live Server
1. Open the `Project_Sanjeevani` folder in **VS Code**.
2. Click the **"Go Live"** button in the bottom-right status bar of VS Code (or right-click `frontend/index.html` &rarr; **"Open with Live Server"**).
3. Live Server will serve the workspace at port `5500`. Navigate to:
   ```text
   http://127.0.0.1:5500/frontend/index.html
   ```

> **Note on Live Server file watching:** The included `.vscode/settings.json` is configured to ignore backend runtime caches and `build/` files, preventing unwanted auto-reloading during batch minting.

---

## 🦊 Configuring MetaMask / Rabby Wallet

1. Open your browser extension (MetaMask or Rabby).
2. Add a Custom Network:
   - **Network Name:** `Ganache CLI`
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `1337`
   - **Currency Symbol:** `ETH`
3. Import the private keys generated by Ganache in Terminal 1:

| Role | Account in Ganache | Default Address | Function |
| :--- | :--- | :--- | :--- |
| **System Admin** | **Account 0** | `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1` | Manage roles in Admin Portal; audits global ledger |
| **Manufacturer** | **Account 1** | `0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0` | Mint medicine batches; generate QR stickers |
| **Distributor 1** | **Account 2** | `0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b` | Log transit checkpoint #1 with AI verification |
| **Distributor 2** | **Account 3** | `0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d` | Log transit checkpoint #2 with AI verification |
| **Normal Customer**| **Account 6+**| Any unlisted account | Read-only public verification; gasless |

---

## 🎬 End-to-End Walkthrough Demonstration

### 1. Mint a Medicine Batch (Manufacturer Portal)
1. Open [http://127.0.0.1:5500/frontend/manufacturer.html](http://127.0.0.1:5500/frontend/manufacturer.html).
2. Connect your wallet using **Account 1** (Manufacturer).
3. Enter batch parameters:
   - **Batch ID:** `VAX-2026-001`
   - **Medicine Name:** `Covaxin Bio-Shield`
   - **Safe Temperature Range:** `2°C` to `8°C`
   - **Required Checkpoints:** `2`
   - **Expiry Date:** Select a future date.
4. Click **"Mint Batch on Blockchain"** and confirm the transaction in MetaMask.
5. The portal displays a printable **QR Code sticker**:
   - Click **"Download QR Sticker (PNG)"** to save the physical label.
   - Click **"Test QR Link (Verify) &rarr;"** to open the verification report.

---

### 2. Public Verification & Milestone 0 (`verify.html`)
1. On the verification page, notice the compact status banner at the top:
   - **`IN TRANSIT`** *(Amber)* &mdash; indicates the batch is safely created but has not yet met the required 2 distributor verifications.
2. The **Batch Details** section shows the medicine name, safe temperature range, and custody documentation status.
3. The **Detailed Checkpoint Logs** opens with:
   - **`Origin: Manufacturer Facility` (Batch Minted)**
   - Target cold-chain specification: `2°C to 8°C (Manufacturer Base)`
   - Manufacturer address and expiration date.
   - Followed by `Transit in Progress: Awaiting Checkpoint #1`.

---

### 3. Log Transit Checkpoint #1 (Distributor 1)
1. In your wallet extension, switch to **Account 2** (Distributor 1).
   > **Note:** Switching accounts while on `verify.html` updates your identity in place and will **never** kick you back to the home page.
2. The navbar reveals the **`+ Log Checkpoint`** button. Click it.
3. The Batch ID field is automatically pre-filled and locked to `VAX-2026-001`.
4. Enter checkpoint details:
   - **Location:** `Mumbai International Airport Cold Hub`
   - **Temperature:** `4.5`
   - **Thermometer Photo:** Upload a photo of a thermometer gauge displaying `4.5°C`.
5. Click **"AI Verify & Anchor to Blockchain"**:
   - The FastAPI backend validates the photo using Tesseract OCR.
   - Pins the image to IPFS and returns the CID.
   - MetaMask prompts to sign the on-chain `updateTransit(...)` transaction.
6. The timeline refreshes instantly to show Checkpoint #1 with a clickable **"View Thermometer Photo Proof"** IPFS link.

---

### 4. Log Checkpoint #2 & Reach Complete Verification (Distributor 2)
1. Switch your wallet to **Account 3** (Distributor 2).
2. Click **`+ Log Checkpoint`**.
3. Enter:
   - **Location:** `Delhi Central Regional Storage`
   - **Temperature:** `5.2`
   - **Thermometer Photo:** Upload a thermometer photo reading `5.2°C`.
4. Submit and approve in wallet.
5. Once confirmed, the status banner immediately flips to:
   - **`FULLY VERIFIED & AUTHENTIC`** *(Green)*.
   - All 2 required distributor verifications are documented.

---

### 5. Audit in the Administrator Portal (`admin.html`)
1. Switch to **Account 0** (Admin) and visit [http://127.0.0.1:5500/frontend/admin.html](http://127.0.0.1:5500/frontend/admin.html).
2. In the **Role-Based Access Control** section, you can add or revoke manufacturers and distributors on-chain.
3. In the **Global Ledger Audit** section:
   - Review live metrics counters: *Total Discovered*, *Fully Verified*, *In-Transit / Incomplete*, and *Compromised*.
   - Search batches by name, ID, or transit location.
   - Expand any batch to see the **Detailed Checkpoint Logs**, which are **100% identical** in layout, badges, and milestones to the customer verification view.

---

### 6. Simulate a Temperature Breach
1. Switch to an authorized distributor account on `verify.html`.
2. Submit a checkpoint with a temperature reading of `25.0°C` (outside the `2°C` to `8°C` bounds).
3. The smart contract trips its safety latch:
   - The status banner flips to **`NOT AUTHENTIC — BATCH COMPROMISED`** *(Red)*.
   - The compromised milestone highlights in red with a **`(TEMPERATURE BREACH!)`** alert.
   - The state is permanent and irreversible on the blockchain, protecting patients from consuming spoiled medicine.

---

## 🛡️ Smart Contract API Reference

`PharmaChain.sol` implements the following functions:

| Function | Modifiers | Description |
| :--- | :--- | :--- |
| `mintBatch(...)` | `external onlyManufacturer` | Registers a new batch with medicine name, expiry date, temperature boundaries, and required checkpoint count. |
| `updateTransit(...)` | `external onlyDistributor` | Appends a transit record with location, temperature, and IPFS CID. Automatically trips `isCompromised` if temperature is breached or product is expired. |
| `setManufacturer(...)` | `external onlyAdmin` | Whitelists or revokes a manufacturer address on-chain. |
| `setDistributor(...)` | `external onlyAdmin` | Whitelists or revokes a distributor address on-chain. |
| `getBatchDetails(...)` | `external view returns (...)` | Returns batch metadata, temperature boundaries, checkpoint counts, and compromise status. |
| `getBatchHistory(...)` | `external view returns (...)` | Returns the complete chronological array of transit records and IPFS image CIDs. |

---

## ❓ Troubleshooting

1. **`Cannot GET /verify.html`**:
   - Live Server serves from the workspace root. Ensure your URL includes the `/frontend/` path:
     `http://127.0.0.1:5500/frontend/verify.html?batch=<BATCH_ID>`
2. **Page auto-reloading after minting a batch**:
   - Ensure you are running the latest backend code which stores runtime caches in `/tmp/` and that `.vscode/settings.json` is present.
3. **`TesseractNotFoundError` in backend terminal**:
   - Install Tesseract via `brew install tesseract` (macOS) or `apt install tesseract-ocr` (Linux).
4. **Transactions reverting with "Only authorized distributors can do this"**:
   - Ensure the wallet connected in your extension is one of the authorized distributor accounts (Accounts 2, 3, 4, or 5). Administrators and Manufacturers cannot log transit.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
