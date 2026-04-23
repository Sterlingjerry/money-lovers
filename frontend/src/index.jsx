import React, { useState, useEffect } from 'react';
import api from './api';
import './styles.css';

function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);

  // form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // subscription form
  const [subName, setSubName] = useState('');
  const [subCost, setSubCost] = useState('');
  const [subDescription, setSubDescription] = useState('');

  // payment summary
  const [paymentSummary, setPaymentSummary] = useState(null);

  // check if already logged in on load
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      setPage('dashboard');
      fetchSubscriptions();
    }
  }, []);

  // ==================== AUTH ====================

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/register', { email, username, password });
      setPage('login');
      setEmail('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/login', { email, password });
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setPage('dashboard');
      setEmail('');
      setPassword('');
      fetchSubscriptions();
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setPage('login');
    setSubscriptions([]);
    setSelectedSub(null);
    setPaymentSummary(null);
  };

  // ==================== SUBSCRIPTIONS ====================

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data.subscriptions);
    } catch (err) {
      console.error('Failed to fetch subscriptions');
    }
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/subscriptions', {
        name: subName,
        description: subDescription,
        cost: parseFloat(subCost),
        billing_date: 15,
        members: []
      });
      setSubName('');
      setSubCost('');
      setSubDescription('');
      fetchSubscriptions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSummary = async (subId) => {
    try {
      const res = await api.get(`/payments/subscription/${subId}/summary`);
      setPaymentSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch payment summary');
    }
  };

  const handleSelectSubscription = (sub) => {
    setSelectedSub(sub);
    fetchPaymentSummary(sub.id);
  };

  // ==================== RENDER ====================

  // LOGIN PAGE
  if (page === 'login') {
    return (
      <div className="auth-page-wrapper">
        <div className="auth-left">
          <div className="auth-left-logo">💰 Money Lovers</div>
          <div className="auth-left-tagline">
            Split subscriptions and track shared expenses with your group
          </div>
          <div className="auth-left-features">
            <div className="auth-left-feature">✅ Split costs automatically</div>
            <div className="auth-left-feature">✅ Track payment status</div>
            <div className="auth-left-feature">✅ Secure & encrypted</div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-container">
            <h1>Welcome back</h1>
            <h2>Sign in to your account</h2>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p>
              Don't have an account?{' '}
              <a href="#" onClick={() => { setPage('register'); setError(''); }}>
                Create one
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // REGISTER PAGE
  if (page === 'register') {
    return (
      <div className="auth-page-wrapper">
        <div className="auth-left">
          <div className="auth-left-logo">💰 Money Lovers</div>
          <div className="auth-left-tagline">
            Split subscriptions and track shared expenses with your group
          </div>
          <div className="auth-left-features">
            <div className="auth-left-feature">✅ Split costs automatically</div>
            <div className="auth-left-feature">✅ Track payment status</div>
            <div className="auth-left-feature">✅ Secure & encrypted</div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-container">
            <h1>Create account</h1>
            <h2>Start splitting costs with your group</h2>

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  placeholder="yourname"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <p>
              Already have an account?{' '}
              <a href="#" onClick={() => { setPage('login'); setError(''); }}>
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD PAGE
  if (page === 'dashboard' && user) {
    // calculate totals for summary bar
    const totalMonthly = subscriptions.reduce((sum, s) => sum + s.cost, 0);
    const totalPerPerson = subscriptions.reduce((sum, s) => sum + s.per_person_cost, 0);

    return (
      <div className="dashboard">
        <div className="header">
          <h1>💰 Money Lovers</h1>
          <div className="user-section">
            <div className="user-badge">👤 {user.username}</div>
            <button onClick={handleLogout} className="logout-btn">
              Sign Out
            </button>
          </div>
        </div>

        {/* summary bar */}
        <div className="summary-bar">
          <div className="summary-bar-inner">
            <div className="summary-stat">
              <span className="summary-stat-label">Subscriptions</span>
              <span className="summary-stat-value blue">{subscriptions.length}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-label">Total Monthly</span>
              <span className="summary-stat-value">${totalMonthly.toFixed(2)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-label">Your Share</span>
              <span className="summary-stat-value green">${totalPerPerson.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="content">
          <div className="main-panel">

            {/* create subscription form */}
            <div className="create-form">
              <h3>New Subscription</h3>
              <form onSubmit={handleCreateSubscription}>
                <div className="create-form-grid">
                  <input
                    type="text"
                    placeholder="Name (Netflix, Spotify…)"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <input
                    type="number"
                    placeholder="Monthly cost ($)"
                    step="0.01"
                    value={subCost}
                    onChange={(e) => setSubCost(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  disabled={loading}
                />
                {error && <div className="error" style={{ marginTop: '0.75rem' }}>{error}</div>}
                <div style={{ marginTop: '0.75rem' }}>
                  <button type="submit" className="create-btn" disabled={loading}>
                    {loading ? 'Creating...' : '+ Add Subscription'}
                  </button>
                </div>
              </form>
            </div>

            {/* subscriptions list */}
            <div className="subscriptions-list">
              <h3>Your Subscriptions ({subscriptions.length})</h3>
              {subscriptions.length === 0 ? (
                <div className="empty-state">
                  No subscriptions yet. Add one above!
                </div>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`subscription-card ${selectedSub?.id === sub.id ? 'active' : ''}`}
                    onClick={() => handleSelectSubscription(sub)}
                  >
                    <div>
                      <h4>{sub.name}</h4>
                      {sub.description && <p>{sub.description}</p>}
                      <div className="sub-info">
                        <span>👥 {sub.members_count} members</span>
                        <span>📅 Bills day {sub.billing_date || 15}</span>
                      </div>
                    </div>
                    <div className="sub-cost-badge">
                      <div className="sub-cost-main">${sub.per_person_cost.toFixed(2)}</div>
                      <div className="sub-cost-per">/person</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* payment summary panel */}
          {selectedSub && paymentSummary && (
            <div className="side-panel">
              <div className="side-panel-header">
                <h3>{selectedSub.name}</h3>
                <p>${selectedSub.cost.toFixed(2)}/month · {selectedSub.members_count} members</p>
              </div>

              <div className="side-panel-body">
                <div className="summary-box">
                  <div className="stat">
                    <span>Total</span>
                    <span className="amount">${paymentSummary.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span>Paid</span>
                    <span className="amount completed">${paymentSummary.completed_amount.toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span>Pending</span>
                    <span className="amount pending">${paymentSummary.pending_amount.toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span>Overdue</span>
                    <span className="amount overdue">${paymentSummary.overdue_amount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="progress-section">
                  <div className="progress-label">
                    <span>Payment progress</span>
                    <span>{paymentSummary.completion_percentage}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${paymentSummary.completion_percentage}%` }}
                    />
                  </div>
                </div>

                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(paymentSummary.payments_by_user || {}).map(
                      ([uname, payment]) => (
                        <tr key={payment.user_id}>
                          <td>{uname}</td>
                          <td>${payment.amount.toFixed(2)}</td>
                          <td className={`status-${payment.status}`}>
                            {payment.status.toUpperCase()}
                            {payment.is_overdue && ' ⚠️'}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                <button onClick={() => setSelectedSub(null)} className="close-btn">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
}

export default App;
