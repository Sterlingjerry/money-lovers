"""Seed demo users and a sample subscription for local testing."""

from datetime import datetime, timedelta

from app_factory import create_app
from models import Payment, Subscription, User, db


DEMO_USERS = [
    {
        'email': 'alice@example.com',
        'username': 'alice',
        'password': 'password123',
    },
    {
        'email': 'bob@example.com',
        'username': 'bob',
        'password': 'password123',
    },
    {
        'email': 'carol@example.com',
        'username': 'carol',
        'password': 'password123',
    },
]


def get_or_create_user(email, username, password):
    user = User.query.filter_by(email=email).first()
    if user:
        user.username = username
        user.set_password(password)
        user.reset_failed_login()
        return user, False

    user = User(email=email, username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()
    return user, True


def get_or_create_subscription(creator, members):
    subscription = Subscription.query.filter_by(name='Netflix Family', creator_id=creator.id).first()
    if subscription:
        return subscription, False

    subscription = Subscription(
        name='Netflix Family',
        description='Demo subscription for the class project',
        cost=24.99,
        billing_date=15,
        creator_id=creator.id,
    )
    subscription.add_member(creator)
    for member in members:
        subscription.add_member(member)

    db.session.add(subscription)
    db.session.flush()

    amount = subscription.calculate_per_person_cost()
    for member in subscription.members:
        db.session.add(
            Payment(
                subscription_id=subscription.id,
                payer_id=member.id,
                amount=amount,
                status='pending',
                due_date=datetime.utcnow() + timedelta(days=30),
            )
        )

    return subscription, True


def main():
    app = create_app()

    with app.app_context():
        created_users = []
        for demo_user in DEMO_USERS:
            user, created = get_or_create_user(
                demo_user['email'],
                demo_user['username'],
                demo_user['password'],
            )
            if created:
                created_users.append(user.username)

        alice = User.query.filter_by(email='alice@example.com').first()
        bob = User.query.filter_by(email='bob@example.com').first()
        carol = User.query.filter_by(email='carol@example.com').first()

        subscription, created_subscription = get_or_create_subscription(alice, [bob, carol])

        db.session.commit()

        print('Demo data ready.')
        print('Users:')
        for demo_user in DEMO_USERS:
            print(f"- {demo_user['username']} / {demo_user['email']} / {demo_user['password']}")
        print(f"Subscription: {subscription.name}")
        if created_subscription:
            print('Sample subscription created with all three users.')
        elif subscription:
            print('Sample subscription already existed.')


if __name__ == '__main__':
    main()
