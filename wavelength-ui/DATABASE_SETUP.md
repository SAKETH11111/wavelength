# Database Architecture & Setup Guide

## Overview

Wavelength uses a comprehensive database architecture built on PostgreSQL with Prisma ORM and Supabase as the managed database provider. This setup provides user authentication, profile management, secure API key storage, usage tracking, and seamless migration from anonymous to authenticated users.

## Architecture Components

### 1. Database Provider: Supabase
- **Production Database**: Managed PostgreSQL with automatic backups
- **Real-time Features**: Built-in WebSocket support for live updates
- **Authentication**: Enhanced auth features with Row Level Security (RLS)
- **Storage**: Avatar uploads and file management
- **Cost-Effective**: Free tier with generous limits

### 2. ORM: Prisma
- **Type-Safe**: Full TypeScript integration
- **Migration System**: Version-controlled schema changes
- **Query Builder**: Intuitive database queries
- **Connection Pooling**: Efficient database connections

### 3. Database Schema

#### Core Tables
- **Users**: NextAuth.js compatible user management
- **UserProfiles**: Extended user preferences and settings
- **UserApiKeys**: Encrypted API key storage per provider
- **Chats**: Chat management with user attribution
- **Messages**: Message storage with cost tracking
- **UsageRecords**: Analytics and usage tracking
- **UserQuotaLimits**: Usage limits and quota management

#### Security Features
- **Encrypted API Keys**: AES encryption with user-specific salts
- **Row Level Security**: Database-level access control
- **Audit Trails**: Complete usage tracking and analytics
- **Anonymous Migration**: Seamless anonymous → authenticated flow

## Setup Instructions

### 1. Database Setup

1. **Create Supabase Project**
   ```bash
   # Visit https://supabase.com and create a new project
   # Note your database URL and anon/service keys
   ```

2. **Configure Environment Variables**
   ```bash
   # Update .env.local with your Supabase credentials
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   API_KEY_ENCRYPTION_KEY="your-32-byte-hex-key"
   NEXTAUTH_SECRET="your-nextauth-secret"
   NEXTAUTH_URL="http://localhost:3000"
   
   # OAuth Providers
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"
   ```

3. **Generate Encryption Key**
   ```bash
   # Generate secure encryption key
   node -p "require('crypto').randomBytes(32).toString('hex')"
   ```

### 2. Database Migration

1. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

2. **Push Schema to Database**
   ```bash
   npx prisma db push
   ```

3. **Verify Schema**
   ```bash
   npx prisma studio
   ```

### 3. OAuth Provider Setup

#### Google OAuth
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google`

#### GitHub OAuth
1. Visit [GitHub Developer Settings](https://github.com/settings/developers)
2. Create new OAuth App
3. Set authorization callback URL:
   - `http://localhost:3000/api/auth/callback/github`
   - `https://your-domain.com/api/auth/callback/github`

## Database Schema Details

### Security Architecture

```typescript
// API Key Encryption Flow
const { encryptedKey, keyHash } = ApiKeyEncryption.encrypt(apiKey, userId);
// Store encryptedKey and keyHash in database
// Decrypt only when needed for API calls
const plainKey = ApiKeyEncryption.decrypt(encryptedKey, userId);
```

### Data Migration Flow

```typescript
// Anonymous → Authenticated Migration
const migrationData = {
  chats: localStorageChats,
  config: userConfig,
  anonymousId: anonymousSessionId,
};

const result = await DataMigration.migrateAnonymousUserData(
  userId, 
  migrationData
);
```

### Usage Tracking

```typescript
// Automatic usage recording
await recordUsage(userId, provider, model, {
  requestCount: 1,
  inputTokens: 150,
  outputTokens: 300,
  cost: 0.004,
});
```

## API Endpoints

### Profile Management
- `GET /api/profile` - Get user profile and stats
- `PUT /api/profile` - Update user profile
- `DELETE /api/profile` - Deactivate account

