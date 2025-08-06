# Real-Time Usage Quotas and Limits Tracking Implementation

## Overview

This implementation provides comprehensive real-time usage tracking and quota enforcement for the Wavelength AI chat interface. The system tracks usage at multiple levels (anonymous, authenticated users) and enforces limits to prevent overuse while providing clear feedback to users.

## Architecture Components

### Core Services

1. **UsageTracker** (`src/lib/usage-tracker.ts`)
   - Centralized service for quota checking and usage recording
   - Handles both anonymous and authenticated users
   - Integrates with database for persistent storage
   - Provides quota enforcement before API calls

2. **UsageSyncService** (`src/lib/usage-sync.ts`)
   - Background service for syncing actual usage from completed tasks
   - Handles reconciliation between estimated and actual usage
   - Provides resilient retry mechanism for failed syncs

3. **useUsageTracking Hook** (`src/hooks/useUsageTracking.ts`)
   - React hook for real-time usage status in components
   - Provides quota checking functionality
   - Auto-refreshes usage data periodically

### API Endpoints

#### `/api/usage/check` - Quota Validation
- **POST**: Check if a request can proceed based on quotas
- **GET**: Get current usage status
- Handles both anonymous and authenticated users
- Returns detailed quota information and remaining limits

#### `/api/usage/init` - User Initialization
- **POST**: Initialize default quotas for new users
- **GET**: Check if user needs quota initialization
- Sets up tier-based limits (free/pro)

#### `/api/usage/status` - Real-time Monitoring
- **GET**: Get comprehensive usage status for monitoring
- Returns quota percentages, alerts, and overall health status

#### `/api/usage/sync` - Batch Operations
- **POST**: Batch sync multiple usage records
- **GET**: Get sync status and pending operations
- **PUT**: Reset expired quotas

#### Enhanced `/api/profile/usage` - Analytics
- Existing endpoint enhanced with real-time quota data
- Provides detailed usage analytics and breakdowns

### Database Integration

#### Schema Components (Already Exists)
```sql
-- Usage tracking with hourly granularity
usage_records (userId, provider, model, date, hour, requestCount, tokens, cost)

-- User quota limits with flexible scoping
user_quota_limits (userId, type, provider, model, limits, usage, resetAt)

-- Anonymous session tracking
anonymous_sessions (anonymousId, sessionData, messageCount, migratedToUserId)
```

#### Quota Types Supported
- **Daily Limits**: Reset at midnight
- **Monthly Limits**: Reset on first day of month
- **Provider-Specific**: Limits per provider (openai, anthropic, etc.)
- **Model-Specific**: Limits per specific model
- **General Limits**: Overall usage limits

### Frontend Integration

#### Real-time Quota Enforcement
1. **Pre-request Validation**: ChatInput checks quotas before sending messages
2. **Visual Feedback**: UsageWarning component shows approaching limits
3. **Upgrade Prompts**: Automatic upgrade prompts for anonymous users
4. **Error Handling**: Graceful handling of quota exceeded errors

#### Components Enhanced
- **ChatInput**: Integrated quota checking and usage tracking
- **UsageWarning**: Real-time usage warnings and upgrade prompts
- **Layout**: Auto-initialization of usage tracking
- **Settings/Usage**: Comprehensive usage dashboard (already exists)

### User Experience Features

#### Anonymous Users
- **50 messages/day limit** tracked in localStorage
- **Real-time countdown** of remaining messages
- **Upgrade prompts** when approaching limit
- **Seamless migration** to authenticated usage when signing up

#### Authenticated Users
- **Tier-based limits**: Free (500 daily) vs Pro (5000 daily)
- **Multiple quota types**: Daily, monthly, provider, model-specific
- **Real-time tracking**: Live updates of usage and remaining quotas
- **Detailed analytics**: Comprehensive usage dashboard with charts

## Flow Diagrams

### Message Send Flow with Usage Tracking

```
User sends message
       ↓
ChatInput.handleSendMessage()
       ↓
checkQuota(provider, model, estimatedTokens)
       ↓
    Can proceed? ──No──→ Show quota exceeded error
       ↓ Yes
Send to /api/responses
       ↓
Pre-request quota check in API
       ↓
    Can proceed? ──No──→ Return 429 with quota details
       ↓ Yes
Create background task
       ↓
Schedule usage tracking (trackTaskUsage)
       ↓
Poll task until completion
       ↓
Record actual usage (UsageTracker.recordUsage)
       ↓
Update database and quotas
```

### Anonymous User Limit Enforcement

```
Anonymous user sends message
       ↓
Check localStorage limit (AnonymousSessionManager)
       ↓
    At limit? ──Yes──→ Show auth modal
       ↓ No
Send message
       ↓
Increment local counter
       ↓
    Approaching limit? ──Yes──→ Show upgrade prompt
       ↓
Continue
```

## Configuration

### Default Quota Limits

