"""
Money Lovers - Simplified Routes
All API endpoints in one file - super easy to find what you need
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, create_refresh_token
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
from models import db, User, Subscription, Payment

# Create blueprints
api = Blueprint('api', __name__)
limiter = Limiter(key_func=get_remote_address)

def rebuild_pending_payments(subscription):
    """Rebuild pending payments for all current members of a subscription."""
    Payment.query.filter_by(
        subscription_id=subscription.id,
        status='pending'
    ).delete()

    amount_per_person = subscription.calculate_per_person_cost()

    for member in subscription.members:
        payment = Payment(
            subscription_id=subscription.id,
            payer_id=member.id,
            amount=amount_per_person,
            status='pending',
            due_date=datetime.utcnow() + timedelta(days=30)
        )
        db.session.add(payment)


# ==================== AUTHENTICATION ====================

@api.route('/register', methods=['POST'])
@limiter.limit("5 per hour")
def register():
    """Register a new user"""
    data = request.get_json() or {}
    
    if not all([data.get('email'), data.get('username'), data.get('password')]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if '@' not in data['email']:
        return jsonify({'error': 'Invalid email format'}), 400
    
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken'}), 400
    
    try:
        user = User(email=data['email'], username=data['username'])
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify(user.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Login user and return JWT tokens"""
    data = request.get_json() or {}
    
    if not all([data.get('email'), data.get('password')]):
        return jsonify({'error': 'Email and password required'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    # SECURITY: Check if account is locked
    if user and user.is_locked():
        remaining = (user.locked_until - datetime.utcnow()).total_seconds() / 60
        return {'error': f'Account locked. Try again in {int(remaining)} minutes'}, 429
    
    if not user or not user.check_password(data['password']):
        if user:
            user.increment_failed_login()
            db.session.commit()
            if user.is_locked():
                return {'error': 'Too many failed attempts. Account locked for 15 minutes'}, 429
        return jsonify({'error': 'Invalid email or password'}), 401
    
    # Reset failed attempts on success
    user.reset_failed_login()
    db.session.commit()
    
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }), 200


@api.route('/refresh', methods=['POST'])
@jwt_required(refresh=True) 
def refresh():
    """Get new access token"""
    current_user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(current_user_id))

    return jsonify({'access_token': access_token}), 200


@api.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify(user.to_dict()), 200


# ==================== SUBSCRIPTIONS ====================

@api.route('/subscriptions', methods=['POST'])
@jwt_required()
def create_subscription():
    """Create a new subscription"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    if not data.get('name') or data.get('cost') is None:
        return jsonify({'error': 'Name and cost required'}), 400

    try:
        cost = float(data['cost'])
    except (TypeError, ValueError):
        return jsonify({'error': 'Cost must be a valid number'}), 400

    if cost <= 0:
        return jsonify({'error': 'Cost must be greater than 0'}), 400

    try:
        billing_date = int(data.get('billing_date', 1))
    except (TypeError, ValueError):
        return jsonify({'error': 'Billing date must be a valid integer'}), 400

    if billing_date < 1 or billing_date > 31:
        return jsonify({'error': 'Billing date must be between 1 and 31'}), 400
    
    try:
        sub = Subscription(
            name=data['name'],
            description=data.get('description', ''),
            cost=cost,
            billing_date=billing_date,
            creator_id=user_id
    )
            
        creator = User.query.get(user_id)
        sub.add_member(creator)
            
            # Add other members
        for member_id in data.get('members', []):
            if member_id != user_id:
                member = User.query.get(member_id)
                if member:
                    sub.add_member(member)
            
        db.session.add(sub)
        db.session.flush()
            
        # Create payments for all members
        rebuild_pending_payments(sub)
            
        db.session.commit()
        return jsonify({'message': 'Subscription created', 'subscription': sub.to_dict()}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api.route('/subscriptions', methods=['GET'])
@jwt_required()
def get_subscriptions():
    """Get user's subscriptions"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    subs = user.shared_subscriptions
    return jsonify({'subscriptions': [s.to_dict() for s in subs]}), 200


@api.route('/subscriptions/<int:sub_id>', methods=['GET'])
@jwt_required()
def get_subscription(sub_id):
    """Get specific subscription"""
    user_id = int(get_jwt_identity())
    sub = Subscription.query.get(sub_id)
    
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    
    is_member = any(m.id == user_id for m in sub.members)
    is_creator = sub.creator_id == user_id
    
    if not (is_member or is_creator):
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(sub.to_dict()), 200


