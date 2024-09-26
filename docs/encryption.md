# Encryption Documentation

## Overview
The **encryption module** in this project ensures secure communication and storage of sensitive data, such as messages and files. The module uses **AES-256-GCM** for encryption, **RSA** for secure key management, and **HMAC-SHA256** for integrity verification.

## 1. **Message Encryption**

- **Algorithm**: AES-256-GCM
- **Integrity**: HMAC-SHA256
- **File**: `src/encryption/messageEncryption.ts`

### Functions:
- **encryptMessage(text: string)**: Encrypts a given text message using AES and returns the encrypted content along with an HMAC for integrity.
- **decryptMessage(hash: { iv: string, content: string, authTag: string, hmac: string })**: Decrypts the message, validates the HMAC for integrity, and returns the original message.

## 2. **File Encryption**

- **Algorithm**: AES-256-GCM for file encryption, RSA for key management.
- **File**: `src/encryption/fileEncryption.ts`

### Functions:
- **encryptFile(filePath: string, outputFilePath: string)**: Encrypts a file using AES and RSA for secure key storage. Saves the metadata (IV, auth tag) along with the file.
- **decryptFile(filePath: string, outputFilePath: string)**: Decrypts a file by first decrypting the AES key using RSA, then decrypting the file contents using the AES key.

## 3. **WebRTC Call Encryption**

- **Protocol**: DTLS (Datagram Transport Layer Security)
- **File**: `src/encryption/callEncryption.ts`

This ensures that all WebRTC calls are encrypted using DTLS, providing end-to-end encryption for real-time communication.
