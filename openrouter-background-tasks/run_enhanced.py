#!/usr/bin/env python3
"""
Maximum Reasoning Lab - Enhanced Version
Run this script to start the enhanced UI with live reasoning capabilities
"""

import uvicorn
import sys
import os
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

def main():
    print("Starting Maximum Reasoning Lab - Enhanced Version")
    print("=" * 60)
    print("Features:")
    print("• ChatGPT-style interface")
    print("• Live reasoning streaming")
    print("• Real-time token tracking")
    print("• WebSocket communication")
    print("• Enhanced model support")
    print("=" * 60)
    
    # Check environment
    api_key = os.getenv("OPENROUTER_API_KEY")
    base_url = os.getenv("CUSTOM_BASE_URL", "https://openrouter.ai/api/v1")
    
    if not api_key:
        print("Warning: OPENROUTER_API_KEY not found in environment")
        print("   You can configure it in the settings panel")
    else:
        print("API Key configured")
    
    print(f"Base URL: {base_url}")
    print()
    print("Starting server...")
    print("Enhanced UI: http://localhost:8000")
    print("Health Check: http://localhost:8000/health")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    try:
        uvicorn.run(
            "enhanced_app:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\nMaximum Reasoning Lab stopped")

if __name__ == "__main__":
    main()