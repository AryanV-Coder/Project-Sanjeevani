import json
import os
from pathlib import Path
from web3 import Web3

BASE_DIR = Path(__file__).resolve().parent.parent
BUILD_DIR = BASE_DIR / "build"
CONFIG_FILE = BUILD_DIR / "deployed_contract.json"
ABI_FILE = BUILD_DIR / "PharmaChain_ABI.json"

if not CONFIG_FILE.exists() or not ABI_FILE.exists():
    raise RuntimeError(
        "Build artifacts not found! Please run scripts/deploy.py first."
    )

with open(CONFIG_FILE, "r") as f:
    DEPLOYMENT_CONFIG = json.load(f)

with open(ABI_FILE, "r") as f:
    CONTRACT_ABI = json.load(f)

RPC_URL = DEPLOYMENT_CONFIG.get("rpcUrl", "http://127.0.0.1:8545")
CONTRACT_ADDRESS = DEPLOYMENT_CONFIG["contractAddress"]

w3 = Web3(Web3.HTTPProvider(RPC_URL))
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

