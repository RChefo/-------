import os
import base64
from Crypto.PublicKey import RSA
from Crypto.Cipher import AES, PKCS1_OAEP
from Crypto.Util.Padding import pad, unpad
from Crypto.Random import get_random_bytes

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_KEY_DIR = os.path.join(_PROJECT_ROOT, 'keys')
_PRIVATE_KEY_PATH = os.path.join(_KEY_DIR, 'server_private.pem')
_PUBLIC_KEY_PATH = os.path.join(_KEY_DIR, 'server_public.pem')


def _ensure_keys():
    os.makedirs(_KEY_DIR, exist_ok=True)
    if not os.path.exists(_PRIVATE_KEY_PATH):
        key = RSA.generate(2048)
        with open(_PRIVATE_KEY_PATH, 'wb') as f:
            f.write(key.export_key())
        with open(_PUBLIC_KEY_PATH, 'wb') as f:
            f.write(key.publickey().export_key())


def _load_private_key():
    _ensure_keys()
    with open(_PRIVATE_KEY_PATH, 'rb') as f:
        return RSA.import_key(f.read())


def hybrid_decrypt_first_message(encrypted_key_b64: str, encrypted_data_b64: str):
    """RSA-decrypt the AES key, then AES-CBC-decrypt the payload.
    Returns (plaintext_str, aes_key_bytes)."""
    private_key = _load_private_key()
    cipher_rsa = PKCS1_OAEP.new(private_key)
    aes_key = cipher_rsa.decrypt(base64.b64decode(encrypted_key_b64))

    raw = base64.b64decode(encrypted_data_b64)
    iv, ciphertext = raw[:16], raw[16:]
    cipher_aes = AES.new(aes_key, AES.MODE_CBC, iv)
    plaintext = unpad(cipher_aes.decrypt(ciphertext), AES.block_size).decode('utf-8')
    return plaintext, aes_key


def hybrid_encrypt(aes_key: bytes, plaintext: str) -> str:
    """AES-256-CBC encrypt plaintext with given key. Returns base64(IV + ciphertext)."""
    iv = get_random_bytes(16)
    cipher = AES.new(aes_key, AES.MODE_CBC, iv)
    ciphertext = cipher.encrypt(pad(plaintext.encode('utf-8'), AES.block_size))
    return base64.b64encode(iv + ciphertext).decode('utf-8')


def hybrid_decrypt(aes_key: bytes, encrypted_b64: str) -> str:
    """Reverse of hybrid_encrypt. Returns plaintext string."""
    raw = base64.b64decode(encrypted_b64)
    iv, ciphertext = raw[:16], raw[16:]
    cipher = AES.new(aes_key, AES.MODE_CBC, iv)
    return unpad(cipher.decrypt(ciphertext), AES.block_size).decode('utf-8')


def aes_encrypt(key: bytes, plaintext: str) -> str:
    """AES-256-CBC encrypt. Returns base64(IV + ciphertext)."""
    return hybrid_encrypt(key, plaintext)


def aes_decrypt(key: bytes, ciphertext_b64: str) -> str:
    """AES-256-CBC decrypt. Returns plaintext string."""
    return hybrid_decrypt(key, ciphertext_b64)
