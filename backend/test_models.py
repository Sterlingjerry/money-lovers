"""Tests for models.py - owned by Riad (Database)."""

import os
import sys
from datetime import datetime, timedelta

import pytest
from flask import Flask
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

sys.path.insert(0, os.path.dirname(__file__))
from models import Payment, Subscription, User, db


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    with app.app_context():
        # SQLite needs this pragma to enforce FK + CHECK constraints strictly
        db.session.execute(db.text('PRAGMA foreign_keys=ON'))
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def session(app):
    return db.session


# -------- User --------

class TestUser:
    def test_password_hashing_roundtrip(self, session):
        u = User(email='a@b.com', username='alice')
        u.set_password('hunter2password')
        assert u.password_hash != 'hunter2password'
        assert u.check_password('hunter2password') is True
        assert u.check_password('wrong') is False

    def test_lockout_after_5_failed_attempts(self, session):
        u = User(email='a@b.com', username='alice')
        u.set_password('whatever123')
        session.add(u); session.commit()  # flush so default=0 is applied
        for _ in range(4):
            u.increment_failed_login()
        assert u.is_locked() is False
        u.increment_failed_login()
        assert u.is_locked() is True

    def test_reset_failed_login_clears_lock(self, session):
        u = User(email='a@b.com', username='alice')
        u.set_password('whatever123')
        session.add(u); session.commit()
        for _ in range(5):
            u.increment_failed_login()
        assert u.is_locked()
        u.reset_failed_login()
        assert u.failed_login_attempts == 0
        assert u.locked_until is None
        assert u.is_locked() is False

    def test_lockout_duration_escalates_with_repeated_abuse(self, session):
        u = User(email='a@b.com', username='alice')
        u.set_password('whatever123')
        session.add(u); session.commit()

        for _ in range(5):
            u.increment_failed_login()
        first_lock_until = u.locked_until

        # Simulate waiting out the first lock without successful login reset.
        u.locked_until = datetime.utcnow() - timedelta(minutes=1)
        u.increment_failed_login()

        assert u.failed_login_attempts == 6
        assert u.locked_until is not None
        assert u.locked_until > first_lock_until

    def test_to_dict_excludes_password(self, session):
        u = User(email='a@b.com', username='alice')
        u.set_password('whatever123')
        session.add(u); session.commit()
        d = u.to_dict()
        assert 'password_hash' not in d
        assert d['email'] == 'a@b.com'
        assert d['username'] == 'alice'

    def test_unique_email_and_username(self, session):
        u1 = User(email='a@b.com', username='alice'); u1.set_password('pw1pw1pw1')
        u2 = User(email='a@b.com', username='bob');   u2.set_password('pw2pw2pw2')
        session.add_all([u1, u2])
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_failed_login_attempts_non_negative_constraint(self, session):
        u = User(email='a@b.com', username='alice', failed_login_attempts=-1)
        u.set_password('whatever123')
        session.add(u)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()


# -------- Subscription --------

class TestSubscription:
    def _user(self, session, email='a@b.com', username='alice'):
        u = User(email=email, username=username)
        u.set_password('whatever123')
        session.add(u); session.commit()
        return u

    def test_cost_must_be_positive(self, session):
        u = self._user(session)
        sub = Subscription(name='Netflix', cost=0, creator_id=u.id)
        session.add(sub)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_cost_negative_rejected(self, session):
        u = self._user(session)
        sub = Subscription(name='Netflix', cost=-5, creator_id=u.id)
        session.add(sub)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_billing_date_range_low(self, session):
        u = self._user(session)
        sub = Subscription(name='Netflix', cost=10, billing_date=0, creator_id=u.id)
        session.add(sub)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_billing_date_range_high(self, session):
        u = self._user(session)
        sub = Subscription(name='Netflix', cost=10, billing_date=32, creator_id=u.id)
        session.add(sub)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_billing_date_edges_ok(self, session):
        u = self._user(session)
        s1 = Subscription(name='A', cost=10, billing_date=1, creator_id=u.id)
        s2 = Subscription(name='B', cost=10, billing_date=31, creator_id=u.id)
        session.add_all([s1, s2]); session.commit()
        assert s1.id and s2.id

    def test_add_remove_members_and_split(self, session):
        creator = self._user(session)
        m1 = self._user(session, 'x@y.com', 'bob')
        m2 = self._user(session, 'p@q.com', 'carol')
        sub = Subscription(name='Netflix', cost=30.0, creator_id=creator.id)
        sub.add_member(creator); sub.add_member(m1); sub.add_member(m2)
        session.add(sub); session.commit()

        assert sub.get_members_count() == 3
        assert sub.calculate_per_person_cost() == 10.0

        sub.remove_member(m2)
        session.commit()
        assert sub.get_members_count() == 2
        assert sub.calculate_per_person_cost() == 15.0

    def test_add_member_is_idempotent(self, session):
        creator = self._user(session)
        sub = Subscription(name='Netflix', cost=10, creator_id=creator.id)
        sub.add_member(creator); sub.add_member(creator)
        session.add(sub); session.commit()
        assert sub.get_members_count() == 1

    def test_per_person_cost_zero_members(self, session):
        creator = self._user(session)
        sub = Subscription(name='Netflix', cost=10, creator_id=creator.id)
        session.add(sub); session.commit()
        assert sub.calculate_per_person_cost() == 0


