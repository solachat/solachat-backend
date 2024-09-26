# Project Architecture

## Overview
The **Express 2025** project uses a microservice-inspired architecture, with key components designed to be modular and scalable. The application integrates with the Solana blockchain, PostgreSQL database, and provides secure, encrypted interactions for users.

## Components

### 1. **Controllers**
Controllers handle incoming HTTP requests and process them through business logic in services. Each controller is responsible for a specific domain, such as user management, tokens, and wallets.

- **UserController**: Manages user registration, login, and profile retrieval.
- **TokenController**: Handles the creation and management of Solana tokens.
- **WalletController**: Manages wallet interactions, including checking balances and transferring tokens.

### 2. **Services**
Services contain the core business logic and interact with external systems such as the Solana blockchain and PostgreSQL database.

- **SolanaService**: Communicates with the Solana blockchain via RPC to create wallets, transfer tokens, and retrieve balances.
- **UserService**: Handles user registration, authentication (using JWT), and profile retrieval.
- **TransactionService**: Manages transaction logging and facilitates transfers between wallets.

### 3. **Encryption**
The encryption module ensures that all sensitive data, such as messages and files, are securely encrypted before being stored or transferred. AES-256-GCM is used for encryption, while RSA handles key management for file encryption.

### 4. **Database (PostgreSQL)**
PostgreSQL is the primary database for storing user data, transactions, and wallet information. The project uses **Sequelize** as an ORM for interacting with the database and synchronizing models.

### 5. **WebSocket**
The project supports real-time communication for chat and notifications using WebSockets. Encrypted messages are securely transferred using WebSockets with end-to-end encryption.
