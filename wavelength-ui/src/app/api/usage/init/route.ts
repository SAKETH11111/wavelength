import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UsageTracker } from '@/lib/usage-tracker';

/**
 * POST /api/usage/init - Initialize usage quotas for a new user
 * This is called when a user first signs in to set up their default quotas
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
    const { tier = 'free', force = false } = body;

    // Check if user already has quotas initialized (unless force = true)
    if (!force) {
      const currentUsage = await UsageTracker.getCurrentUsage(session);
      if (currentUsage.quotaLimits.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'User quotas already initialized',
          data: {
            quotaLimits: currentUsage.quotaLimits,
          },
        });
      }
    }

    // Initialize default quotas
    await UsageTracker.initializeUserQuotas(session.user.id, tier as 'free' | 'pro');

    // Get the newly created quotas
    const updatedUsage = await UsageTracker.getCurrentUsage(session);

    return NextResponse.json({
      success: true,
      message: 'User quotas initialized successfully',
      data: {
        quotaLimits: updatedUsage.quotaLimits,
        tier,
      },
    });

  } catch (error) {
    console.error('Usage initialization error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/usage/init - Check if user needs quota initialization
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

    const currentUsage = await UsageTracker.getCurrentUsage(session);
    const needsInitialization = currentUsage.quotaLimits.length === 0;

    return NextResponse.json({
      success: true,
      data: {
        needsInitialization,
        currentQuotaCount: currentUsage.quotaLimits.length,
        userTier: session.user.tier || 'free',
        userId: session.user.id,
      },
    });

  } catch (error) {
    console.error('Usage initialization check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}