import hashlib
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
IPFS_STORAGE_DIR = BASE_DIR / "storage" / "ipfs"
IPFS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

def generate_cid(data: bytes) -> str:
    """Computes standard IPFS CIDv0 hash (Qm...) from binary data."""
    digest = hashlib.sha256(data).digest()
    multihash = b"\x12\x20" + digest  # 0x12 = sha256, 0x20 = 32 bytes length
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    num = int.from_bytes(multihash, "big")
    res = ""
    while num > 0:
        num, rem = divmod(num, 58)
        res = alphabet[rem] + res
    return res

def save_image_to_ipfs(image_bytes: bytes) -> str:
    """Saves image bytes using its CID as the filename in decentralized storage."""
    cid = generate_cid(image_bytes)
    target_path = IPFS_STORAGE_DIR / f"{cid}.jpg"
    with open(target_path, "wb") as f:
        f.write(image_bytes)
    return cid

def get_ipfs_image_path(cid: str) -> Path | None:
    """Returns local path to stored IPFS image, or None if not found."""
    target_path = IPFS_STORAGE_DIR / f"{cid}.jpg"
    if target_path.exists():
        return target_path
    return None

