import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

// Query parameter validation
const usageQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month', 'all']).default('month'),
  provider: z.string().optional(),
  model: z.string().optional(),
});

/**
 * GET /api/profile/usage - Get user usage analytics
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

    const { searchParams } = new URL(request.url);
    const query = usageQuerySchema.parse({
      period: searchParams.get('period') || 'month',
      provider: searchParams.get('provider') || undefined,
      model: searchParams.get('model') || undefined,
    });

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (query.period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Build where clause
    const whereClause: any = {
      userId: session.user.id,
      createdAt: {
        gte: startDate,
      },
    };

    if (query.provider) {
      whereClause.provider = query.provider;
    }

    if (query.model) {
      whereClause.model = query.model;
    }

    // Get aggregated usage data
    const usageData = await db.usageRecord.groupBy({
      by: ['provider', 'model', 'date'],
      where: whereClause,
      _sum: {
        requestCount: true,
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        totalCost: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Get overall totals
    const totals = await db.usageRecord.aggregate({
      where: whereClause,
      _sum: {
        requestCount: true,
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        reasoningTokens: true,
        totalCost: true,
      },
    });

    // Get provider breakdown
    const providerBreakdown = await db.usageRecord.groupBy({
      by: ['provider'],
      where: whereClause,
      _sum: {
        requestCount: true,
        totalTokens: true,
        totalCost: true,
      },
      orderBy: {
        _sum: {
          totalCost: 'desc',
        },
      },
    });

    // Get model breakdown
    const modelBreakdown = await db.usageRecord.groupBy({
      by: ['model'],
      where: whereClause,
      _sum: {
        requestCount: true,
        totalTokens: true,
        totalCost: true,
      },
      orderBy: {
        _sum: {
          totalCost: 'desc',
        },
      },
      take: 10, // Top 10 models
    });

    // Get current quota limits
    const quotaLimits = await db.userQuotaLimit.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        type: true,
        provider: true,
        model: true,
        requestLimit: true,
        tokenLimit: true,
        costLimit: true,
        usedRequests: true,
        usedTokens: true,
        usedCost: true,
        resetAt: true,
      },
    });

    // Calculate daily usage for the current period
    const dailyUsage = await db.usageRecord.groupBy({
      by: ['date'],
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
        },
      },
      _sum: {
        requestCount: true,
        totalTokens: true,
        totalCost: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        period: query.period,
        dateRange: {
          start: startDate,
          end: now,
        },
        totals: {
          requests: totals._sum.requestCount || 0,
          tokens: {
            total: totals._sum.totalTokens || 0,
            input: totals._sum.inputTokens || 0,
            output: totals._sum.outputTokens || 0,
            reasoning: totals._sum.reasoningTokens || 0,
          },
          cost: totals._sum.totalCost || 0,
        },
        breakdown: {
          providers: providerBreakdown.map(p => ({
            provider: p.provider,
            requests: p._sum.requestCount || 0,
            tokens: p._sum.totalTokens || 0,
            cost: p._sum.totalCost || 0,
          })),
          models: modelBreakdown.map(m => ({
            model: m.model,
            requests: m._sum.requestCount || 0,
            tokens: m._sum.totalTokens || 0,
            cost: m._sum.totalCost || 0,
          })),
        },
        dailyUsage: dailyUsage.map(d => ({
          date: d.date,
          requests: d._sum.requestCount || 0,
          tokens: d._sum.totalTokens || 0,
          cost: d._sum.totalCost || 0,
        })),
        quotaLimits,
        rawData: usageData.map(r => ({
          provider: r.provider,
          model: r.model,
          date: r.date,
          requests: r._sum.requestCount || 0,
          tokens: {
            total: r._sum.totalTokens || 0,
            input: r._sum.inputTokens || 0,
            output: r._sum.outputTokens || 0,
            reasoning: r._sum.reasoningTokens || 0,
          },
          cost: r._sum.totalCost || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Usage analytics error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters',
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
 * POST /api/profile/usage - Record usage (internal API)
 */
export async function POST(request: NextRequest) {
  try {
    // This endpoint is for internal use by the AI providers
    // to record usage after API calls
    
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      provider,
      model,
      requestCount = 1,
      inputTokens = 0,
      outputTokens = 0,
      reasoningTokens = 0,
      cost = 0,
    } = body;

    if (!provider || !model) {
      return NextResponse.json(
        { success: false, error: 'Provider and model are required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hour = now.getHours();

    // Create or update usage record
    const usageRecord = await db.usageRecord.upsert({
      where: {
        userId_provider_model_date_hour: {
          userId: session.user.id,
          provider,
          model,
          date,
          hour,
        },
      },
      update: {
        requestCount: {
          increment: requestCount,
        },
        inputTokens: {
          increment: inputTokens,
        },
        outputTokens: {
          increment: outputTokens,
        },
        reasoningTokens: {
          increment: reasoningTokens,
        },
        totalTokens: {
          increment: inputTokens + outputTokens + reasoningTokens,
        },
        totalCost: {
          increment: cost,
        },
        updatedAt: now,
      },
      create: {
        userId: session.user.id,
        provider,
        model,
        date,
        hour,
        requestCount,
        inputTokens,
        outputTokens,
        reasoningTokens,
        totalTokens: inputTokens + outputTokens + reasoningTokens,
        totalCost: cost,
      },
    });

    // Update any applicable quota limits
    await db.userQuotaLimit.updateMany({
      where: {
        userId: session.user.id,
        isActive: true,
        OR: [
          { provider: null, model: null }, // General limits
          { provider, model: null },       // Provider limits
          { provider, model },             // Specific model limits
        ],
      },
      data: {
        usedRequests: {
          increment: requestCount,
        },
        usedTokens: {
          increment: inputTokens + outputTokens + reasoningTokens,
        },
        usedCost: {
          increment: cost,
        },
        updatedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      data: usageRecord,
    });
  } catch (error) {
    console.error('Usage recording error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}