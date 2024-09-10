# Solacoin Backend

## Description
This is the backend for the Solacoin cryptocurrency project, built using the Solana blockchain to manage tokens and PostgreSQL for storing user and transaction data.

The project supports wallet creation, sending SPL tokens, and managing token balances.

## Tech Stack
- **Node.js**: Backend language.
- **Express**: Web framework for building the API.
- **Solana Web3.js**: Interacts with the Solana blockchain.
- **PostgreSQL**: Database for storing users and transactions.
- **Sequelize**: ORM for working with PostgreSQL.
- **Docker**: For containerizing the application and the database.
- **JWT**: For user authentication.

## Installation and Setup

### Step 1: Clone the repository

```
git clone https://github.com/solacoin/express-2025.git
cd solacoin-backend
```

### Step 2: Configure environment variables

Create a `.env` file in the root directory and add the following variables:

```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
TOKEN_MINT_ADDRESS=CiNMmohyVzNq43GtVubLpCMAzGwgJUe4MFxVGNfEiUYG
JWT_SECRET=my_super_secret_key
PORT=4000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
DB_LOGGING=true
```

### Step 4: Docker setup

To run the backend with Docker, make sure Docker is installed on your machine.

1. Create a `Dockerfile` for the Node.js Backend:
```
# Dockerfile
FROM node:16

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start"]
```

2. Create a `docker-compose.yml` file to configure Docker services:
```
version: '3.8'

services:
  app:
    build: .
    ports:
      - "4000:4000"
    env_file:
      - .env
    depends_on:
      - db
    networks:
      - solacoin-network

  db:
    image: postgres:13
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - solacoin-network

networks:
  solacoin-network:

volumes:
  db-data:
```

### Step 5: Run the application with Docker
To start both the Node.js backend and the PostgreSQL database, run:
```
docker-compose up
```

### Step 6: Database migration

To ensure that all tables are created in the database, run the following command:
```
npm run sync-db
```

## API Endpoints

### Authentication

- **POST /register** - Regiater a new user.
- **POST /login** - Log in an existing user and get a JWT token.

### Wallet

- **POST /wallet/create** - Create a new Solana wallet.
- **GET /wallet/balance** - Get the balance of a Solana wallet.

### Token

- **POST /token/create** - Create a new SPL token.
- **GET /token/publickey/balance** - Get the balance of a specific SPL token.
- **POST /token/send** - Send SPL tokens from one wallet to another.

## Contributing

If you'd like to contribute to the project, please create a pull request or open an issue.

## License

This project is licensed under the MIT License.
