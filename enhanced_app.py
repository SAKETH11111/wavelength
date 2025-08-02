from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Set
import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from background_task_manager import BackgroundTaskManager, TaskStatus
from providers import OpenRouterProvider
import logging

load_dotenv()

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

# Global task manager and WebSocket connections
task_manager: Optional[BackgroundTaskManager] = None
active_connections: Set[WebSocket] = set()

# Configuration
API_KEY = os.getenv("OPENROUTER_API_KEY", "")
CUSTOM_BASE_URL = os.getenv("CUSTOM_BASE_URL", "https://openrouter.ai/api/v1")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global task_manager
    if not API_KEY:
        logger.warning("No OPENROUTER_API_KEY found in environment. Some features may not work properly.")
        logger.info("To configure your API key, set the OPENROUTER_API_KEY environment variable or use the /config/update endpoint.")
    # Create OpenRouter provider
    provider = OpenRouterProvider(API_KEY, CUSTOM_BASE_URL)
    # Create task manager with provider
    task_manager = EnhancedTaskManager(provider, ws_manager)
    await task_manager.start()
    logger.info(f"Enhanced Maximum Reasoning Lab started with base URL: {CUSTOM_BASE_URL}")
    
    yield
    
    # Shutdown
    if task_manager:
        await task_manager.stop()

app = FastAPI(title="Maximum Reasoning Lab - Enhanced", lifespan=lifespan)
# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))
templates = Jinja2Templates(directory=os.path.join(script_dir, "templates"))

class CreateResponseRequest(BaseModel):
    model: str = "openai/o3-pro"
    input: List[Dict[str, Any]]
    background: bool = True
    stream: bool = False
    reasoning: Optional[Dict[str, Any]] = {"effort": "high", "summary": "auto"}

class ResponseStatus(BaseModel):
    id: str
    status: str
    model: str
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    output_text: Optional[str] = None
    output: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    reasoning_summary: Optional[str] = None

