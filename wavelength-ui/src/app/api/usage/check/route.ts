import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UsageTracker } from '@/lib/usage-tracker';
import { AnonymousSessionManager } from '@/lib/auth/anonymous-session';
import { z } from 'zod';

// Request validation
const checkQuotaSchema = z.object({
  provider: z.string(),
  model: z.string(),
  estimatedTokens: z.number().optional(),
  estimatedCost: z.number().optional(),
});

/**
 * POST /api/usage/check - Check if user can proceed with a request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    
    const { provider, model, estimatedTokens, estimatedCost } = checkQuotaSchema.parse(body);

    // Get anonymous ID from headers or generate one
    const anonymousId = session?.user?.id 
      ? null 
      : request.headers.get('x-anonymous-id') || AnonymousSessionManager.getAnonymousId();

    // Check quota limits
    const quotaCheck = await UsageTracker.checkQuota(
      session,
      anonymousId,
      {
        provider,
        model,
        requestCount: 1,
        totalTokens: estimatedTokens,
        cost: estimatedCost,
      }
    );

    // Get current usage stats
    const currentUsage = await UsageTracker.getCurrentUsage(session, anonymousId);

    return NextResponse.json({
      success: true,
      data: {
        canProceed: quotaCheck.canProceed,
        reasons: quotaCheck.reasons,
        quotaStatus: {
          remainingRequests: quotaCheck.remainingRequests,
          remainingTokens: quotaCheck.remainingTokens,
          remainingCost: quotaCheck.remainingCost,
          resetTime: quotaCheck.resetTime,
        },
        currentUsage: {
          dailyRequests: currentUsage.dailyRequests,
          monthlyRequests: currentUsage.monthlyRequests,
          dailyCost: currentUsage.dailyCost,
          monthlyCost: currentUsage.monthlyCost,
        },
        quotaLimits: currentUsage.quotaLimits,
        userType: session?.user?.id ? 'authenticated' : 'anonymous',
        userTier: session?.user?.tier || 'anonymous',
        anonymousId: !session?.user?.id ? anonymousId : undefined,
      },
    });

  } catch (error) {
    console.error('Quota check error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
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
 * GET /api/usage/check - Get current usage status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    const anonymousId = session?.user?.id 
      ? null 
      : searchParams.get('anonymousId') || AnonymousSessionManager.getAnonymousId();

    // Get current usage stats
    const currentUsage = await UsageTracker.getCurrentUsage(session, anonymousId);

    // For anonymous users, also include remaining messages info
    let anonymousLimits = null;
    if (!session?.user?.id) {
      const limits = AnonymousSessionManager.getAnonymousLimits();
      anonymousLimits = {
        dailyLimit: 50,
        usedMessages: limits.usedMessages,
        remainingMessages: AnonymousSessionManager.getRemainingMessages(),
        resetTime: limits.resetTime,
        timeUntilReset: AnonymousSessionManager.getTimeUntilReset(),
        shouldShowUpgradePrompt: AnonymousSessionManager.shouldShowUpgradePrompt(),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        userType: session?.user?.id ? 'authenticated' : 'anonymous',
        userTier: session?.user?.tier || 'anonymous',
        currentUsage: {
          dailyRequests: currentUsage.dailyRequests,
          monthlyRequests: currentUsage.monthlyRequests,
          dailyCost: currentUsage.dailyCost,
          monthlyCost: currentUsage.monthlyCost,
        },
        quotaLimits: currentUsage.quotaLimits,
        anonymousLimits,
        anonymousId: !session?.user?.id ? anonymousId : undefined,
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