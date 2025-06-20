# Soldex - Solana Blockchain Data Indexer

Soldex is a customizable Solana blockchain indexer that allows users to monitor specific transaction types and store the data in their own PostgreSQL databases. Built with React frontend and Express.js backend.

## 🚀 Features

- **Selective Monitoring**: Choose specific transaction types to monitor (NFT bids, token swaps, NFT sales, loans, etc.)
- **Personal Databases**: Each user connects their own PostgreSQL database for data storage
- **Real-time Indexing**: Uses Helius webhooks for real-time transaction monitoring
- **Dynamic Schema**: Only creates database tables for selected monitoring categories
- **Secure**: Encrypted database credentials and JWT authentication
- **Modern UI**: Clean React frontend with shadcn/ui components and modern design
- **Vercel Compatible**: Backend can be deployed to Vercel with modifications

## 📋 Supported Transaction Types

- **NFT Bids**: `NFT_BID`, `NFT_BID_CANCELLED`, `NFT_GLOBAL_BID`, `NFT_GLOBAL_BID_CANCELLED`
- **Token Prices**: `SWAP`, `ADD_TO_POOL`, `REMOVE_FROM_POOL`
- **NFT Prices**: `NFT_LISTING`, `NFT_SALE`, `NFT_AUCTION_CREATED`, `NFT_AUCTION_UPDATED`
- **Borrowable Tokens**: `LOAN`, `OFFER_LOAN`, `RESCIND_LOAN`, `TAKE_LOAN`

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Express Backend│    │   PostgreSQL    │
│                 │    │                 │    │   (User's DB)   │
│  - Authentication│◄──►│  - User Management  │◄──►│  - NFT Bids     │
│  - Dashboard    │    │  - Webhook Handler  │    │  - Token Prices │
│  - Configuration│    │  - Dynamic Schema   │    │  - NFT Prices   │
│                 │    │                 │    │  - Loans        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              ▲
                              │
                       ┌─────────────────┐
                       │  Helius Webhooks│
                       │                 │
                       │ - Real-time data│
                       │ - Solana events │
                       └─────────────────┘
```

## 🛠️ Setup

### Prerequisites

- Node.js (v18+)
- PostgreSQL database
- Helius API key
- ngrok (for webhook testing in development)

### Environment Variables

Create `.env` files in both `be/` and `fe/` directories:

**Backend (`be/.env`)**:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/app_db
HELIUS_API_KEY=your_helius_api_key
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

**Frontend (`fe/.env`)**:
```env
VITE_API_URL=http://localhost:3000
```

### Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd indexer
```

2. **Install dependencies**:
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd be
npm install

# Install frontend dependencies
cd ../fe
npm install
```

3. **Setup databases**:
```bash
# Setup main application database
cd be
npx prisma db push --schema prisma/app_schema.prisma
```

4. **Start the development servers**:

Terminal 1 (Backend):
```bash
cd be
npm run dev
```

Terminal 2 (Frontend):
```bash
cd fe
npm run dev
```

Terminal 3 (Tunnel for webhooks):
```bash
ngrok http 3000
```

## 🚀 Deployment

### Vercel Deployment

The backend is **compatible with Vercel** with the following modifications:

#### ✅ Vercel Compatibility Features:
- **Serverless Functions**: Uses direct SQL queries instead of file system operations
- **Dynamic Environment Detection**: Automatically detects Vercel environment
- **Production-ready**: Includes proper error handling and cleanup

#### 🔧 Vercel Setup:

1. **Deploy Backend to Vercel**:
```bash
cd be
vercel
```

2. **Set Environment Variables** in Vercel Dashboard:
```
DATABASE_URL=your_production_database_url
HELIUS_API_KEY=your_helius_api_key
JWT_SECRET=your_secure_jwt_secret
ENCRYPTION_KEY=your_secure_encryption_key
```

3. **Deploy Frontend to Vercel**:
```bash
cd fe
# Update VITE_API_URL in .env to your Vercel backend URL
vercel
```

#### ⚠️ Important Notes for Vercel:

- **File System**: Uses direct SQL commands instead of Prisma schema files
- **Process Execution**: Replaced `execSync` with direct database operations
- **Webhook URLs**: Automatically uses Vercel domain for webhook endpoints
- **Environment Detection**: Automatically switches to Vercel-compatible functions

### Traditional Server Deployment

For VPS/traditional hosting:

1. **Build the application**:
```bash
cd be
npm run build
npm start
```

2. **Process Manager** (PM2 recommended):
```bash
pm2 start dist/index.js --name "indexer-backend"
```

3. **Reverse Proxy** (Nginx recommended):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📖 API Documentation

### Authentication

#### POST `/api/signup`
Register a new user and setup their monitoring configuration.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "connectionString": "postgresql://user:pass@host:port/db",
  "categories": ["NFT_BID", "SWAP"],
  "tokenAddress": ["token_address_1", "token_address_2"],
  "heliusAPI": "your_helius_api_key"
}
```

**Response**:
```json
{
  "message": "User created",
  "token": "jwt_token",
  "webhookURL": "https://webhook-url"
}
```

#### POST `/api/login`
Authenticate an existing user.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Data Retrieval

#### GET `/api/webhook/getdata`
Get all indexed data for the authenticated user.

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "nftBids": [...],
  "tokenPrices": [...],
  "nftPrices": [...],
  "borrowableTokens": [...],
  "userCategories": ["NFT_BID", "SWAP"]
}
```

### Webhook Endpoint

#### POST `/api/webhook/:userId`
Receives and processes Helius webhook events.

## 💾 Database Schema

The system uses two schemas:

### App Schema (`app_schema.prisma`)
Stores user information and configurations:

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  password      String
  dbCredentials String   // Encrypted connection string
  categories    String[] // Selected monitoring categories
}
```

