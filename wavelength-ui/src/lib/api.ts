import { useStore } from './store';
import { backendClient } from './backend-client';

export interface CreateResponseRequest {
  model: string;
  input: Array<{ role: string; content: string }>;
  background?: boolean;
  stream?: boolean;
  reasoning?: { effort: string; summary: string };
  apiKey?: string;
  baseUrl?: string;
}

export interface ResponseStatus {
  id: string;
  status: string;
  model: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  output_text?: string;
  output?: Array<{ id: string; type: string; status: string; content: Array<{ type: string; text: string }> | string; role?: string }>;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    reasoning_tokens: number;
    cost?: number; // Native cost from provider (e.g., OpenRouter)
  };
  reasoning_summary?: string;
}


/**
 * Send a message using the background task system with automatic backend detection
 */
export async function sendMessageToServer(
  message: string,
  chatId: string,
  model: string = 'openai/o3',
  setChatStatus: (chatId: string, status: 'idle' | 'processing' | 'error') => void
): Promise<void> {
  const { addMessage, config } = useStore.getState();
  const activeChat = useStore.getState().chats.find(chat => chat.id === chatId);
  
  // Client-side validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  if (!chatId || typeof chatId !== 'string') {
    throw new Error('Chat ID is required');
  }
  
  if (!model || typeof model !== 'string') {
    throw new Error('Model is required');
  }
  
  try {
    console.log('=== sendMessageToServer - Starting ===', {
      messageLength: message.length,
      chatId,
      model,
      timestamp: new Date().toISOString()
    });
    
    // Set chat status to processing
    setChatStatus(chatId, 'processing');
    
    // Add user message to the chat
    addMessage(chatId, {
      role: 'user',
      content: message,
    });

    // Build conversation history properly (fixing the ID issue)
    const conversationHistory = [...(activeChat?.messages || [])];
    conversationHistory.push({ 
      id: `temp-${Date.now()}`, 
      role: 'user', 
      content: message,
      timestamp: new Date()
    });
    
    // Convert to API format (without IDs to avoid the OpenAI error)
    const apiInput = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const payload: CreateResponseRequest = {
      model: activeChat?.model || model,
      input: apiInput,
      background: true, // Use background processing like Python version
      reasoning: { effort: 'high', summary: 'auto' },
      apiKey: config.apiKey || undefined,
      baseUrl: config.baseUrl || undefined
    };
    
    console.log('--> Creating background task with payload:', payload);
    
    // Step 1: Create background task (try backend first, fallback to frontend)
    let taskStatus: ResponseStatus;
    let useBackend = false;
    
    try {
      // Try backend first
      const backendAvailable = await backendClient.isBackendAvailable();
      if (backendAvailable) {
        console.log('Using backend for task creation');
        taskStatus = await backendClient.createResponse(payload);
        useBackend = true;
      } else {
        throw new Error('Backend not available, using frontend');
      }
    } catch (backendError) {
      console.log('Backend failed, falling back to frontend:', backendError);
      // Fallback to frontend API
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        let errorText = '';
        let errorData: { error?: string } | null = null;
        
        try {
          errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          // If we can't parse the error response, use the raw text
          console.warn('Could not parse error response as JSON:', parseError);
        }
        
        console.error(`Server responded with status ${response.status}:`, {
          status: response.status,
          statusText: response.statusText,
          errorText,
          errorData,
          url: response.url
        });
        
        // Extract error message from parsed JSON or use raw text
        const errorMessage = errorData?.error || errorText || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Server responded with status ${response.status}: ${errorMessage}`);
      }
      
      taskStatus = await response.json();
      useBackend = false;
    }

    console.log('<-- Background task created:', taskStatus, useBackend ? '(backend)' : '(frontend)');

    // Step 2: Set up streaming from the background task
    await streamBackgroundTask(taskStatus.id, chatId, model, setChatStatus, useBackend);

  } catch (error) {
    console.error('=== sendMessageToServer - ERROR ===');
    console.error('Failed to send message to server:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
    }
    
    let errorMessage = 'Failed to connect to server';
    let userFriendlyMessage = 'Something went wrong. Please try again.';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide user-friendly error messages based on the error type
      if (error.message.includes('API key')) {
        userFriendlyMessage = 'API key not configured. Please check your settings.';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        userFriendlyMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('timeout')) {
        userFriendlyMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userFriendlyMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('500')) {
        userFriendlyMessage = 'Server error. Please try again in a few moments.';
      }
    }
    
    // Add error message to chat
    addMessage(chatId, {
      role: 'assistant',
      content: `Error: ${userFriendlyMessage}`,
    });

    // Set chat status to error
    setChatStatus(chatId, 'error');
    
    // Re-throw the error for any upstream error handling
    throw error;
  }
}

/**
 * Stream updates from a background task (like your Python streaming endpoint)
 */
async function streamBackgroundTask(
  taskId: string,
  chatId: string,
  model: string,
  setChatStatus: (chatId: string, status: 'idle' | 'processing' | 'error') => void,
  useBackend: boolean = false
): Promise<void> {
  const { addMessage, updateMessage } = useStore.getState();
  let assistantMessage = '';
  let assistantMessageId: string | undefined = undefined;
  let reasoningContent = '';

  try {
    console.log(`--> Starting stream for background task: ${taskId} (${useBackend ? 'backend' : 'frontend'})`);
    
    // Stream from the background task
    let streamBody: ReadableStream<Uint8Array> | null;
    
    if (useBackend) {
      try {
        streamBody = await backendClient.streamResponse(taskId);
        if (!streamBody) {
          throw new Error('No stream body available from backend');
        }
      } catch (backendError) {
        console.log('Backend streaming failed, falling back to frontend:', backendError);
        const streamResponse = await fetch(`/api/responses/${taskId}/stream`);
        if (!streamResponse.ok) {
          throw new Error(`Frontend stream error: ${streamResponse.status}`);
        }
        streamBody = streamResponse.body;
      }
    } else {
      const streamResponse = await fetch(`/api/responses/${taskId}/stream`);
      if (!streamResponse.ok) {
        throw new Error(`Stream error: ${streamResponse.status}`);
      }
      streamBody = streamResponse.body;
    }
    
    if (!streamBody) {
      throw new Error('No stream body available');
    }

    const reader = streamBody.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const dataStr = line.substring(6);
        if (dataStr === '[DONE]') {
          setChatStatus(chatId, 'idle');
          continue;
        }

        try {
          const event = JSON.parse(dataStr);
          console.log('Stream event:', event);
          console.log('Stream event data:', event.data);

          // Handle different types of streaming events
          let content = '';
          
          // Check for direct OpenRouter/OpenAI format first
          if (event.data?.choices?.[0]?.delta?.content) {
            content = event.data.choices[0].delta.content;
            console.log('Extracted content:', content);
          }
          // Check for nested format from our broadcast system
          else if (event.data?.data?.choices?.[0]?.delta?.content) {
            content = event.data.data.choices[0].delta.content;
            console.log('Extracted nested content:', content);
          }

          if (content) {
            assistantMessage += content;

            if (!assistantMessageId) {
              // Create new assistant message
              const newMessage = addMessage(chatId, {
                role: 'assistant',
                content: assistantMessage,
                model: model,
              });
              assistantMessageId = newMessage.id;
            } else {
              // Update existing message
              updateMessage(chatId, assistantMessageId, {
                content: assistantMessage
              });
            }
          }

          // Handle our custom broadcast events for progress indication only (not content)
          if (event.data?.type === 'reasoning_start') {
            if (!assistantMessageId) {
              // Create new assistant message with placeholder
              const newMessage = addMessage(chatId, {
                role: 'assistant',
                content: 'Thinking...',
                model: model,
              });
              assistantMessageId = newMessage.id;
            }
          }

          // Handle reasoning content (check direct format first)
          if (event.data?.choices?.[0]?.delta?.reasoning) {
            reasoningContent += event.data.choices[0].delta.reasoning;
            console.log('Extracted reasoning:', event.data.choices[0].delta.reasoning);
            if (assistantMessageId) {
              updateMessage(chatId, assistantMessageId, {
                reasoning: reasoningContent
              });
            }
          } else if (event.data?.data?.choices?.[0]?.delta?.reasoning) {
            reasoningContent += event.data.data.choices[0].delta.reasoning;
            console.log('Extracted nested reasoning:', event.data.data.choices[0].delta.reasoning);
            if (assistantMessageId) {
              updateMessage(chatId, assistantMessageId, {
                reasoning: reasoningContent
              });
            }
          }

          // Handle task completion
          if (event.data?.type === 'reasoning_complete' || event.type === 'reasoning_complete') {
            setChatStatus(chatId, 'idle');
            const response = event.data?.response || event.response;
            if (response && assistantMessageId) {
              // Only set the final response if we haven't built it from streaming chunks
              if (assistantMessage.trim() === '' || assistantMessage === 'Thinking...') {
                updateMessage(chatId, assistantMessageId, {
                  content: response
                });
              }
            }
          }

        } catch (e) {
          console.error('Error parsing stream event:', e);
        }
      }
    }

    // Step 3: Poll for final task status (with improved error handling)
    if (assistantMessageId && assistantMessage.trim() && assistantMessage !== 'Thinking...') {
      console.log('🙅 Skipping polling - already have complete message:', {
        assistantMessageId,
        messageLength: assistantMessage.length,
        assistantMessage: assistantMessage.substring(0, 50) + '...'
      });
      setChatStatus(chatId, 'idle');
      
      // IMPORTANT: Still need to poll for usage data even if we have the message content!
      console.log('🔄 But still polling for usage data...');
      setTimeout(() => {
        pollTaskCompletion(taskId, chatId, assistantMessageId, setChatStatus, useBackend);
      }, 1000); // Shorter delay since we just need usage data
    } else {
      console.log('🔄 Starting polling for task completion (no complete message yet)');
      setTimeout(() => {
        pollTaskCompletion(taskId, chatId, assistantMessageId, setChatStatus, useBackend);
      }, 3000); // Wait 3 seconds before starting to poll
    }

  } catch (error) {
    console.error('Error streaming background task:', error);
    setChatStatus(chatId, 'error');
    
    if (!assistantMessageId) {
      addMessage(chatId, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown streaming error'}`,
      });
    }
  }
}