# -------- Payment --------

class TestPayment:
    def _sub(self, session):
        u = User(email='a@b.com', username='alice'); u.set_password('whatever123')
        session.add(u); session.commit()
        sub = Subscription(name='Netflix', cost=10, creator_id=u.id)
        sub.add_member(u)
        session.add(sub); session.commit()
        return u, sub

    def test_amount_non_negative_constraint(self, session):
        u, sub = self._sub(session)
        p = Payment(subscription_id=sub.id, payer_id=u.id, amount=-1)
        session.add(p)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_amount_zero_allowed(self, session):
        u, sub = self._sub(session)
        p = Payment(subscription_id=sub.id, payer_id=u.id, amount=0)
        session.add(p); session.commit()
        assert p.id

    def test_status_whitelist_rejects_bad_value(self, session):
        u, sub = self._sub(session)
        p = Payment(subscription_id=sub.id, payer_id=u.id, amount=5, status='garbage')
        session.add(p)
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

    def test_status_whitelist_accepts_all_valid(self, session):
        u, sub = self._sub(session)
        for s in ('pending', 'completed', 'overdue'):
            p = Payment(subscription_id=sub.id, payer_id=u.id, amount=5, status=s)
            session.add(p); session.commit()
            assert p.id

    def test_mark_as_paid_sets_status_and_date(self, session):
        u, sub = self._sub(session)
        p = Payment(subscription_id=sub.id, payer_id=u.id, amount=5, status='pending')
        session.add(p); session.commit()
        assert p.paid_date is None
        p.mark_as_paid()
        session.commit()
        assert p.status == 'completed'
        assert p.paid_date is not None

    def test_is_overdue_true_when_past_due(self, session):
        u, sub = self._sub(session)
        p = Payment(
            subscription_id=sub.id, payer_id=u.id, amount=5,
            status='pending', due_date=datetime.utcnow() - timedelta(days=1),
        )
        session.add(p); session.commit()
        assert p.is_overdue() is True

    def test_is_overdue_false_when_future(self, session):
        u, sub = self._sub(session)
        p = Payment(
            subscription_id=sub.id, payer_id=u.id, amount=5,
            status='pending', due_date=datetime.utcnow() + timedelta(days=5),
        )
        session.add(p); session.commit()
        assert p.is_overdue() is False

    def test_is_overdue_false_when_completed(self, session):
        u, sub = self._sub(session)
        p = Payment(
            subscription_id=sub.id, payer_id=u.id, amount=5,
            status='completed', due_date=datetime.utcnow() - timedelta(days=1),
        )
        session.add(p); session.commit()
        assert p.is_overdue() is False


# -------- Relationships & cascades --------

class TestRelationships:
    def test_subscription_delete_cascades_payments(self, session):
        u = User(email='a@b.com', username='alice'); u.set_password('whatever123')
        session.add(u); session.commit()
        sub = Subscription(name='Netflix', cost=10, creator_id=u.id)
        sub.add_member(u)
        session.add(sub); session.commit()
        p = Payment(subscription_id=sub.id, payer_id=u.id, amount=5, status='pending')
        session.add(p); session.commit()
        payment_id = p.id

        session.delete(sub); session.commit()
        assert session.get(Payment, payment_id) is None

    def test_user_shared_subscriptions_backref(self, session):
        u = User(email='a@b.com', username='alice'); u.set_password('whatever123')
        session.add(u); session.commit()
        sub = Subscription(name='Netflix', cost=10, creator_id=u.id)
        sub.add_member(u)
        session.add(sub); session.commit()
        assert sub in u.shared_subscriptions


# -------- Schema: indexes actually present --------

class TestIndexes:
    def test_expected_indexes_exist(self, app):
        insp = inspect(db.engine)
        sub_idx = {i['name']: tuple(i['column_names']) for i in insp.get_indexes('subscriptions')}
        pay_idx = {i['name']: tuple(i['column_names']) for i in insp.get_indexes('payments')}

        # FK indexes
        assert any('creator_id' in cols for cols in sub_idx.values())
        assert any('subscription_id' in cols and len(cols) == 1 for cols in pay_idx.values())
        assert any('payer_id' in cols for cols in pay_idx.values())
        assert any('status' in cols and len(cols) == 1 for cols in pay_idx.values())
        assert any('due_date' in cols for cols in pay_idx.values())

        # Composite index for rebuild_pending_payments
        assert 'ix_payments_subscription_status' in pay_idx
        assert pay_idx['ix_payments_subscription_status'] == ('subscription_id', 'status')
