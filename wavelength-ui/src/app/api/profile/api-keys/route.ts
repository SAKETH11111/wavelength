import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiKeyEncryption, apiKeyUtils } from '@/lib/encryption';
import { z } from 'zod';

// Validation schemas
const createApiKeySchema = z.object({
  provider: z.enum(['openrouter', 'openai', 'anthropic', 'google', 'xai']),
  apiKey: z.string().min(8, 'API key must be at least 8 characters'),
  keyName: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  monthlyLimit: z.number().int().positive().optional(),
});

const updateApiKeySchema = z.object({
  keyName: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  monthlyLimit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/profile/api-keys - Get user's API keys
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

    const apiKeys = await db.userApiKey.findMany({
      where: { userId: session.user.id },
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
        // Never return the actual encrypted key
        encryptedKey: false,
        keyHash: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    console.error('API keys fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/api-keys - Create new API key
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
    const validatedData = createApiKeySchema.parse(body);

    // Validate API key format
    if (!apiKeyUtils.isValidApiKeyFormat(validatedData.apiKey)) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const { encryptedKey, keyHash } = ApiKeyEncryption.encrypt(
      validatedData.apiKey,
      session.user.id
    );

    // Check if this provider/keyName combination already exists
    const existingKey = await db.userApiKey.findUnique({
      where: {
        userId_provider_keyName: {
          userId: session.user.id,
          provider: validatedData.provider,
          keyName: validatedData.keyName || '',
        },
      },
    });

    if (existingKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: `API key for ${validatedData.provider}${validatedData.keyName ? ` (${validatedData.keyName})` : ''} already exists`,
        },
        { status: 409 }
      );
    }

    // Create the encrypted API key record
    const apiKey = await db.userApiKey.create({
      data: {
        userId: session.user.id,
        provider: validatedData.provider,
        keyName: validatedData.keyName,
        encryptedKey,
        keyHash,
        dailyLimit: validatedData.dailyLimit,
        monthlyLimit: validatedData.monthlyLimit,
        isActive: true,
        isValid: true, // Will be validated on first use
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
      message: `API key for ${validatedData.provider} added successfully`,
    });
  } catch (error) {
    console.error('API key creation error:', error);
    
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
 * PUT /api/profile/api-keys/[id] - Update API key
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

    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();

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
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();

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