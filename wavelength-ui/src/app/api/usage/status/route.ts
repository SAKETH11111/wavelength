import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/usage/status - Get real-time usage status for monitoring
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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get today's usage
    const todayUsage = await db.usageRecord.aggregate({
      where: {
        userId: session.user.id,
        date: { gte: today },
      },
      _sum: {
        requestCount: true,
        totalTokens: true,
        totalCost: true,
      },
    });

    // Get this month's usage
    const monthUsage = await db.usageRecord.aggregate({
      where: {
        userId: session.user.id,
        date: { gte: thisMonth },
      },
      _sum: {
        requestCount: true,
        totalTokens: true,
        totalCost: true,
      },
    });

    // Get active quotas
    const quotas = await db.userQuotaLimit.findMany({
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

    // Calculate quota status
    const quotaStatus = quotas.map(quota => {
      const requestPercent = quota.requestLimit 
        ? Math.min((quota.usedRequests / quota.requestLimit) * 100, 100)
        : 0;
      
      const tokenPercent = quota.tokenLimit 
        ? Math.min((quota.usedTokens / quota.tokenLimit) * 100, 100)
        : 0;
      
      const costPercent = quota.costLimit 
        ? Math.min((Number(quota.usedCost) / Number(quota.costLimit)) * 100, 100)
        : 0;

      const isNearLimit = Math.max(requestPercent, tokenPercent, costPercent) >= 80;
      const isOverLimit = Math.max(requestPercent, tokenPercent, costPercent) >= 100;

      return {
        ...quota,
        requestPercent,
        tokenPercent,
        costPercent,
        isNearLimit,
        isOverLimit,
        status: isOverLimit ? 'exceeded' : isNearLimit ? 'warning' : 'ok',
      };
    });

    // Overall status
    const hasWarnings = quotaStatus.some(q => q.status === 'warning');
    const hasExceeded = quotaStatus.some(q => q.status === 'exceeded');
    
    const overallStatus = hasExceeded ? 'critical' : hasWarnings ? 'warning' : 'healthy';

    return NextResponse.json({
      success: true,
      data: {
        userId: session.user.id,
        userTier: session.user.tier || 'free',
        timestamp: now.toISOString(),
        overallStatus,
        usage: {
          today: {
            requests: todayUsage._sum.requestCount || 0,
            tokens: todayUsage._sum.totalTokens || 0,
            cost: Number(todayUsage._sum.totalCost) || 0,
          },
          month: {
            requests: monthUsage._sum.requestCount || 0,
            tokens: monthUsage._sum.totalTokens || 0,
            cost: Number(monthUsage._sum.totalCost) || 0,
          },
        },
        quotas: quotaStatus,
        alerts: quotaStatus
          .filter(q => q.status !== 'ok')
          .map(q => ({
            type: q.status,
            message: `${q.type} quota ${q.status === 'exceeded' ? 'exceeded' : 'approaching limit'} for ${
              q.provider ? `${q.provider}${q.model ? `/${q.model}` : ''}` : 'general usage'
            }`,
            resetAt: q.resetAt,
          })),
      },
    });

  } catch (error) {
    console.error('Usage status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}