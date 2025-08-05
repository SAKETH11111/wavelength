import { NextRequest, NextResponse } from 'next/server';
import { taskManager, TaskStatus } from '@/lib/background-task-manager';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await taskManager.retrieveResponse(id);
    
    if (!task) {
      return NextResponse.json(
        { error: 'Response not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const startingAfter = searchParams.get('starting_after');
    const startIdx = startingAfter ? parseInt(startingAfter) + 1 : 0;

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Send historical events first
        for (let i = startIdx; i < task.stream_events.length; i++) {
          const event = task.stream_events[i];
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }

        // If task is still running, poll for new events
        if ([TaskStatus.QUEUED, TaskStatus.IN_PROGRESS].includes(task.status)) {
          let lastCount = task.stream_events.length;
          
          const pollInterval = setInterval(async () => {
            // Check if task is complete or has new events
            const currentTask = await taskManager.retrieveResponse(id);
            if (!currentTask) {
              clearInterval(pollInterval);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            
            // Send new events
            if (currentTask.stream_events.length > lastCount) {
              for (let i = lastCount; i < currentTask.stream_events.length; i++) {
                const event = currentTask.stream_events[i];
                const data = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
              lastCount = currentTask.stream_events.length;
            }
            
            // Stop polling if task is complete
            if (![TaskStatus.QUEUED, TaskStatus.IN_PROGRESS].includes(currentTask.status)) {
              clearInterval(pollInterval);
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          }, 100); // Poll every 100ms
          
          // Cleanup after 5 minutes to prevent memory leaks
          setTimeout(() => {
            clearInterval(pollInterval);
            if (!controller.desiredSize) return; // Already closed
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }, 300000);
        } else {
          // Task is already complete
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
      
      cancel() {
        // Cleanup if client disconnects
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Error streaming response:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}