/**
 * Poll for task completion to get final usage statistics
 */
async function pollTaskCompletion(
  taskId: string,
  chatId: string,
  assistantMessageId: string | undefined,
  setChatStatus: (chatId: string, status: 'idle' | 'processing' | 'error') => void,
  useBackend: boolean = false
): Promise<void> {
  console.log('🔄 pollTaskCompletion started:', {
    taskId,
    chatId,
    assistantMessageId,
    useBackend
  });
  
  const { updateMessage } = useStore.getState();
  
  try {
    // Poll the task status endpoint for final results
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 60 seconds for o3-pro
    
    while (attempts < maxAttempts) {
      try {
        console.log(`Polling attempt ${attempts + 1}: fetching task status (${useBackend ? 'backend' : 'frontend'})`);
        
        let taskStatus: ResponseStatus;
        
        if (useBackend) {
          try {
            taskStatus = await backendClient.getResponseStatus(taskId);
          } catch (backendError) {
            console.log('Backend polling failed, falling back to frontend:', backendError);
            const statusResponse = await fetch(`/api/responses/${taskId}`);
            if (!statusResponse.ok) {
              throw new Error(`Frontend status error: ${statusResponse.status}`);
            }
            taskStatus = await statusResponse.json();
          }
        } else {
          const statusResponse = await fetch(`/api/responses/${taskId}`);
          if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
              console.log(`Task ${taskId} not found yet, attempt ${attempts + 1}/${maxAttempts}`);
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            console.warn(`Status check failed with status ${statusResponse.status}, attempt ${attempts + 1}/${maxAttempts}`);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          taskStatus = await statusResponse.json();
        }
          
        if (taskStatus.status === 'completed') {
          console.log('🎉 Task completed with final status:', taskStatus);
          console.log('📊 Usage data:', taskStatus.usage);
          console.log('💬 Assistant message ID:', assistantMessageId);
          
          // Update message with final statistics
          if (assistantMessageId && taskStatus.usage) {
            const finalCost = taskStatus.usage.cost !== undefined 
              ? taskStatus.usage.cost // Use native cost from provider (e.g., OpenRouter)
              : calculateCost(taskStatus.usage); // Fallback to calculated cost
              
            const finalTokens = {
              input: taskStatus.usage.prompt_tokens,
              reasoning: taskStatus.usage.reasoning_tokens,
              output: taskStatus.usage.completion_tokens
            };
            
            console.log('💰 Final cost:', finalCost);
            console.log('🔢 Final tokens:', finalTokens);
            
            updateMessage(chatId, assistantMessageId, {
              cost: finalCost,
              tokens: finalTokens,
              reasoning: taskStatus.reasoning_summary,
            });
            
            console.log('✅ Message updated with usage data');
          } else {
            console.log('⚠️ Cannot update message with usage data:', {
              hasAssistantMessageId: !!assistantMessageId,
              hasUsageData: !!taskStatus.usage,
              assistantMessageId,
              usage: taskStatus.usage
            });
          }
          
          setChatStatus(chatId, 'idle');
          return;
        } else if (taskStatus.status === 'failed') {
          console.error('Task failed:', taskStatus.error);
          setChatStatus(chatId, 'error');
          return;
        }
      } catch (fetchError) {
        console.error(`=== POLLING FETCH ERROR ===`);
        console.error(`Attempt ${attempts + 1}/${maxAttempts} failed:`, fetchError);
        console.error('Error details:', {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          cause: fetchError instanceof Error ? fetchError.cause : undefined,
          stack: fetchError instanceof Error ? fetchError.stack : undefined
        });
        // If we get a persistent fetch error, the task might have failed
        if (attempts > 5) {
          throw new Error(`Task failed: ${fetchError instanceof Error ? fetchError.message : 'fetch failed'}`);
        }
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
    
    setChatStatus(chatId, 'idle');
    
  } catch (error) {
    console.error('❌ Error polling task completion:', error);
    console.error('Context:', { taskId, chatId, assistantMessageId, useBackend });
    setChatStatus(chatId, 'idle');
  }
}

/**
 * Calculate cost from usage statistics (matching your Python calculation)
 */
function calculateCost(usage: ResponseStatus['usage']): number {
  if (!usage) return 0.0;
  
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const reasoningTokens = usage.reasoning_tokens || 0;
  
  // Example pricing (per 1K tokens) - matching your Python version
  const inputCostPer1k = 0.015;
  const outputCostPer1k = 0.060;
  const reasoningCostPer1k = 0.060;
  
  const totalCost = (
    (inputTokens / 1000) * inputCostPer1k +
    (outputTokens / 1000) * outputCostPer1k +
    (reasoningTokens / 1000) * reasoningCostPer1k
  );
  
  return Math.round(totalCost * 10000) / 10000; // Round to 4 decimal places
}