@api.route('/subscriptions/<int:sub_id>/members', methods=['POST'])
@jwt_required()
def add_member(sub_id):
    """Add member to subscription"""
    user_id = int(get_jwt_identity())
    sub = Subscription.query.get(sub_id)
    
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    
    print("JWT user_id:", user_id, "subscription creator_id:", sub.creator_id)
    
    if sub.creator_id != user_id:
        return jsonify({'error': 'Only creator can add members'}), 403
    
    data = request.get_json() or {}
    member_id = data.get('user_id')
    
    if not member_id:
        return jsonify({'error': 'user_id required'}), 400
    
    try:
        member = User.query.get(member_id)
        if not member:
            return jsonify({'error': 'User not found'}), 404
        
        if member in sub.members:
            return jsonify({'error': 'User is already a member of this subscription'}), 400
        
        sub.add_member(member)
        
        # # Recalculate payments for all members
        rebuild_pending_payments(sub)
        db.session.commit()
        
        return jsonify({'message': 'Member added', 'subscription': sub.to_dict()}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api.route('/subscriptions/<int:sub_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_member(sub_id, member_id):
    """Remove member from subscription"""
    user_id = int(get_jwt_identity())
    sub = Subscription.query.get(sub_id)
    
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    
    if sub.creator_id != user_id:
        return jsonify({'error': 'Only creator can remove members'}), 403
    
    try:
        member = User.query.get(member_id)
        if not member:
            return jsonify({'error': 'User not found'}), 404

        if member_id == sub.creator_id:
            return jsonify({'error': 'Cannot remove the creator from the subscription'}), 400

        if member not in sub.members:
            return jsonify({'error': 'User is not a member of this subscription'}), 400

        sub.remove_member(member)
        rebuild_pending_payments(sub)

        db.session.commit()
        return jsonify({'message': 'Member removed', 'subscription': sub.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== PAYMENTS ====================

@api.route('/payments', methods=['GET'])
@jwt_required()
def get_payments():
    """Get user's payments"""
    user_id = int(get_jwt_identity())
    payments = Payment.query.filter_by(payer_id=user_id).all()
    return jsonify({'payments': [p.to_dict() for p in payments]}), 200


@api.route('/payments/<int:payment_id>', methods=['GET'])
@jwt_required()
def get_payment(payment_id):
    """Get specific payment"""
    user_id = int(get_jwt_identity())
    payment = Payment.query.get(payment_id)
    
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    
    is_payer = payment.payer_id == user_id
    is_creator = payment.subscription.creator_id == user_id
    
    if not (is_payer or is_creator):
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(payment.to_dict()), 200


@api.route('/payments/<int:payment_id>/mark-paid', methods=['POST'])
@jwt_required()
def mark_payment_paid(payment_id):
    """Mark payment as completed"""
    user_id = int(get_jwt_identity())
    payment = Payment.query.get(payment_id)
    
    if not payment:
        return jsonify({'error': 'Payment not found'}), 404
    
    if payment.payer_id != user_id:
        return jsonify({'error': 'Can only mark your own payments as paid'}), 403
    
    try:
        payment.mark_as_paid()
        db.session.commit()
        return jsonify({'message': 'Payment marked as completed', 'payment': payment.to_dict()}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api.route('/payments/subscription/<int:sub_id>/summary', methods=['GET'])
@jwt_required()
def get_payment_summary(sub_id):
    """Get payment summary for subscription"""
    user_id = int(get_jwt_identity())
    sub = Subscription.query.get(sub_id)
    
    if not sub:
        return jsonify({'error': 'Subscription not found'}), 404
    
    is_member = any(m.id == user_id for m in sub.members)
    is_creator = sub.creator_id == user_id
    
    if not (is_member or is_creator):
        return jsonify({'error': 'Access denied'}), 403
    
    payments = Payment.query.filter_by(subscription_id=sub_id).all()
    
    total = sum(p.amount for p in payments)
    completed = sum(p.amount for p in payments if p.status == 'completed')
    pending = sum(p.amount for p in payments if p.status == 'pending')
    overdue = sum(p.amount for p in payments if p.is_overdue())
    
    payment_by_user = {}
    for p in payments:
        payer = User.query.get(p.payer_id)
        if payer.username not in payment_by_user:
            payment_by_user[payer.username] = {
                'user_id': payer.id,
                'status': p.status,
                'amount': p.amount,
                'is_overdue': p.is_overdue()
            }
    
    return jsonify({
        'subscription_id': sub_id,
        'total_amount': total,
        'completed_amount': completed,
        'pending_amount': pending,
        'overdue_amount': overdue,
        'completion_percentage': round((completed / total * 100), 1) if total > 0 else 0,
        'payments_by_user': payment_by_user
    }), 200
