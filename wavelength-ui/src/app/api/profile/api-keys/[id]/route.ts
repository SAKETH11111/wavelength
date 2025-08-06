import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const updateApiKeySchema = z.object({
  keyName: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  monthlyLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/profile/api-keys/[id] - Update API key
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: keyId } = await context.params;

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateApiKeySchema.parse(body);

    // Update the API key
    const apiKey = await db.userApiKey.update({
      where: {
        id: keyId,
        userId: session.user.id, // Ensure user owns this key
      },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        provider: true,
        keyName: true,
        isActive: true,
        dailyLimit: true,
        monthlyLimit: true,
        usedToday: true,
        usedThisMonth: true,
        lastUsed: true,
        lastValidated: true,
        isValid: true,
        validationError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: apiKey,
      message: 'API key updated successfully',
    });
  } catch (error) {
    console.error('API key update error:', error);
    
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
 * DELETE /api/profile/api-keys/[id] - Delete API key
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: keyId } = await context.params;

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'API key ID is required' },
        { status: 400 }
      );
    }

    // Delete the API key
    await db.userApiKey.delete({
      where: {
        id: keyId,
        userId: session.user.id, // Ensure user owns this key
      },
    });

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('API key deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}