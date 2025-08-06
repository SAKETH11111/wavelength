import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

// Batch usage sync schema
const syncUsageSchema = z.object({
  usageRecords: z.array(z.object({
    provider: z.string(),
    model: z.string(),
    requestCount: z.number().default(1),
    inputTokens: z.number().default(0),
    outputTokens: z.number().default(0),
    reasoningTokens: z.number().default(0),
    totalTokens: z.number().optional(),
    cost: z.number().default(0),
    timestamp: z.string().optional(),
  })),
});

/**
 * POST /api/usage/sync - Batch sync usage records
 * Useful for syncing multiple usage records at once or handling failed syncs
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { usageRecords } = syncUsageSchema.parse(body);

    const syncResults = [];
    let successCount = 0;
    let errorCount = 0;

    for (const record of usageRecords) {
      try {
        const timestamp = record.timestamp ? new Date(record.timestamp) : new Date();
        const date = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
        const hour = timestamp.getHours();

        const totalTokens = record.totalTokens || 
          (record.inputTokens + record.outputTokens + record.reasoningTokens);

        // Upsert usage record
        await db.usageRecord.upsert({
          where: {
            userId_provider_model_date_hour: {
              userId: session.user.id,
              provider: record.provider,
              model: record.model,
              date,
              hour,
            },
          },
          update: {
            requestCount: { increment: record.requestCount },
            inputTokens: { increment: record.inputTokens },
            outputTokens: { increment: record.outputTokens },
            reasoningTokens: { increment: record.reasoningTokens },
            totalTokens: { increment: totalTokens },
            totalCost: { increment: record.cost },
            updatedAt: timestamp,
          },
          create: {
            userId: session.user.id,
            provider: record.provider,
            model: record.model,
            date,
            hour,
            requestCount: record.requestCount,
            inputTokens: record.inputTokens,
            outputTokens: record.outputTokens,
            reasoningTokens: record.reasoningTokens,
            totalTokens,
            totalCost: record.cost,
          },
        });

        // Update quota limits
        await db.userQuotaLimit.updateMany({
          where: {
            userId: session.user.id,
            isActive: true,
            OR: [
              { provider: null, model: null },
              { provider: record.provider, model: null },
              { provider: record.provider, model: record.model },
            ],
          },
          data: {
            usedRequests: { increment: record.requestCount },
            usedTokens: { increment: totalTokens },
            usedCost: { increment: record.cost },
            updatedAt: timestamp,
          },
        });

        syncResults.push({
          provider: record.provider,
          model: record.model,
          status: 'success',
        });
        successCount++;

      } catch (recordError) {
        console.error('Failed to sync usage record:', recordError);
        syncResults.push({
          provider: record.provider,
          model: record.model,
          status: 'error',
          error: recordError instanceof Error ? recordError.message : 'Unknown error',
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: errorCount === 0,
      data: {
        totalRecords: usageRecords.length,
        successCount,
        errorCount,
        results: syncResults,
      },
    });

  } catch (error) {
    console.error('Usage sync error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request format',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/usage/sync - Get sync status and pending operations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get recent usage records to show sync status
    const recentRecords = await db.usageRecord.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    // Check for any quotas that need reset
    const expiredQuotas = await db.userQuotaLimit.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        resetAt: {
          lte: new Date(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        recentSyncs: recentRecords.map(record => ({
          provider: record.provider,
          model: record.model,
          date: record.date,
          hour: record.hour,
          requests: record.requestCount,
          tokens: record.totalTokens,
          cost: Number(record.totalCost),
          lastUpdated: record.updatedAt,
        })),
        expiredQuotasCount: expiredQuotas.length,
        needsQuotaReset: expiredQuotas.length > 0,
        lastSyncTime: recentRecords[0]?.updatedAt || null,
      },
    });

  } catch (error) {
    console.error('Usage sync status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/usage/sync - Reset expired quotas
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find expired quotas
    const expiredQuotas = await db.userQuotaLimit.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        resetAt: {
          lte: now,
        },
      },
    });

    const resetResults = [];

    for (const quota of expiredQuotas) {
      // Calculate next reset time
      let nextReset: Date;
      
      switch (quota.type) {
        case 'daily':
          nextReset = new Date(now);
          nextReset.setDate(nextReset.getDate() + 1);
          nextReset.setHours(0, 0, 0, 0);
          break;
        case 'monthly':
          nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        default:
          nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }

      // Reset the quota
      await db.userQuotaLimit.update({
        where: { id: quota.id },
        data: {
          usedRequests: 0,
          usedTokens: 0,
          usedCost: 0,
          resetAt: nextReset,
          lastReset: now,
          updatedAt: now,
        },
      });

      resetResults.push({
        type: quota.type,
        provider: quota.provider,
        model: quota.model,
        nextReset: nextReset.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        resetCount: resetResults.length,
        resets: resetResults,
      },
    });

  } catch (error) {
    console.error('Quota reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}