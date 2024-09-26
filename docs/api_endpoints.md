
# API Endpoints Documentation

## User Endpoints

### POST /register
- **Description**: Registers a new user.
- **Request**:
  ```json
  {
    "email": "string",
    "password": "string",
    "username": "string",
    "realname": "string",
    "wallet": "string (optional)"
  }
  ```
- **Response**:
  ```json
  {
    "token": "jwt-token",
    "user": {
      "id": "number",
      "email": "string",
      "username": "string",
      "realname": "string"
    }
  }
  ```

### POST /login
- **Description**: Authenticates a user.
- **Request**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "token": "jwt-token",
    "user": {
      "username": "string",
      "email": "string",
      "lastLogin": "Date"
    }
  }
  ```

### GET /profile
- **Description**: Retrieves the profile of the authenticated user.
- **Response**:
  ```json
  {
    "id": "number",
    "username": "string",
    "realname": "string",
    "email": "string",
    "balance": "number",
    "tokenBalance": "number",
    "avatar": "string (URL)",
    "aboutMe": "string",
    "isOwner": "boolean"
  }
  ```

### PUT /profile/:username
- **Description**: Updates the profile of the authenticated user.
- **Request**:
  ```json
  {
    "newUsername": "string",
    "realname": "string",
    "email": "string",
    "shareEmail": "boolean",
    "aboutMe": "string"
  }
  ```
- **Response**:
  ```json
  {
    "user": {
      "id": "number",
      "username": "string",
      "email": "string",
      "realname": "string"
    },
    "token": "jwt-token"
  }
  ```

### PUT /avatar
- **Description**: Updates the avatar of the authenticated user.
- **Request**: Multipart form-data
  - File: Avatar image
- **Response**:
  ```json
  {
    "message": "Avatar updated successfully",
    "avatar": "string (URL)"
  }
  ```

### GET /:username/avatars
- **Description**: Retrieves the list of avatar URLs for a specific user.
- **Response**:
  ```json
  {
    "avatars": [
      "string (URL)"
    ]
  }
  ```

### PUT /attach-public-key
- **Description**: Attaches a public key to the authenticated user.
- **Request**:
  ```json
  {
    "publicKey": "string"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Public key attached successfully",
    "publicKey": "string"
  }
  ```

### GET /search
- **Description**: Searches for users by username or realname.
- **Request**:
  - **Query**: `searchTerm`
- **Response**:
  ```json
  [
    {
      "id": "number",
      "username": "string",
      "realname": "string",
      "avatar": "string (URL)"
    }
  ]
  ```

---

## Token Endpoints

### GET /:walletAddress/balance
- **Description**: Retrieves the balance of a Solana wallet.
- **Response**:
  ```json
  {
    "balance": "number"
  }
  ```

### POST /token/send
- **Description**: Sends tokens from one wallet to another.
- **Request**:
  ```json
  {
    "from": "string",
    "to": "string",
    "amount": "number"
  }
  ```
- **Response**:
  ```json
  {
    "result": "string"
  }
  ```

### GET /transactions
- **Description**: Retrieves the list of token transactions.
- **Response**:
  ```json
  [
    {
      "transactionId": "string",
      "amount": "number",
      "from": "string",
      "to": "string",
      "timestamp": "Date"
    }
  ]
  ```

---

## Chat and Message Endpoints

### POST /private
- **Description**: Creates a private chat between two users.
- **Response**:
  ```json
  {
    "chatId": "number",
    "createdAt": "Date"
  }
  ```

### POST /group
- **Description**: Creates a group chat.
- **Response**:
  ```json
  {
    "chatId": "number",
    "createdAt": "Date"
  }
  ```

### GET /:chatId/messages
- **Description**: Retrieves messages for a specific chat.
- **Response**:
  ```json
  [
    {
      "messageId": "number",
      "content": "string",
      "senderId": "number",
      "chatId": "number",
      "createdAt": "Date"
    }
  ]
  ```

### POST /:chatId/messages
- **Description**: Sends a message to a specific chat.
- **Request**:
  ```json
  {
    "content": "string",
    "filePath": "string (optional)"
  }
  ```
- **Response**:
  ```json
  {
    "messageId": "number",
    "content": "string",
    "createdAt": "Date"
  }
  ```

---

## File Endpoints

### POST /file/upload
- **Description**: Uploads and encrypts a file.
- **Request**: Multipart form-data
  - File: The file to be uploaded
- **Response**:
  ```json
  {
    "filePath": "string (URL)"
  }
  ```

### GET /file/:filename
- **Description**: Downloads and decrypts a file.
- **Response**: Binary file data
