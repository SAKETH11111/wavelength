# Enhanced Maximum Reasoning Lab

A FastAPI-based application that provides an enhanced interface for maximum reasoning tasks using OpenRouter's O3-Pro model.

## Features

- **Real-time WebSocket streaming** for reasoning progress
- **Background task management** for long-running operations
- **Enhanced UI** with live updates and progress tracking
- **Configurable API endpoints** and providers
- **Cost estimation** and usage tracking
- **Task cancellation** and status monitoring

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example configuration file and update it with your settings:

```bash
cp config.example.env .env
```

Edit `.env` and add your OpenRouter API key:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
PORT=8001
```

### 3. Get Your API Key

1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Create an account and generate an API key
3. Add the key to your `.env` file

### 4. Run the Application

```bash
python enhanced_app.py
```

The application will start on `http://localhost:8001` (or the port specified in your `.env` file).

## API Endpoints

### Core Endpoints

- `GET /` - Enhanced web interface
- `POST /responses` - Create a new reasoning task
- `GET /responses/{id}` - Get task status and results
- `POST /responses/{id}/cancel` - Cancel a running task
- `GET /responses/{id}/stream` - Stream task progress
- `GET /tasks` - List all tasks

### Configuration

- `POST /config/update` - Update API key and base URL
- `GET /health` - Health check endpoint

### WebSocket

- `WS /ws` - Real-time updates and streaming

## Usage Examples

### Create a Reasoning Task

```bash
curl -X POST "http://localhost:8001/responses" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/o3-pro",
    "input": [{"role": "user", "content": "Explain quantum computing in simple terms"}],
    "background": true,
    "reasoning": {"effort": "high", "summary": "auto"}
  }'
```

### Monitor Task Progress

```bash
curl "http://localhost:8001/responses/{task_id}"
```

### Stream Real-time Updates

```bash
curl "http://localhost:8001/responses/{task_id}/stream"
```

## Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OPENROUTER_API_KEY` | - | Your OpenRouter API key (required) |
| `CUSTOM_BASE_URL` | `https://openrouter.ai/api/v1` | API base URL |
| `PORT` | `8001` | Server port |
| `LOG_LEVEL` | `INFO` | Logging level |

## Troubleshooting

### Port Already in Use

If you get a port conflict error, either:
1. Change the `PORT` in your `.env` file
2. Kill the process using the port: `lsof -ti:8000 | xargs kill -9`

### Missing API Key

The application will start without an API key but with limited functionality. You can:
1. Set the `OPENROUTER_API_KEY` environment variable
2. Use the `/config/update` endpoint to configure it at runtime

### WebSocket Connection Issues

Make sure your browser supports WebSockets and that you're accessing the application via `http://` or `https://` (not `file://`).

## Development

### Running in Development Mode

```bash
uvicorn enhanced_app:app --reload --host 0.0.0.0 --port 8001
```

### Code Style

This project follows PEP 8 standards. Use Black for formatting:

```bash
pip install black
black enhanced_app.py
```

## License

This project is open source and available under the MIT License. 