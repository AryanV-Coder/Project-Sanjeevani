import json
import os
import sys
from web3 import Web3
from solcx import compile_standard, install_solc, set_solc_version

# Configuration for Terminal Ganache CLI
GANACHE_URL = os.getenv("GANACHE_URL", "http://127.0.0.1:8545")
SOLC_VERSION = "0.8.20"
CONTRACT_FILE = "pharma_chain.sol"
OUTPUT_DIR = "build"

def main():
    print(f"Connecting to Ganache CLI at {GANACHE_URL}...")
    w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    
    # Check Ganache connection
    if not w3.is_connected():
        print("\n❌ Error: Cannot connect to Ganache CLI at " + GANACHE_URL)
        print("Please start Ganache in a separate terminal by running:")
        print("    ganache")
        sys.exit(1)

    accounts = w3.eth.accounts
    if not accounts:
        print("❌ Error: No accounts found in Ganache.")
        sys.exit(1)

    admin_account = accounts[0]
    print(f"Connected to Ganache CLI successfully!")
    print(f"Admin / Deployer Account: {admin_account}")
    print(f"Admin Balance:           {w3.from_wei(w3.eth.get_balance(admin_account), 'ether')} ETH\n")

    # Ensure Solidity compiler is installed
    print(f"Setting up Solidity compiler (solc v{SOLC_VERSION})...")
    try:
        install_solc(SOLC_VERSION)
        set_solc_version(SOLC_VERSION)
    except Exception as e:
        print(f"Note on compiler installation: {e}")

    # Read the contract
    if not os.path.exists(CONTRACT_FILE):
        print(f"❌ Error: {CONTRACT_FILE} not found!")
        sys.exit(1)

    with open(CONTRACT_FILE, "r") as f:
        contract_source = f.read()

    print(f"Compiling {CONTRACT_FILE}...")
    compiled_sol = compile_standard(
        {
            "language": "Solidity",
            "sources": {CONTRACT_FILE: {"content": contract_source}},
            "settings": {
                "outputSelection": {
                    "*": {
                        "*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]
                    }
                }
            },
        },
        solc_version=SOLC_VERSION,
    )

    contract_data = compiled_sol["contracts"][CONTRACT_FILE]["PharmaChain"]
    abi = contract_data["abi"]
    bytecode = contract_data["evm"]["bytecode"]["object"]

    # Deploy contract
    print("Deploying PharmaChain contract to Ganache CLI...")
    PharmaChain = w3.eth.contract(abi=abi, bytecode=bytecode)

    tx_hash = PharmaChain.constructor().transact({"from": admin_account})
    print(f"Transaction submitted: {tx_hash.hex()}")
    
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    contract_address = tx_receipt.contractAddress
    print(f"\n🎉 Contract successfully deployed!")
    print(f"Contract Address: {contract_address}")
    print(f"Gas Used:         {tx_receipt.gasUsed}")
    print(f"Block Number:     {tx_receipt.blockNumber}")

    # Authorize initial roles using default Ganache CLI accounts
    contract_instance = w3.eth.contract(address=contract_address, abi=abi)
    sample_roles = {}
    if len(accounts) >= 3:
        mfg_account = accounts[1]
        dist_account = accounts[2]
        print("\nConfiguring initial roles on-chain...")
        
        # Authorize Manufacturer (Account #1)
        tx1 = contract_instance.functions.setManufacturer(mfg_account, True).transact({"from": admin_account})
        w3.eth.wait_for_transaction_receipt(tx1)
        print(f"  Authorized Manufacturer: {mfg_account}")
        
        # Authorize Distributor (Account #2)
        tx2 = contract_instance.functions.setDistributor(dist_account, True).transact({"from": admin_account})
        w3.eth.wait_for_transaction_receipt(tx2)
        print(f"  Authorized Distributor:  {dist_account}")

        sample_roles = {
            "admin": admin_account,
            "manufacturer": mfg_account,
            "distributor": dist_account
        }

    # Save artifacts for FastAPI & Frontend
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    abi_path = os.path.join(OUTPUT_DIR, "PharmaChain_ABI.json")
    with open(abi_path, "w") as f:
        json.dump(abi, f, indent=2)
    print(f"\nSaved ABI to: {abi_path}")

    deployment_info = {
        "contractAddress": contract_address,
        "admin": admin_account,
        "roles": sample_roles,
        "network": "ganache-cli",
        "rpcUrl": GANACHE_URL,
        "transactionHash": tx_hash.hex(),
        "blockNumber": tx_receipt.blockNumber
    }
    
    config_path = os.path.join(OUTPUT_DIR, "deployed_contract.json")
    with open(config_path, "w") as f:
        json.dump(deployment_info, f, indent=2)
    print(f"Saved deployment metadata to: {config_path}")
    print("\n✅ Setup complete! Ready for FastAPI backend on http://127.0.0.1:8545")

if __name__ == "__main__":
    main()
