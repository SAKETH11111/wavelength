# Wavelength - Universal AI Chat Interface

A modern, modular AI chat interface built with Next.js and optional Python backend support.

## Project Structure

```
o3-pro/
├── wavelength-ui/       # Next.js frontend application
│   ├── src/
│   │   ├── app/        # Next.js app router & API routes
│   │   ├── components/ # React components
│   │   └── lib/        # Utilities, store, API clients
│   └── package.json
│
├── backend/            # Optional Python FastAPI backend
│   ├── main.py        # FastAPI server
│   ├── task_manager.py # Background task processing
│   └── providers/     # AI provider integrations
│
└── docs/              # Project documentation
```

## Architecture Options

### Option 1: Next.js Standalone (Recommended)
The `wavelength-ui` directory contains a complete Next.js application with:
- Built-in API routes for AI interactions
- TypeScript-based task management
- Zustand state management
- Real-time streaming support

```bash
cd wavelength-ui
npm install
npm run dev
```

### Option 2: Next.js + Python Backend
For advanced features, you can run the Python FastAPI backend alongside Next.js:
- Enhanced background task processing
- WebSocket support
- Direct provider integrations

```bash
# Terminal 1: Frontend
cd wavelength-ui
npm run dev

# Terminal 2: Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Features

- 🚀 **Rapid Development**: 6-day sprint methodology
- 🔌 **Pluggable Providers**: Support for OpenAI, Anthropic, local models
- 💰 **Cost Transparency**: Real-time usage and cost tracking
- 🤝 **Collaboration**: Shared sessions and team features
- 🧠 **Reasoning Visualization**: See AI's chain-of-thought
- 🔒 **Enterprise Security**: Self-hosting options with Docker/K8s

## Getting Started

1. **Environment Setup**:
   ```bash
   # In wavelength-ui/.env.local
   OPENROUTER_API_KEY=your-api-key
   CUSTOM_BASE_URL=https://kilocode.ai/api/openrouter
   ```

2. **Run the Application**:
   ```bash
   cd wavelength-ui
   npm install
   npm run dev
   ```

3. **Access the UI**: Open http://localhost:3000

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Radix UI, shadcn/ui
- **Backend (Optional)**: FastAPI, Python 3.8+
- **AI Integration**: OpenRouter API

## API Endpoints

### Next.js API Routes (Built-in)
- `POST /api/responses` - Create a new AI response
- `GET /api/responses/{id}` - Get response status
- `GET /api/responses/{id}/stream` - Stream response updates

### Python Backend (Optional)
- `POST /api/responses` - Create a new reasoning task
- `GET /api/responses/{id}` - Get task status and results
- `GET /api/responses/{id}/stream` - Stream task progress
- `WS /ws` - WebSocket for real-time updates

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OPENROUTER_API_KEY` | - | Your OpenRouter API key (required) |
| `CUSTOM_BASE_URL` | `https://openrouter.ai/api/v1` | API base URL |

## Project Vision

Wavelength aims to be the definitive universal AI chat interface by:
- Synthesizing the best features from open-source and commercial solutions
- Providing a modular, transparent, and collaborative platform
- Enabling rapid iteration with 6-day development cycles
- Building trust through reasoning visualization
- Offering enterprise-grade security and compliance

## License

This project is open source and available under the MIT License.