import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

// Validation schema for profile updates
const updateProfileSchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  preferences: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/profile - Get user profile
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user with profile
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      include: {
        profile: true,
        apiKeys: {
          select: {
            id: true,
            provider: true,
            keyName: true,
            isActive: true,
            lastUsed: true,
            isValid: true,
            validationError: true,
          },
        },
        _count: {
          select: {
            chats: true,
            messages: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          tier: user.tier,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        },
        profile: user.profile,
        apiKeys: user.apiKeys,
        stats: {
          totalChats: user._count.chats,
          totalMessages: user._count.messages,
        },
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile - Update user profile
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

    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Update user profile (create if doesn't exist)
    const profile = await db.userProfile.upsert({
      where: { userId: session.user.id },
      update: validatedData,
      create: {
        userId: session.user.id,
        ...validatedData,
      },
    });

    // Update user last activity
    await db.user.update({
      where: { id: session.user.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation error',
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
 * DELETE /api/profile - Delete user account
 */
export async function DELETE() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Soft delete - mark user as inactive
    await db.user.update({
      where: { id: session.user.id },
      data: { 
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}