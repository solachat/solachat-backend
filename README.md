# Express 2025

## Overview
**Express 2025** is a server-side application built with **Express.js** in **TypeScript**. This project integrates with the **Solana blockchain** and provides a fully encrypted platform for managing wallets, users, and transactions. It leverages **PostgreSQL** for persistent storage, implements robust **AES-256-GCM** and **RSA** encryption for secure file and message handling, and uses **JWT** for authentication.

## Features
- **User Authentication**: Secure login and registration using JWT tokens.
- **Wallet Management**: Integration with Solana for wallet creation and token transfers.
- **Message Encryption**: AES-256 encryption for messages with HMAC-SHA256 for integrity.
- **File Encryption**: AES-256 encryption for files with RSA for key encryption.
- **WebRTC Call Encryption**: Secure real-time communication using DTLS in WebRTC.

## Requirements
- **Node.js** >= 14.x
- **Docker** (for containerization)
- **Solana CLI** (for blockchain interactions)
- **PostgreSQL** (for persistent data storage)

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/solacoin/express-2025.git
    cd express-2025
    ```

2. Install the dependencies:

    ```bash
    npm install
    ```

3. Configure the environment variables in the `.env` file based on `.env.example`:
    ```bash
    DATABASE_URL=your_database_url
    SOLANA_URL=your_solana_rpc_url
    JWT_SECRET=your_jwt_secret
    AES_SECRET_KEY=your_aes_secret_key (32 characters)
    HMAC_SECRET_KEY=your_hmac_secret_key (32 characters)
    ```

4. Set up Docker containers:

    ```bash
    docker-compose up
    ```

## Running the Project

### Development Mode

To run the project in development mode with hot-reloading:

```bash
npm run dev
```

### Production Mode
For running the application in a production environment:

```bash
npm start
```

## Project Structure

- **src/** — Main application code:
    - **controllers/** — Logic that handles incoming HTTP requests.
    - **services/** — Business logic interacting with external systems (e.g., Solana blockchain).
    - **models/** — Database models for PostgreSQL.
    - **routes/** — API routing definitions.
    - **middleware/** — JWT authentication and user verification.
    - **config/** — Configuration files for database and Solana RPC.
    - **encryption/** — AES and RSA encryption methods for secure file and message handling.
    - **utils/** — Utility functions (logging, database synchronization).

## API Documentation
Detailed API documentation is available in the [API Documentation](./docs/api_endpoints.md).

## Security and Encryption
The project uses industry-standard encryption algorithms:

- **AES-256-GCM** for symmetric encryption (messages, files).
- **RSA** for asymmetric encryption (file encryption keys).
- **HMAC-SHA256** for integrity verification of encrypted messages.
- **DTLS** for secure WebRTC communication.

More details are provided in the [Encryption Documentation](./docs/encryption.md).

## Contact
For any inquiries or contributions, please reach out via contact@solacoin.org.

24.10.2024 
Фронт и бэк был настроен с работой Google Cloud. 
Во время тестирования были выявлены следующие проблемы:

Долгое подключение пользователя к WebSocket
При отправке файла в чате не сразу отображается 
При отправке сообщения, надо ждать пару секунд, чтобы обработалось сервером
Лагает клавиатура в чате при вводе текста 
Не все функции обновляются через WebSocket

