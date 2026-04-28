import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes

_DEFAULT_KEY = b'C2Sim_SharedKey_2026_AES256Bytes!'

def _get_key() -> bytes:
    raw = os.environ.get('CRYPTO_SHARED_KEY', '').encode()
    if len(raw) == 32:
        return raw
    return _DEFAULT_KEY


def encrypt_data(plaintext: str) -> bytes:
    """Returns IV[16] + ciphertext bytes."""
    key = _get_key()
    iv = get_random_bytes(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    ciphertext = cipher.encrypt(pad(plaintext.encode('utf-8'), AES.block_size))
    return iv + ciphertext


def decrypt_data(data: bytes) -> bytes:
    """Expects IV[16] + ciphertext. Returns plaintext bytes."""
    key = _get_key()
    iv, ciphertext = data[:16], data[16:]
    cipher = AES.new(key, AES.MODE_CBC, iv)
    return unpad(cipher.decrypt(ciphertext), AES.block_size)
