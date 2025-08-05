# Wavelength Backend

FastAPI backend server for the Wavelength AI chat interface.

## Structure

```
backend/
├── main.py              # FastAPI application entry point
├── task_manager.py      # Background task processing system
├── providers/           # AI provider implementations
│   ├── __init__.py
│   ├── base.py         # Base provider interface
│   └── openrouter.py   # OpenRouter API integration
└── requirements.txt     # Python dependencies
```

## Running the Backend

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Set environment variables:
   ```bash
   export OPENROUTER_API_KEY="your-api-key"
   export CUSTOM_BASE_URL="https://kilocode.ai/api/openrouter"  # Optional
   ```

3. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

## Architecture Notes

This backend is optional. The Wavelength UI can run standalone using Next.js API routes, or it can connect to this FastAPI backend for more advanced features like:

- Background task processing
- WebSocket support for real-time updates
- Direct integration with multiple AI providers
- Advanced streaming capabilities

## API Endpoints

- `POST /api/responses` - Create AI response
- `GET /api/responses/{id}` - Get response status
- `GET /api/responses/{id}/stream` - Stream response updates
- `WS /ws` - WebSocket for real-time updates