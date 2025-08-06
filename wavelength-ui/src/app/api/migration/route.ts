import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { DataMigration, type MigrationData } from '@/lib/migration';
import { z } from 'zod';

// Validation schema for migration data
const migrationDataSchema = z.object({
  chats: z.array(z.object({
    id: z.string(),
    title: z.string(),
    model: z.string(),
    messages: z.array(z.object({
      id: z.string(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      timestamp: z.coerce.date(),
      cost: z.number().optional(),
      duration: z.number().optional(),
      reasoning: z.string().optional(),
      model: z.string().optional(),
      tokens: z.object({
        input: z.number(),
        reasoning: z.number(),
        output: z.number(),
      }).optional(),
    })),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    totalCost: z.number(),
    totalTokens: z.number(),
    status: z.enum(['idle', 'processing', 'error']),
    userId: z.string().optional(),
    anonymousId: z.string().optional(),
    isAnonymous: z.boolean(),
  })),
  config: z.object({
    providers: z.object({
      openrouter: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
        priority: z.number(),
      }),
      openai: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
        priority: z.number(),
      }),
      anthropic: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
        priority: z.number(),
      }),
      google: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
        priority: z.number(),
      }),
      xai: z.object({
        apiKey: z.string(),
        enabled: z.boolean(),
        priority: z.number(),
      }),
    }),
    defaultModel: z.string(),
    defaultProvider: z.string(),
    showReasoning: z.boolean(),
    showTokens: z.boolean(),
    showCosts: z.boolean(),
    autoScroll: z.boolean(),
    reasoningEffort: z.enum(['low', 'medium', 'high']),
    // Allow additional config properties
  }).passthrough(),
  anonymousId: z.string(),
});

/**
 * POST /api/migration - Migrate anonymous user data to authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - user must be authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const migrationData = migrationDataSchema.parse(body);

    // Perform the migration
    const result = await DataMigration.migrateAnonymousUserData(
      session.user.id,
      migrationData as MigrationData
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result,
        message: `Migration completed successfully: ${result.migratedChats} chats, ${result.migratedMessages} messages, ${result.migratedApiKeys} API keys`,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Migration completed with errors',
        data: result,
      }, { status: 206 }); // Partial content
    }
  } catch (error) {
    console.error('Migration error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid migration data format',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Migration failed due to server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migration/status - Check migration status for current user
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

    const status = await DataMigration.checkMigrationStatus(session.user.id);
    const migratedData = await DataMigration.getMigratedData(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        stats: migratedData ? {
          totalChats: migratedData.chats.length,
          totalMessages: migratedData.chats.reduce((sum, chat) => sum + chat.messages.length, 0),
          totalApiKeys: migratedData.apiKeys.length,
        } : null,
      },
    });
  } catch (error) {
    console.error('Migration status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/migration/sync - Sync localStorage data with database for authenticated users
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
    const { chats, config } = migrationDataSchema.pick({ chats: true, config: true }).parse(body);

    // Ensure config has required fields for backward compatibility
    const fullConfig = {
      apiKey: (config as any).apiKey || '',
      baseUrl: (config as any).baseUrl || '',
      ...config,
    };
    
    // Perform the sync
    const result = await DataMigration.syncUserData(
      session.user.id,
      { chats, config: fullConfig as any }
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result,
        message: `Sync completed successfully: ${result.migratedChats} new chats, ${result.migratedMessages} new messages`,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Sync completed with errors',
        data: result,
      }, { status: 206 }); // Partial content
    }
  } catch (error) {
    console.error('Data sync error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid sync data format',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Data sync failed due to server error' },
      { status: 500 }
    );
  }
}