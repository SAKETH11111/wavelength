import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/chats - Get all chats for the authenticated user
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

    const chats = await db.chat.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform database chats to match frontend format
    const formattedChats = chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      messages: chat.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        cost: msg.cost,
        duration: msg.duration,
        reasoning: msg.reasoning,
        model: msg.model,
        tokens: msg.inputTokens && msg.outputTokens ? {
          input: msg.inputTokens,
          reasoning: msg.reasoningTokens || 0,
          output: msg.outputTokens,
        } : undefined,
      })),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      totalCost: chat.totalCost,
      totalTokens: chat.totalTokens,
      status: chat.status,
      userId: chat.userId,
      anonymousId: chat.anonymousId,
      isAnonymous: chat.isAnonymous,
    }));

    return NextResponse.json({
      success: true,
      data: formattedChats,
    });

  } catch (error) {
    console.error('Failed to fetch chats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}