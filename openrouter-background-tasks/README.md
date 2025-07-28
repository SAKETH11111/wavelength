# Minimal AI Chat Interface

A clean, professional AI chat interface with true parallel processing capabilities. Features real-time reasoning display, token tracking, and support for multiple AI models including o3 Pro, o3, and Grok 4.

## Features

- **True Parallel Processing**: Run multiple AI conversations simultaneously without blocking
- **Clean Minimal Design**: Black and white aesthetic with Geist Mono typography
- **Real-time Reasoning**: Watch AI thinking processes in real-time
- **Token Tracking**: Monitor input, reasoning, and output tokens with cost estimates
- **WebSocket Communication**: Live updates and streaming
- **Multiple AI Models**: o3 Pro, o3, and Grok 4 at maximum reasoning settings
- **Responsive Design**: Works seamlessly on desktop and mobile

## Setup

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment**
   Create a `.env` file with your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   CUSTOM_BASE_URL=https://openrouter.ai/api/v1
   ```

## Running the Application

### Option 1: Using the Runner Script (Recommended)
```bash
python run_enhanced.py
```

### Option 2: Direct Execution
```bash
python enhanced_app.py
```

The application will start on `http://localhost:8000`

## Usage

1. **Create New Chat**: Click "New Chat" to start a conversation
2. **Select Model**: Choose between o3 Pro, o3, or Grok 4
3. **Send Messages**: Type your message and press Enter
4. **Multiple Conversations**: Create multiple chats that run in parallel
5. **Monitor Progress**: Watch real-time reasoning, token counts, and costs
6. **Settings**: Configure API keys and display preferences

## File Structure

```
openrouter-background-tasks/
├── enhanced_app.py           # Main FastAPI application
├── background_task_manager.py # Task management and API integration
├── run_enhanced.py          # Application runner script
├── requirements.txt         # Python dependencies
├── README.md               # This file

├── .env                    # Environment configuration (create this)
└── templates/
    └── enhanced_ui.html    # Main UI template
```

## API Endpoints

- `GET /` - Main chat interface
- `GET /health` - Health check endpoint
- `POST /responses` - Create new AI task
- `GET /responses/{task_id}` - Check task status
- `POST /responses/{task_id}/cancel` - Cancel task
- `POST /config/update` - Update API configuration
- `WebSocket /ws` - Real-time communication

## Technology Stack

- **Backend**: FastAPI, Python 3.12+
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Styling**: Tailwind CSS, Custom CSS Variables
- **Icons**: Lucide Icons
- **Typography**: Geist Mono
- **Communication**: WebSockets for real-time updates
- **AI Integration**: OpenRouter API

## Development

The application uses modern web standards and clean architecture:

- **CSS Variables**: Consistent theming with light/dark mode support
- **WebSocket Management**: Real-time updates without polling
- **Task Isolation**: Each conversation maintains independent state
- **Error Handling**: Robust error management and recovery
- **Responsive Design**: Mobile-first approach with progressive enhancement

## License

This project is provided as-is for educational and development purposes.