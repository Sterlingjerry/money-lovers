"""Route-level tests for auth, subscriptions, and payment flows."""

from datetime import datetime, timedelta

import pytest
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token

from models import Payment, Subscription, User, db
from routes import api, limiter


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = 'test-secret'
    app.config['RATELIMIT_ENABLED'] = False

    db.init_app(app)
    JWTManager(app)
    limiter.init_app(app)
    app.register_blueprint(api, url_prefix='/api')

    with app.app_context():
        db.session.execute(db.text('PRAGMA foreign_keys=ON'))
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def _create_user(app, email, username, password='password123'):
    with app.app_context():
        user = User(email=email, username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user.id


def _token(app, user_id):
    with app.app_context():
        return create_access_token(identity=str(user_id))


def _auth_headers(token):
    return {'Authorization': f'Bearer {token}'}


def _create_subscription(app, creator_id, name='Netflix', cost=30, billing_date=15):
    with app.app_context():
        creator = db.session.get(User, creator_id)
        sub = Subscription(
            name=name,
            description='Shared plan',
            cost=cost,
            billing_date=billing_date,
            creator_id=creator_id,
        )
        sub.add_member(creator)
        db.session.add(sub)
        db.session.flush()
        payment = Payment(
            subscription_id=sub.id,
            payer_id=creator_id,
            amount=sub.calculate_per_person_cost(),
            status='pending',
            due_date=datetime.utcnow() + timedelta(days=30),
        )
        db.session.add(payment)
        db.session.commit()
        return sub.id


class TestAuthRoutes:
    def test_register_and_login(self, client):
        register = client.post(
            '/api/register',
            json={'email': 'a@b.com', 'username': 'alice', 'password': 'password123'},
        )
        assert register.status_code == 201

        login = client.post('/api/login', json={'email': 'a@b.com', 'password': 'password123'})
        assert login.status_code == 200
        body = login.get_json()
        assert body['access_token']
        assert body['refresh_token']
        assert body['user']['username'] == 'alice'


class TestSubscriptionRoutes:
    def test_create_and_list_subscriptions(self, app, client):
        user_id = _create_user(app, 'owner@test.com', 'owner')
        token = _token(app, user_id)

        create = client.post(
            '/api/subscriptions',
            headers=_auth_headers(token),
            json={'name': 'Spotify', 'cost': 19.99, 'description': 'music', 'billing_date': 12},
        )
        assert create.status_code == 201

        listing = client.get('/api/subscriptions', headers=_auth_headers(token))
        assert listing.status_code == 200
        subscriptions = listing.get_json()['subscriptions']
        assert len(subscriptions) == 1
        assert subscriptions[0]['name'] == 'Spotify'

    def test_update_subscription_rebuilds_pending_payments(self, app, client):
        user_id = _create_user(app, 'owner2@test.com', 'owner2')
        token = _token(app, user_id)
        sub_id = _create_subscription(app, user_id, cost=20)

        response = client.put(
            f'/api/subscriptions/{sub_id}',
            headers=_auth_headers(token),
            json={'cost': 40, 'billing_date': 20, 'description': 'updated'},
        )

        assert response.status_code == 200
        with app.app_context():
            pending = Payment.query.filter_by(subscription_id=sub_id, status='pending').all()
            assert len(pending) == 1
            assert pending[0].amount == 40

    def test_delete_subscription_as_creator(self, app, client):
        user_id = _create_user(app, 'owner3@test.com', 'owner3')
        token = _token(app, user_id)
        sub_id = _create_subscription(app, user_id)

        deleted = client.delete(f'/api/subscriptions/{sub_id}', headers=_auth_headers(token))
        assert deleted.status_code == 200

        with app.app_context():
            assert db.session.get(Subscription, sub_id) is None


class TestSearchAndSummary:
    def test_user_search_excludes_current_user(self, app, client):
        current_id = _create_user(app, 'current@test.com', 'current')
        _create_user(app, 'carol@test.com', 'carol')
        token = _token(app, current_id)

        response = client.get('/api/users/search?query=car', headers=_auth_headers(token))
        assert response.status_code == 200
        users = response.get_json()['users']
        assert len(users) == 1
        assert users[0]['username'] == 'carol'

    def test_payment_summary_requires_membership(self, app, client):
        creator_id = _create_user(app, 'creator@test.com', 'creator')
        outsider_id = _create_user(app, 'outsider@test.com', 'outsider')
        outsider_token = _token(app, outsider_id)
        sub_id = _create_subscription(app, creator_id)

        denied = client.get(
            f'/api/payments/subscription/{sub_id}/summary',
            headers=_auth_headers(outsider_token),
        )
        assert denied.status_code == 403