### API Key Management
- `GET /api/profile/api-keys` - List user API keys
- `POST /api/profile/api-keys` - Add new API key
- `PUT /api/profile/api-keys/[id]` - Update API key
- `DELETE /api/profile/api-keys/[id]` - Delete API key

### Usage Analytics
- `GET /api/profile/usage` - Get usage analytics
- `POST /api/profile/usage` - Record usage (internal)

### Data Migration
- `POST /api/migration` - Migrate anonymous data
- `GET /api/migration/status` - Check migration status
- `PUT /api/migration/sync` - Sync localStorage data

## Development Workflow

### 1. Schema Changes
```bash
# Update schema.prisma
# Push changes to database
npx prisma db push

# Generate new client
npx prisma generate

# Optional: Create migration
npx prisma migrate dev --name "description"
```

### 2. API Key Testing
```typescript
// Test encryption/decryption
const encrypted = ApiKeyEncryption.encrypt("test-key", "user-id");
const decrypted = ApiKeyEncryption.decrypt(encrypted.encryptedKey, "user-id");
console.log(decrypted === "test-key"); // true
```

### 3. Data Migration Testing
```typescript
// Test migration locally
const testData = {
  chats: [], // Your test chats
  config: {}, // Your test config
  anonymousId: "test-anonymous-id",
};

const result = await DataMigration.migrateAnonymousUserData("test-user-id", testData);
```

## Production Considerations

### 1. Environment Variables
- Use secure, randomly generated secrets
- Store sensitive variables in your hosting platform
- Never commit secrets to version control

### 2. Database Security
- Enable Row Level Security in Supabase
- Set up proper database roles and permissions
- Regular security audits and updates

### 3. API Key Security
- Rotate encryption keys periodically
- Monitor for suspicious API key usage
- Implement rate limiting and usage quotas

### 4. Performance Optimization
- Database connection pooling
- Query optimization with proper indexes
- Caching strategies for frequently accessed data

## Monitoring & Analytics

### 1. Usage Tracking
- Real-time usage analytics per user
- Cost tracking and quota management
- Provider and model usage breakdown

### 2. System Health
- Database connection monitoring
- API response times
- Error tracking and alerting

### 3. User Analytics
- User registration and retention
- Feature usage patterns
- Migration success rates

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Check environment variables
   echo $DATABASE_URL
   
   # Test connection
   npx prisma db pull
   ```

2. **Migration Failures**
   ```bash
   # Reset database (development only)
   npx prisma migrate reset
   
   # Force push schema
   npx prisma db push --force-reset
   ```

3. **Encryption Errors**
   ```typescript
   // Verify encryption key is set
   console.log(process.env.API_KEY_ENCRYPTION_KEY?.length); // Should be 64
   
   // Test encryption
   const key = ApiKeyEncryption.generateEncryptionKey();
   console.log(key); // Use this as your encryption key
   ```

4. **NextAuth Session Issues**
   ```bash
   # Verify NextAuth configuration
   # Check OAuth provider credentials
   # Ensure correct callback URLs
   ```

## Security Best Practices

1. **API Key Management**
   - Never log decrypted API keys
   - Implement key rotation procedures
   - Monitor for key leaks

2. **Database Security**
   - Regular security patches
   - Strong password policies
   - Network security (VPC, firewalls)

3. **Application Security**
   - Input validation and sanitization
   - Rate limiting and DDoS protection
   - Regular security audits

4. **Data Privacy**
   - GDPR compliance considerations
   - Data retention policies
   - User data deletion procedures

## Next Steps

1. **Enhanced Features**
   - Real-time collaboration
   - Advanced analytics dashboard
   - Usage optimization recommendations

2. **Scalability**
   - Read replicas for scaling
   - Sharding strategies for large datasets
   - Caching layers (Redis)

3. **Integration**
   - Webhook system for external integrations
   - API for third-party access
   - Export/import functionality

This database architecture provides a solid foundation for Wavelength's growth while maintaining security, performance, and user experience as top priorities.