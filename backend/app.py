from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.config import w3, contract, CONTRACT_ADDRESS, CONTRACT_ABI, DEPLOYMENT_CONFIG, RPC_URL
from backend.services.ipfs_service import save_image_to_ipfs, get_ipfs_image_path
from backend.services.ocr_service import verify_thermometer_reading

# ========================================================
# FASTAPI APPLICATION & CORS
# ========================================================

app = FastAPI(
    title="Sanjeevani Middleware API",
    description="Decentralized Cold-Chain Tracking & AI Verification API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================================
# ROUTES
# ========================================================

@app.get("/")
def health_check():
    """System health check and network connectivity."""
    return {
        "status": "online",
        "system": "Sanjeevani Decentralized Cold-Chain",
        "contractAddress": CONTRACT_ADDRESS,
        "ganacheConnected": w3.is_connected()
    }

@app.get("/api/config")
def get_contract_config():
    """Provides contract configuration, ABI, and roles to the frontend."""
    return {
        "contractAddress": CONTRACT_ADDRESS,
        "abi": CONTRACT_ABI,
        "roles": DEPLOYMENT_CONFIG.get("roles", {}),
        "rpcUrl": RPC_URL
    }

@app.post("/api/verify-and-upload")
async def verify_and_upload_transit(
    temperature: float = Form(...),
    photo: UploadFile = File(...)
):
    """
    Dual-Verification Pipeline:
    1. AI/OCR cross-checks thermometer photo against typed temperature.
    2. Uploads and pins the photo to IPFS.
    3. Returns cryptographic CID hash for blockchain anchoring.
    """
    image_bytes = await photo.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image uploaded")

    # 1. AI Verification
    verification = verify_thermometer_reading(image_bytes, temperature)
    if not verification["verified"]:
        raise HTTPException(
            status_code=400,
            detail=(
                f"AI Verification Failed: Thermometer gauge reads {verification['detected_readings']}, "
                f"which does not match your entered temperature ({temperature}°C)."
            )
        )

    # 2. Decentralized Storage (IPFS)
    cid = save_image_to_ipfs(image_bytes)

    return {
        "verified": True,
        "imageCID": cid,
        "ipfsUrl": f"/ipfs/{cid}",
        "typedTemperature": temperature,
        "detectedReadings": verification["detected_readings"],
        "message": "AI verification successful. Photo pinned to IPFS."
    }

@app.get("/ipfs/{cid}")
def fetch_ipfs_image(cid: str):
    """Serves pinned thermometer proofs by their decentralized IPFS CID."""
    path = get_ipfs_image_path(cid)
    if not path:
        raise HTTPException(status_code=404, detail="CID not found in IPFS storage")
    return FileResponse(path, media_type="image/jpeg")

@app.get("/api/batch/{batch_id}")
def fetch_batch_data(batch_id: str):
    """Reads real-time state and transit history directly from the smart contract."""
    try:
        details = contract.functions.getBatchDetails(batch_id).call()
        history = contract.functions.getBatchHistory(batch_id).call()

        timeline = []
        for rec in history:
            timeline.append({
                "location": rec[0],
                "temperature": rec[1],
                "imageCID": rec[2],
                "ipfsUrl": f"/ipfs/{rec[2]}",
                "timestamp": rec[3],
                "loggedBy": rec[4]
            })

        min_checkpoints = details[5]
        checkpoint_count = len(timeline)
        is_under_documented = checkpoint_count < min_checkpoints

        return {
            "batchId": batch_id,
            "medicineName": details[0],
            "manufacturer": details[1],
            "expiryDate": details[2],
            "minTemp": details[3],
            "maxTemp": details[4],
            "minCheckpoints": min_checkpoints,
            "checkpointCount": checkpoint_count,
            "isUnderDocumented": is_under_documented,
            "isCompromised": details[7],
            "history": timeline
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Batch not found: {str(e)}")
