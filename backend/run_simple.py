"""
Money Lovers - Simplified Entry Point
Just one file to start the server!
"""

from app_factory import create_app
import os

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
