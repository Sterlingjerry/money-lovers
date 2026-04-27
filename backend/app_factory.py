"""
Money Lovers - Simplified Config & App Initialization
"""

import os
from datetime import timedelta


# Configuration
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///money_lovers.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'


# Create Flask app
def create_app():
    from flask import Flask
    from flask_cors import CORS
    from flask_migrate import Migrate
    from flask_jwt_extended import JWTManager
    from models import db
    from routes import api, limiter
    
    app = Flask(__name__)
    app.config.from_object(Config)
    migrate = Migrate()
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    allowed_origins = [
        origin.strip()
        for origin in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
        if origin.strip()
    ]
    CORS(app, origins=allowed_origins)
    JWTManager(app)
    limiter.init_app(app)
    
    # Register routes
    app.register_blueprint(api, url_prefix='/api')
    
    # Health check
    @app.route('/health')
    def health():
        return {'status': 'healthy'}, 200
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    return app