#### Anonymous Users
- **Daily Messages**: 50
- **Reset**: Midnight local time
- **Storage**: Browser localStorage
- **Migration**: Seamless when signing up

#### Free Tier Users
- **Daily Requests**: 500
- **Daily Tokens**: 100,000
- **Daily Cost**: $5.00
- **Monthly Requests**: 5,000
- **Monthly Tokens**: 1,000,000
- **Monthly Cost**: $50.00

#### Pro Tier Users
- **Daily Requests**: 5,000
- **Daily Tokens**: 1,000,000
- **Daily Cost**: $50.00
- **Monthly Requests**: 50,000
- **Monthly Tokens**: 10,000,000
- **Monthly Cost**: $500.00

### Environment Variables
No additional environment variables required. Uses existing database connection.

## Implementation Details

### Database Operations
- **Atomic Operations**: All quota updates use database transactions
- **Efficient Queries**: Optimized with proper indexes and upserts
- **Hourly Aggregation**: Usage grouped by hour for detailed analytics
- **Automatic Cleanup**: Old completed sync jobs are automatically removed

### Error Handling
- **Graceful Degradation**: Quota check failures don't block requests
- **Retry Logic**: Failed usage syncs retry up to 5 times
- **User Feedback**: Clear error messages with specific quota information
- **Logging**: Comprehensive logging for debugging and monitoring

### Performance Considerations
- **Non-blocking**: Usage tracking doesn't slow down chat responses
- **Background Processing**: Actual usage sync happens asynchronously
- **Efficient Updates**: Batch operations for multiple quota updates
- **Caching**: Front-end caches usage data with periodic refreshes

### Security Features
- **User Isolation**: All queries scoped to user ID
- **Anonymous Tracking**: No sensitive data in localStorage
- **Rate Limiting**: Built-in quota enforcement prevents abuse
- **Validation**: All inputs validated with Zod schemas

## Usage Examples

### Check Quota Before Request
```typescript
import { useUsageTracking } from '@/hooks/useUsageTracking';

const { checkQuota } = useUsageTracking();

const quotaCheck = await checkQuota('openai', 'gpt-4', 1000, 0.02);
if (!quotaCheck.canProceed) {
  console.log('Quota exceeded:', quotaCheck.reasons);
  return;
}
```

### Get Current Usage Status
```typescript
const { usageStatus, getUsageStats } = useUsageTracking();
const stats = getUsageStats();

console.log('Daily requests:', stats?.dailyRequests);
console.log('Remaining:', stats?.remainingRequests);
```

### Initialize User Quotas
```typescript
// Automatic on sign-in, or manual:
await fetch('/api/usage/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tier: 'pro' }),
});
```

## Monitoring and Analytics

### Real-time Status Endpoint
```bash
GET /api/usage/status
# Returns overall status, quota percentages, alerts
```

### Batch Sync Operations
```bash
POST /api/usage/sync
# Sync multiple usage records at once

PUT /api/usage/sync
# Reset expired quotas
```

### Usage Analytics Dashboard
Available at `/settings/usage` with:
- **Time-series Charts**: Daily usage over time
- **Provider Breakdown**: Usage by AI provider
- **Model Analytics**: Most used models and costs
- **Quota Status**: Real-time quota monitoring
- **Export Functionality**: Download usage data

## Testing

### Test Scenarios Covered
1. **Anonymous Limit Enforcement**: 50 message daily limit
2. **Quota Checking**: Pre-request validation
3. **Usage Recording**: Actual vs estimated reconciliation
4. **Quota Reset**: Automatic reset at midnight/month start
5. **Upgrade Flows**: Anonymous to authenticated migration
6. **Error Handling**: Network failures, quota exceeded
7. **Sync Resilience**: Failed sync retry logic

### Manual Testing Steps
1. **Anonymous Usage**: Send 50+ messages as anonymous user
2. **Quota Exceeded**: Set low quota limits and exceed them
3. **Usage Analytics**: Check dashboard for accurate data
4. **Sync Validation**: Verify actual usage matches estimates
5. **Reset Testing**: Wait for quota reset periods

## Deployment Considerations

### Database Migrations
Ensure the Prisma schema is up-to-date:
```bash
npx prisma generate
npx prisma db push
```

### Monitoring Setup
- Monitor `/api/usage/status` endpoint for quota health
- Set up alerts for users approaching limits
- Track sync job success rates
- Monitor database performance for usage queries

### Performance Tuning
- Index optimization for usage_records table
- Connection pooling for high-volume usage recording
- Consider read replicas for analytics queries
- Cache frequently accessed quota data

## Conclusion

This comprehensive implementation provides:
- **Real-time quota enforcement** preventing overuse
- **Seamless user experience** with clear feedback
- **Flexible quota system** supporting multiple limit types
- **Comprehensive analytics** for usage monitoring
- **Robust error handling** and graceful degradation
- **Performance optimization** for high-volume usage

The system is production-ready and handles both anonymous and authenticated users with appropriate limits and upgrade paths.