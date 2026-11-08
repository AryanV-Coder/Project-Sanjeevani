# ❄️ Sanjeevani – Decentralized Cold-Chain Tracking & Verification System

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![Web3.py](https://img.shields.io/badge/Web3.py-v6-f16822.svg)](https://web3py.readthedocs.io/)
[![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-627eea.svg)](https://docs.ethers.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Sanjeevani** is a unified, Web3-powered pharmaceutical supply chain verification system designed to track temperature-sensitive pharmaceuticals (such as vaccines and biologics) from the manufacturing plant to the end patient. 

It eliminates traditional centralized databases, credentials, and single points of failure by leveraging an Ethereum-compatible smart contract for **Role-Based Access Control (RBAC)**, **immutable safety rule enforcement**, and **chain-of-custody tracking**, paired with **AI/Computer Vision** to solve the physical-blockchain "Oracle problem."

---

## 🚨 The Problem We Are Solving

Temperature-sensitive pharmaceuticals—including life-saving vaccines (e.g., mRNA, COVID-19, polio), insulin, and biologics—require strict, uninterrupted temperature management throughout transit (typically $2^\circ\text{C}$ to $8^\circ\text{C}$ or deep-freeze at $-20^\circ\text{C}$ to $-70^\circ\text{C}$).

The modern pharmaceutical supply chain faces **four critical systemic failures**:

### 1. The Global Cold-Chain Wastage Crisis
* According to the **World Health Organization (WHO)**, up to **50% of vaccines are wasted globally each year**, primarily due to cold-chain failures, power interruptions, and unmonitored logistics breakdowns.
* Exposure to temperatures outside safe boundaries causes biological denaturation: vaccines lose immunogenic potency, rendering them therapeutically useless or causing severe adverse patient reactions.

### 2. "Silent Spoilage" & Counterfeiting
* **Thermally compromised pharmaceuticals look identical to safe ones.** A patient, doctor, or pharmacist receiving a spoiled vial cannot detect with the naked eye whether the medicine sat in a $35^\circ\text{C}$ delivery truck 48 hours prior.
* Illegitimate suppliers exploit opaque supply lines to insert counterfeit, expired, or diverted stock into legal pharmacy channels.

### 3. Centralized Database Tampering & Opaque Silos
* Traditional logistics rely on centralized databases (SQL / MongoDB) managed by individual shipping vendors.
* **Vulnerable to Data Manipulation:** If a driver notices a freezer failure mid-transit, an operator or supervisor can alter log entries in their private database to conceal the breach and avoid financial penalties.
* **Credential Vulnerability:** Centralized accounts (passwords, JWTs, admin logins) are subject to phishing, credential stuffing, and unauthorized insider tampering.
* **Zero Patient Visibility:** Patients and clinics are kept entirely in the dark, with no direct way to audit the batch's origin and transit history.

### 4. The Blockchain "Oracle Problem" (*Garbage-In, Garbage-Out*)
* While blockchains guarantee that records cannot be altered *after* they are written, **they cannot verify if the data entered was true in the physical world**.
* If a negligent distributor types `4°C` into a blockchain portal while the freezer is actually at `22°C`, the blockchain immutably records a lie.
* **Sanjeevani's Solution:** We eliminate manual self-reporting by pairing on-chain smart contract invariants with an **AI/Computer Vision OCR engine**. Field workers must submit an authentic photo of the physical gauge; the AI extracts the temperature reading directly from the image, cross-checks it against user input, and rejects forged data before it ever reaches the blockchain.

---

## 📌 Key Innovations & Features

1. **Pure Blockchain Authentication (No Traditional Passwords)**
   - Access to create batches and record checkpoints is governed entirely by cryptographic wallet addresses on-chain.
   - Admin authorizes specific addresses for **Manufacturers** and **Distributors**. Unauthorized wallets are blocked by Solidity modifiers (`onlyManufacturer`, `onlyDistributor`, `onlyAdmin`).

2. **Automated Cold-Chain & Expiry Enforcement**
   - The Manufacturer locks in a Safe Temperature Range (e.g., $2^\circ\text{C}$ to $8^\circ\text{C}$) and an Expiry Date upon batch creation.
   - If a distributor logs a temperature outside this range, or if current time exceeds expiry, the smart contract permanently trips an irreversible `isCompromised` flag.

3. **Chain-of-Custody (Minimum Distributor Checkpoint) Rule**
   - The Manufacturer configures a minimum number of required distributor verifications.
   - If a customer scans a medicine that was verified at fewer checkpoints than required, the system displays a clear warning: `⚠️ INCOMPLETE CUSTODY CHAIN — NOT FULLY DOCUMENTED`.

4. **Solving the "Oracle Problem" via AI / OCR Verification**
   - Field distributors cannot simply type arbitrary numbers. They must upload a real photo of the physical thermometer/freezer gauge.
   - The FastAPI middleware runs an **AI/Computer Vision OCR model (Tesseract)** on the photo. If the detected gauge temperature does not match the distributor's typed reading (within $\pm 1.5^\circ\text{C}$ tolerance), the request is rejected before reaching the blockchain.

5. **Decentralized Storage (IPFS)**
   - Thermometer gauge photos are pinned to IPFS, generating a cryptographic Content Identifier (CID, e.g., `Qm...`).
   - Only the lightweight CID hash is stored on-chain, keeping blockchain transactions fast and gas-efficient while ensuring full auditability.

6. **Frictionless Public Patient Verification**
   - End patients and pharmacists do **not** need a crypto wallet, MetaMask, or ETH.
   - Scanning the physical QR code on the box directly loads the **Visual Authenticity Report** (Green `🛡️ SAFE & AUTHENTIC` or Red `🚨 BATCH COMPROMISED`).

---

## 🏗️ Architecture

```
                                [ Physical Medicine Box / QR Code ]
                                                 │
                                ┌────────────────┴────────────────┐
                                ▼ (Scan via Phone)                ▼ (Staff Portal)
                      [ Customer / Patient ]             [ Manufacturer / Distributor ]
                      No Wallet Needed (Gasless)           MetaMask Connected (RBAC)
                                │                                 │
                                └────────────────┬────────────────┘
                                                 │
                                                 ▼
                                     ┌───────────────────────┐
                                     │  Frontend Web Portal  │
                                     │   (HTML5, CSS3, JS)   │
                                     └───────────┬───────────┘
                                                 │
                     ┌───────────────────────────┴───────────────────────────┐
                     ▼ (AI Photo Check & IPFS)                               ▼ (Sign Tx / Query)
       ┌───────────────────────────┐                           ┌───────────────────────────┐
       │     FastAPI Middleware    │                           │    Ganache CLI (EVM)      │
       │  - Tesseract OCR Engine   │                           │    (PharmaChain.sol)      │
       │  - IPFS Content Hashing   │                           │  - Access Control (RBAC)  │
       │  - Web3.py Bridge         │                           │  - Temp/Expiry Latch      │
       └─────────────┬─────────────┘                           │  - Custody Log Array      │
                     │                                         └───────────────────────────┘
                     ▼ (Store Proofs)
       ┌───────────────────────────┐
       │   Local IPFS Storage      │
       │   (storage/ipfs/Qm...)    │
       └───────────────────────────┘
```

---

## 📂 Project Structure

```
Project_Sanjeevani/
│
├── contracts/
│   └── PharmaChain.sol          # Solidity 0.8.20 Smart Contract (RBAC, safety, events)
│
├── scripts/
│   └── deploy.py                # Compiles & deploys to Ganache CLI; bootstraps initial roles
│
├── backend/
│   ├── app.py                   # FastAPI application & HTTP API endpoints
│   ├── config.py                # Web3 connection & contract artifact loader
│   ├── services/
│   │   ├── ocr_service.py       # Tesseract OCR thermometer gauge validation
│   │   └── ipfs_service.py      # Cryptographic CID generation & content-addressable storage
│   └── storage/
│       └── ipfs/                # Local IPFS photo proof storage
│
├── frontend/
│   ├── index.html               # Main Navigation Hub & Public Batch Search
│   ├── verify.html              # The QR Destination: Authenticity Report + Distributor Transit Action
│   ├── manufacturer.html        # Manufacturer Portal: Mint batch & generate QR sticker
│   ├── admin.html               # Administrator Portal: Whitelist/revoke roles on-chain
│   ├── common.js                # Shared Web3, MetaMask, and FastAPI client logic
│   └── styles.css               # Clean clinical & cold-chain responsive styling
│
├── build/
│   ├── PharmaChain_ABI.json     # Compiled Contract ABI
│   └── deployed_contract.json   # Deployed Contract Address & Bootstrapped Roles
│
├── requirements.txt             # Python dependencies
└── README.md                    # Project documentation
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
* **Python 3.10+**
* **Node.js & npm** (for Ganache CLI)
* **Tesseract OCR** (`brew install tesseract` on macOS, or `apt install tesseract-ocr` on Linux)
* **MetaMask Extension** installed in your browser

Install Ganache CLI globally:
```bash
npm install -g ganache
```

---

### 2. Setup Virtual Environment & Dependencies
```bash
# Activate existing virtual environment
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

---

### 3. Start Ganache CLI
In **Terminal 1**, run Ganache listening on all network interfaces:
```bash
ganache -h 0.0.0.0 -p 8545
```
> Ganache will output 10 accounts and their private keys. Keep this terminal running!

---

### 4. Deploy Smart Contract
In **Terminal 2**, run the Python deployment script:
```bash
.venv/bin/python scripts/deploy.py
```
This script will:
* Compile `contracts/PharmaChain.sol` using Solidity `0.8.20`.
* Deploy the contract to Ganache via Account #0 (Admin).
* Pre-authorize **Account #1** as Manufacturer and **Accounts #2, #3, #4, and #5** as Distributors.
* Save the ABI and address to `build/deployed_contract.json`.

---

### 5. Start FastAPI Backend
In **Terminal 3**, launch the FastAPI server:
```bash
.venv/bin/uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
* **Swagger API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Health Check:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

---

### 6. Start the Frontend
In **Terminal 4**, start a lightweight local web server:
```bash
python3 -m http.server 3000 --bind 0.0.0.0 --directory frontend
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🦊 Configuring MetaMask for Local Testing

1. In MetaMask, go to **Networks $\rightarrow$ Add a Network $\rightarrow$ Add a network manually**:
   * **Network Name:** `Ganache CLI`
   * **New RPC URL:** `http://127.0.0.1:8545` *(or your local Wi-Fi IP if testing on mobile, e.g., `http://192.168.1.4:8545`)*
   * **Chain ID:** `1337`
   * **Currency Symbol:** `ETH`

2. Import test accounts from your Ganache terminal using their **Private Keys**:
   * **Account #0:** System Admin
   * **Account #1:** Manufacturer (Pfizer)
   * **Account #2:** Distributor #1
   * **Account #3:** Distributor #2
   * **Account #4:** Distributor #3
   * **Account #5:** Distributor #4

---

## 🎬 End-to-End Demonstration Workflow

### Step 1: Manufacturer Mints a Batch
1. Open **`http://localhost:3000/manufacturer.html`**.
2. Connect MetaMask (**Account #1: Manufacturer**).
3. Enter batch details:
   * **Batch ID:** `VAX-2026-001`
   * **Medicine Name:** `Covaxin Bio-Shield`
   * **Safe Temp Range:** `2°C` to `8°C`
   * **Required Checkpoints:** `2`
   * **Expiry Date:** Select a future date.
4. Click **"Mint Batch on Blockchain"** and approve the MetaMask popup.
5. An instant, printable **QR Code** is generated linking directly to the batch verification page.

---

### Step 2: Distributor Logs Transit Checkpoints
1. Scan or open the QR code URL: `http://localhost:3000/verify.html?batch=VAX-2026-001`.
2. Notice the top action bar: **"Are you the Logistics Distributor delivering this box?"**
3. Click **"Log Transit Checkpoint"** and switch MetaMask to **Account #2 (Distributor #1)**.
4. Enter:
   * **Location:** `Mumbai Central Cold Hub`
   * **Temperature:** `4.5°C`
   * **Photo:** Upload a photo of a thermometer gauge reading `4.5` (or any gauge image).
5. Click **"AI Verify & Anchor to Blockchain"**:
   * FastAPI runs OCR to cross-check the gauge photo against the typed reading.
   * Photo is saved to decentralized IPFS storage (`storage/ipfs/Qm...`).
   * MetaMask prompts the distributor to sign `updateTransit(...)`.
6. Repeat with **Account #3 (Distributor #2)** at `Delhi Regional Storage` with `5.0°C`.

---

### Step 3: Customer / Patient Verification (Mobile Scan)
1. Point your smartphone camera at the QR code on your laptop screen (or visit `verify.html?batch=VAX-2026-001`).
2. **No wallet or MetaMask required on the phone.**
3. The page immediately renders:
   * **`🛡️ FULLY VERIFIED & AUTHENTIC`** (All checkpoints logged within safe bounds).
   * Complete factory-to-pharmacy custody timeline with timestamps, locations, and clickable **"View Thermometer Photo Proof"** links.

---

### Step 4: The Cold-Chain Breach Simulation (Compromised Batch)
1. Switch to a distributor account and log an intentional freezer failure: `25.0°C`.
2. Submit the transaction.
3. Refresh the verification page:
   * The status immediately flashes **RED**: **`🚨 BATCH COMPROMISED — DO NOT CONSUME`**.
   * The smart contract permanently locks this state—protecting patients from spoiled medicine.

---

## 📜 Smart Contract API Summary

| Function | Access | Description |
| :--- | :--- | :--- |
| `mintBatch(...)` | `onlyManufacturer` | Creates a new batch with temp range, expiry, and min required checkpoints |
| `updateTransit(...)` | `onlyDistributor` | Appends a checkpoint log; trips `isCompromised` if temp is breached or expired |
| `setManufacturer(...)` | `onlyAdmin` | Whitelists or revokes a manufacturer address |
| `setDistributor(...)` | `onlyAdmin` | Whitelists or revokes a distributor address |
| `getBatchDetails(...)` | `public view` | Gasless read query returning batch metadata, custody count, and safety status |
| `getBatchHistory(...)` | `public view` | Gasless read query returning the full array of transit records and IPFS CIDs |

---

## 🛡️ License
This project is open-source and distributed under the [MIT License](LICENSE).