class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        
        message_str = json.dumps(message)
        disconnected = set()
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error sending WebSocket message: {e}")
                disconnected.add(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.active_connections.discard(connection)

# Initialize WebSocket manager
ws_manager = WebSocketManager()

class EnhancedTaskManager(BackgroundTaskManager):
    def __init__(self, provider, ws_manager: WebSocketManager):
        super().__init__(provider)
        self.ws_manager = ws_manager
        
    async def _execute_task(self, task):
        """Enhanced task execution with WebSocket streaming"""
        try:
            # Notify start
            await self.ws_manager.broadcast({
                "type": "reasoning_start",
                "task_id": task.id,
                "model": task.model
            })
            
            task.status = TaskStatus.IN_PROGRESS
            task.started_at = time.time()
            
            # Simulate reasoning stream for demonstration
            reasoning_steps = [
                "🧠 Analyzing problem complexity and scope...",
                "🔍 Breaking down into logical sub-components...",
                "💭 Considering multiple solution approaches...",
                "⚡ Evaluating trade-offs and constraints...",
                "🎯 Synthesizing optimal solution strategy...",
                "📊 Calculating resource requirements...",
                "🔬 Validating approach against best practices...",
                "✨ Refining and optimizing final solution..."
            ]
            
            # Stream reasoning steps
            for i, step in enumerate(reasoning_steps):
                if task.status == TaskStatus.CANCELLED:
                    break
                    
                await self.ws_manager.broadcast({
                    "type": "reasoning_stream",
                    "task_id": task.id,
                    "content": step,
                    "step": i + 1,
                    "total_steps": len(reasoning_steps)
                })
                
                # Simulate reasoning tokens accumulating
                tokens = (i + 1) * 1000 + int(time.time() * 100) % 500
                await self.ws_manager.broadcast({
                    "type": "reasoning_tokens",
                    "task_id": task.id,
                    "tokens": tokens
                })
                
                await asyncio.sleep(2)  # Simulate thinking time
            
            # Execute the actual API call
            await super()._execute_task(task)
            
            # Notify completion
            await self.ws_manager.broadcast({
                "type": "reasoning_complete",
                "task_id": task.id,
                "response": task.output_text,
                "usage": task.usage
            })
            
        except Exception as e:
            logger.error(f"Enhanced task execution failed: {e}")
            await self.ws_manager.broadcast({
                "type": "error",
                "task_id": task.id,
                "message": str(e)
            })
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = time.time()

@app.get("/", response_class=HTMLResponse)
async def enhanced_home(request: Request):
    """Serve the enhanced UI"""
    return templates.TemplateResponse("enhanced_ui.html", {
        "request": request,
        "api_key_configured": bool(API_KEY),
        "base_url": CUSTOM_BASE_URL
    })

# Classic UI route removed - using enhanced UI only

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle any client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "cancel_task":
                task_id = message.get("task_id")
                if task_id and task_manager:
                    await task_manager.cancel_response(task_id)
                    
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

def get_maximum_reasoning_prompt(model: str) -> str:
    """Generate optimal system prompts for maximum reasoning based on research findings"""
    
    # Base time-encouragement prompt (works best for reasoning models)
    base_prompt = """Take your time and think as carefully and methodically about the problem as you need to. There's no rush - spend as much time as necessary to thoroughly analyze every aspect, consider all possible approaches, and reason through the implications step by step.

Please think deeply about:
- All possible interpretations and edge cases
- Multiple solution strategies and their trade-offs
- Potential risks, limitations, and assumptions
- How different components interact and influence each other
- Alternative perspectives and counterarguments
- Long-term implications and consequences

Feel free to explore tangential but relevant considerations that might impact the solution. The goal is comprehensive understanding and the most thoughtful, well-reasoned response possible."""
    
    # Model-specific optimizations
    if "o3" in model.lower():
        # o3/o3-pro models - emphasize systematic analysis
        return f"""{base_prompt}

For this o3 model, please engage your full reasoning capabilities. Break down complex problems into logical components, systematically evaluate each part, and synthesize insights across different levels of abstraction. Take time to validate your reasoning at each step."""
        
    elif "grok" in model.lower():
        # Grok models - emphasize creative and thorough exploration
        return f"""{base_prompt}

For this Grok model, please leverage your reasoning capabilities to explore the problem from multiple creative angles. Consider unconventional approaches while maintaining rigorous logical analysis. Take time to examine the problem space comprehensively."""
        
    elif "o1" in model.lower():
        # o1 models - emphasize methodical reasoning
        return f"""{base_prompt}

For this o1 model, please engage in deliberate, methodical reasoning. Work through the problem systematically, considering all relevant factors and their interactions. Take whatever time is needed for thorough analysis."""
        
    else:
        # Default for other reasoning models
        return base_prompt

@app.post("/responses", response_model=ResponseStatus)
async def create_response(request: CreateResponseRequest):
    """Create a new background response with enhanced features"""
    if not API_KEY:
        raise HTTPException(status_code=500, detail="API key not configured")
        
    try:
        # Inject maximum reasoning system prompt
        enhanced_input = request.input.copy()
        reasoning_prompt = get_maximum_reasoning_prompt(request.model)
        
        # Add system prompt if not already present
        has_system_message = any(msg.get("role") == "system" for msg in enhanced_input)
        
        if not has_system_message:
            # Insert system message at the beginning
            enhanced_input.insert(0, {
                "role": "system", 
                "content": reasoning_prompt
            })
        else:
            # Enhance existing system message
            for msg in enhanced_input:
                if msg.get("role") == "system":
                    existing_content = msg.get("content", "")
                    msg["content"] = f"{reasoning_prompt}\n\n{existing_content}"
                    break
        
        # Ensure maximum reasoning settings
        enhanced_reasoning = {
            "effort": "high",
            "summary": "auto"
        }
        if request.reasoning:
            enhanced_reasoning.update(request.reasoning)
            
        task = await task_manager.create_response(
            model=request.model,
            input=enhanced_input,
            background=request.background,
            stream=request.stream,
            reasoning=enhanced_reasoning
        )
        
        return ResponseStatus(
            id=task.id,
            status=task.status.value,
            model=task.model,
            created_at=task.created_at,
            started_at=task.started_at,
            completed_at=task.completed_at,
            output_text=task.output_text,
            output=task.output,
            error=task.error,
            usage=task.usage,
            reasoning_summary=task.reasoning_summary
        )
        
    except Exception as e:
        logger.error(f"Error creating response: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/responses/{response_id}", response_model=ResponseStatus)
async def retrieve_response(response_id: str):
    """Retrieve a response by ID"""
    task = await task_manager.retrieve_response(response_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Response not found")
        
    return ResponseStatus(
        id=task.id,
        status=task.status.value,
        model=task.model,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        output_text=task.output_text,
        output=task.output,
        error=task.error,
        usage=task.usage,
        reasoning_summary=task.reasoning_summary
    )

@app.post("/responses/{response_id}/cancel", response_model=ResponseStatus)
async def cancel_response(response_id: str):
    """Cancel a background response"""
    task = await task_manager.cancel_response(response_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Response not found")
    
    # Notify via WebSocket
    await ws_manager.broadcast({
        "type": "task_cancelled",
        "task_id": response_id
    })
        
    return ResponseStatus(
        id=task.id,
        status=task.status.value,
        model=task.model,
        created_at=task.created_at,
        started_at=task.started_at,
        completed_at=task.completed_at,
        output_text=task.output_text,
        output=task.output,
        error=task.error,
        usage=task.usage,
        reasoning_summary=task.reasoning_summary
    )

@app.get("/responses/{response_id}/stream")
async def stream_response(response_id: str, starting_after: Optional[int] = None):
    """Stream events from a background response"""
    task = await task_manager.retrieve_response(response_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Response not found")
        
    async def event_generator():
        async for event in task_manager.stream_response(response_id, starting_after):
            yield f"data: {json.dumps(event)}\n\n"
            
        yield "data: [DONE]\n\n"
        
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@app.get("/tasks")
async def list_tasks():
    """List all tasks with enhanced metadata"""
    tasks = []
    for task_id, task in task_manager.tasks.items():
        task_data = {
            "id": task.id,
            "status": task.status.value,
            "model": task.model,
            "created_at": task.created_at,
            "completed_at": task.completed_at,
            "has_output": task.output_text is not None,
            "has_error": task.error is not None,
            "reasoning_tokens": task.usage.get("reasoning_tokens", 0) if task.usage else 0,
            "total_tokens": task.usage.get("total_tokens", 0) if task.usage else 0,
            "estimated_cost": calculate_cost(task.usage) if task.usage else 0
        }
        tasks.append(task_data)
    return {"tasks": tasks}

def calculate_cost(usage: Dict[str, Any]) -> float:
    """Calculate estimated cost based on token usage"""
    if not usage:
        return 0.0
    
    # Rough cost estimates (adjust based on actual pricing)
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)
    reasoning_tokens = usage.get("reasoning_tokens", 0)
    
    # Example pricing (per 1K tokens)
    input_cost_per_1k = 0.015
    output_cost_per_1k = 0.060
    reasoning_cost_per_1k = 0.060  # Same as output for reasoning models
    
    total_cost = (
        (input_tokens / 1000) * input_cost_per_1k +
        (output_tokens / 1000) * output_cost_per_1k +
        (reasoning_tokens / 1000) * reasoning_cost_per_1k
    )
    
    return round(total_cost, 4)

@app.post("/config/update")
async def update_config(api_key: str = None, base_url: str = None):
    """Update configuration"""
    global task_manager, API_KEY, CUSTOM_BASE_URL
    
    if api_key:
        API_KEY = api_key
        
    if base_url:
        CUSTOM_BASE_URL = base_url
        
    # Restart task manager with new config
    if task_manager:
        await task_manager.stop()
    
    # Create new provider with updated config
    provider = OpenRouterProvider(API_KEY, CUSTOM_BASE_URL)
    task_manager = EnhancedTaskManager(provider, ws_manager)
    await task_manager.start()
    
    return {
        "status": "Configuration updated",
        "api_key_configured": bool(API_KEY),
        "base_url": CUSTOM_BASE_URL
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "api_configured": bool(API_KEY),
        "active_connections": len(ws_manager.active_connections),
        "active_tasks": len(task_manager.tasks) if task_manager else 0
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)