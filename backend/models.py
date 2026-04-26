"""
Money Lovers - Simplified Backend
All models in one file - easier to understand relationships
"""

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, Index
from datetime import datetime, timedelta
import bcrypt

db = SQLAlchemy()


# ==================== USER MODEL ====================
class User(db.Model):
    """User model with bcrypt password hashing"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # SECURITY: Account lockout tracking
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        CheckConstraint('failed_login_attempts >= 0', name='ck_users_failed_login_non_negative'),
    )
    
    # Relationships
    subscriptions = db.relationship('Subscription', backref='creator', lazy=True, foreign_keys='Subscription.creator_id')
    payments = db.relationship('Payment', backref='payer', lazy=True, foreign_keys='Payment.payer_id')
    
    def set_password(self, password):
        """Hash password with bcrypt"""
        salt = bcrypt.gensalt(rounds=10)
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password):
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def is_locked(self):
        """Check if account is locked"""
        if self.locked_until and datetime.utcnow() < self.locked_until:
            return True
        return False
    
    def lock_account(self, minutes=None):
        """Lock account after failed attempts with escalating duration."""
        if minutes is None:
            base_minutes = 15
            extra_attempts = max(0, self.failed_login_attempts - 5)
            minutes = min(120, base_minutes + (extra_attempts * 5))
        self.locked_until = datetime.utcnow() + timedelta(minutes=minutes)
    
    def increment_failed_login(self):
        """Track failed login - lock after 5 attempts"""
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.lock_account(minutes=15)
    
    def reset_failed_login(self):
        """Reset after successful login"""
        self.failed_login_attempts = 0
        self.locked_until = None
        self.last_login = datetime.utcnow()
    
    def to_dict(self):
        """Return user data (without password)"""
        return {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'created_at': self.created_at.isoformat()
        }


# ==================== SUBSCRIPTION MEMBERS (Many-to-Many) ====================
subscription_members = db.Table(
    'subscription_members',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('subscription_id', db.Integer, db.ForeignKey('subscriptions.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow)
)


# ==================== SUBSCRIPTION MODEL ====================
class Subscription(db.Model):
    """Shared subscription model"""
    __tablename__ = 'subscriptions'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(500))
    cost = db.Column(db.Float, nullable=False)
    billing_date = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # SECURITY: Creator is the only one who can modify
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    __table_args__ = (
        CheckConstraint('cost > 0', name='ck_subscriptions_cost_positive'),
        CheckConstraint('billing_date BETWEEN 1 AND 31', name='ck_subscriptions_billing_date_range'),
    )
    
    # Relationships
    members = db.relationship(
        'User',
        secondary=subscription_members,
        lazy='subquery',
        backref=db.backref('shared_subscriptions', lazy=True)
    )
    payments = db.relationship('Payment', backref='subscription', lazy=True, cascade='all, delete-orphan')
    
    def add_member(self, user):
        if user not in self.members:
            self.members.append(user)
    
    def remove_member(self, user):
        if user in self.members:
            self.members.remove(user)
    
    def get_members_count(self):
        return len(self.members)
    
    def calculate_per_person_cost(self):
        """Calculate split cost - equal for all members"""
        if self.get_members_count() < 1:
            return 0
        return round(self.cost / self.get_members_count(), 2)
    
    def to_dict(self, include_members=True):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'cost': self.cost,
            'billing_date': self.billing_date,
            'members_count': self.get_members_count(),
            'per_person_cost': self.calculate_per_person_cost(),
            'creator_id': self.creator_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_members:
            data['members'] = [
                {'id': m.id, 'username': m.username, 'email': m.email}
                for m in self.members
            ]
        
        return data


# ==================== PAYMENT MODEL ====================
class Payment(db.Model):
    """Payment tracking model"""
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id'), nullable=False, index=True)
    payer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending', index=True)  # pending, completed, overdue
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_date = db.Column(db.DateTime, index=True)
    paid_date = db.Column(db.DateTime, nullable=True)
    payment_method = db.Column(db.String(50))

    __table_args__ = (
        CheckConstraint('amount >= 0', name='ck_payments_amount_non_negative'),
        CheckConstraint(
            "status IN ('pending', 'completed', 'overdue')",
            name='ck_payments_status_valid',
        ),
        Index('ix_payments_subscription_status', 'subscription_id', 'status'),
    )
    
    def mark_as_paid(self):
        self.status = 'completed'
        self.paid_date = datetime.utcnow()
    
    def is_overdue(self):
        if self.status == 'pending' and self.due_date:
            return datetime.utcnow() > self.due_date
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'subscription_id': self.subscription_id,
            'payer_id': self.payer_id,
            'amount': self.amount,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'paid_date': self.paid_date.isoformat() if self.paid_date else None,
            'payment_method': self.payment_method,
            'is_overdue': self.is_overdue()
        }