### User Schema (Dynamic)
Generated based on user's selected categories. Possible models:

```prisma
model NftBid {
  id         Int      @id @default(autoincrement())
  nftAddress String
  bidAmount  Decimal
  bidder     String
  timestamp  DateTime
}

model TokenPrice {
  id           Int      @id @default(autoincrement())
  tokenAddress String
  platform     String
  price        Decimal
  timestamp    DateTime
}

model NftPrices {
  id          Int      @id @default(autoincrement())
  nftId       String
  price       Decimal
  action      String
  platform    String?
  dateTime    DateTime
  buyer       String?
  seller      String?
}

model BorrowableTokens {
  id          Int      @id @default(autoincrement())
  nftId       String
  loanAmount  Decimal
  lender      String
  borrower    String?
  status      String
  offerDate   DateTime
  takenDate   DateTime?
  dueDate     DateTime?
}
```

## 🔄 How It Works

1. **User Registration**: 
   - User provides email, password, PostgreSQL connection string, and monitoring preferences
   - System validates database connection
   - Creates dynamic schema based on selected categories (Vercel: direct SQL, Local: Prisma)
   - Sets up Helius webhook for real-time monitoring

2. **Real-time Indexing**:
   - Helius sends webhook events for monitored transaction types
   - Backend processes events and stores data in user's database
   - Only attempts to store data for models that exist (based on user selections)

3. **Data Retrieval**:
   - Users can view their indexed data through the dashboard
   - API only queries models that should exist for the user
   - Graceful error handling for missing models

## 🔧 Key Features

### Dynamic Schema Generation
- **Local Development**: Uses Prisma schema files and migrations
- **Vercel Deployment**: Uses direct SQL commands for table creation
- Reduces database overhead and improves performance
- Automatic cleanup and error handling

### Secure Credential Management
- Database connection strings are encrypted before storage
- JWT-based authentication
- User credentials are never exposed in logs

### Vercel Compatibility
- **Environment Detection**: Automatically switches between local and Vercel modes
- **Serverless Optimized**: Uses direct SQL instead of file system operations
- **Production Ready**: Proper error handling and resource cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both local and Vercel deployment scenarios
5. Submit a pull request

## 📄 License

[Add your license information here]

## 🆘 Support

For issues and questions:
- Check the GitHub issues
- Review the API documentation
- Ensure your PostgreSQL database is properly configured
- Verify your Helius API key is valid
- For Vercel deployments, check environment variables in dashboard

## 🔗 Related Links

- [Helius API Documentation](https://docs.helius.xyz/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Solana Documentation](https://docs.solana.com/)
- [Vercel Documentation](https://vercel.com/docs) 