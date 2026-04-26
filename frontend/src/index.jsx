import React, { useState, useEffect } from 'react';
import api from './api';
import './styles.css';

const formatCurrency = (value = 0) => `$${Number(value || 0).toFixed(2)}`;

const clampPercent = (value = 0) => Math.max(0, Math.min(100, Number(value || 0)));

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
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState('');

  // subscription form
  const [subName, setSubName] = useState('');
  const [subCost, setSubCost] = useState('');
  const [subDescription, setSubDescription] = useState('');

  // payment summary
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [isEditingSubscription, setIsEditingSubscription] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editBillingDate, setEditBillingDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);

  // check if already logged in on load
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem('user');
      }
      setPage('dashboard');
      fetchSubscriptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeout = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const showToast = (message) => {
    setToast(message);
  };

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
    setIsEditingSubscription(false);
    setMemberResults([]);
    setMemberQuery('');
    setToast('');
  };

  // ==================== SUBSCRIPTIONS ====================

  const fetchSubscriptions = async () => {
    setSubscriptionsLoading(true);
    try {
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data.subscriptions);
    } catch (err) {
      showToast('Failed to load subscriptions');
    } finally {
      setSubscriptionsLoading(false);
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
      showToast('Subscription created');
      fetchSubscriptions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create subscription');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentSummary = async (subId) => {
    setSummaryLoading(true);
    try {
      const res = await api.get(`/payments/subscription/${subId}/summary`);
      setPaymentSummary(res.data);
    } catch (err) {
      showToast('Failed to load payment summary');
      setPaymentSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleSelectSubscription = (sub) => {
    setSelectedSub(sub);
    setIsEditingSubscription(false);
    setEditName(sub.name);
    setEditCost(String(sub.cost));
    setEditBillingDate(String(sub.billing_date || 15));
    setEditDescription(sub.description || '');
    setMemberResults([]);
    setMemberQuery('');
    fetchPaymentSummary(sub.id);
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    if (!selectedSub) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await api.put(`/subscriptions/${selectedSub.id}`, {
        name: editName,
        cost: parseFloat(editCost),
        billing_date: parseInt(editBillingDate, 10),
        description: editDescription,
      });
      setSelectedSub(response.data.subscription);
      await fetchSubscriptions();
      await fetchPaymentSummary(selectedSub.id);
      setIsEditingSubscription(false);
      showToast('Subscription updated');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!selectedSub) {
      return;
    }

    const shouldDelete = window.confirm(`Delete ${selectedSub.name}? This cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setActionLoading(true);
    try {
      await api.delete(`/subscriptions/${selectedSub.id}`);
      setSelectedSub(null);
      setPaymentSummary(null);
      setIsEditingSubscription(false);
      await fetchSubscriptions();
      showToast('Subscription deleted');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearchMembers = async () => {
    if (!memberQuery.trim()) {
      setMemberResults([]);
      return;
    }

    setMemberSearchLoading(true);
    try {
      const response = await api.get('/users/search', { params: { query: memberQuery } });
      setMemberResults(response.data.users || []);
    } catch (err) {
      showToast('Failed to search users');
    } finally {
      setMemberSearchLoading(false);
    }
  };

  const handleAddMember = async (memberId) => {
    if (!selectedSub) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/subscriptions/${selectedSub.id}/members`, { user_id: memberId });
      await fetchSubscriptions();
      await fetchPaymentSummary(selectedSub.id);
      setMemberResults([]);
      setMemberQuery('');
      showToast('Member added');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add member');
    } finally {
      setActionLoading(false);
    }
  };

  // ==================== RENDER ====================

  // LOGIN PAGE
  if (page === 'login') {
    return (
      <div className="auth-page-wrapper">
        <div className="auth-left">
          <div className="auth-left-logo">Money Lovers</div>
          <div className="auth-left-tagline">
            Split subscriptions and track shared expenses with your group
          </div>
          <div className="auth-left-features">
            <div className="auth-left-feature">Split costs automatically</div>
            <div className="auth-left-feature">Track payment status</div>
            <div className="auth-left-feature">Secure and encrypted</div>
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
              <button type="button" className="auth-switch-link" onClick={() => { setPage('register'); setError(''); }}>
                Create one
              </button>
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
          <div className="auth-left-logo">Money Lovers</div>
          <div className="auth-left-tagline">
            Split subscriptions and track shared expenses with your group
          </div>
          <div className="auth-left-features">
            <div className="auth-left-feature">Split costs automatically</div>
            <div className="auth-left-feature">Track payment status</div>
            <div className="auth-left-feature">Secure and encrypted</div>
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
              <button type="button" className="auth-switch-link" onClick={() => { setPage('login'); setError(''); }}>
                Sign in
              </button>
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
    const completionPercentage = clampPercent(paymentSummary?.completion_percentage);

    return (
      <div className="dashboard">
        {toast && <div className="toast">{toast}</div>}
        <div className="header">
          <h1>Money Lovers</h1>
          <div className="user-section">
            <div className="user-badge">{user.username}</div>
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
              <span className="summary-stat-value">{formatCurrency(totalMonthly)}</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-stat">
              <span className="summary-stat-label">Your Share</span>
              <span className="summary-stat-value green">{formatCurrency(totalPerPerson)}</span>
            </div>
          </div>
        </div>

        <div className="content">
          <div className="main-panel">

            {/* create subscription form */}
            <div className="create-form">
              <div className="panel-heading">
                <h3>New Subscription</h3>
                <p>Add a shared bill and split it with your group.</p>
              </div>
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
              <div className="panel-heading">
                <h3>Your Subscriptions ({subscriptions.length})</h3>
                <p>Select one to view payment progress and member status.</p>
              </div>
              {subscriptions.length === 0 ? (
                <div className="empty-state">
                  No subscriptions yet. Add one above!
                </div>
              ) : subscriptionsLoading ? (
                <div className="empty-state">Loading subscriptions...</div>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`subscription-card ${selectedSub?.id === sub.id ? 'active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectSubscription(sub)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelectSubscription(sub);
                      }
                    }}
                  >
                    <div>
                      <h4>{sub.name}</h4>
                      {sub.description && <p>{sub.description}</p>}
                      <div className="sub-info">
                        <span>{sub.members_count} members</span>
                        <span>Bills day {sub.billing_date || 15}</span>
                      </div>
                    </div>
                    <div className="sub-cost-badge">
                      <div className="sub-cost-main">{formatCurrency(sub.per_person_cost)}</div>
                      <div className="sub-cost-per">/person</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* payment summary panel */}
          {selectedSub && paymentSummary ? (
            <div className="side-panel">
              <div className="side-panel-header">
                <h3>{selectedSub.name}</h3>
                <p>{formatCurrency(selectedSub.cost)}/month · {selectedSub.members_count} members</p>
              </div>

              <div className="side-panel-body">
                {summaryLoading && <div className="empty-state">Loading payment summary...</div>}
                <div className="summary-box">
                  <div className="stat">
                    <span>Total</span>
                    <span className="amount">{formatCurrency(paymentSummary.total_amount)}</span>
                  </div>
                  <div className="stat">
                    <span>Paid</span>
                    <span className="amount completed">{formatCurrency(paymentSummary.completed_amount)}</span>
                  </div>
                  <div className="stat">
                    <span>Pending</span>
                    <span className="amount pending">{formatCurrency(paymentSummary.pending_amount)}</span>
                  </div>
                  <div className="stat">
                    <span>Overdue</span>
                    <span className="amount overdue">{formatCurrency(paymentSummary.overdue_amount)}</span>
                  </div>
                </div>

                <div className="progress-section">
                  <div className="progress-label">
                    <span>Payment progress</span>
                    <span>{completionPercentage}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${completionPercentage}%` }}
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
                          <td>{formatCurrency(payment.amount)}</td>
                          <td className={`status-${payment.status}`}>
                            {payment.status.toUpperCase()}
                            {payment.is_overdue && ' (Overdue)'}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                <div className="side-panel-actions">
                  <button onClick={() => setIsEditingSubscription((value) => !value)} className="secondary-btn" disabled={actionLoading}>
                    {isEditingSubscription ? 'Cancel Edit' : 'Edit Subscription'}
                  </button>
                  <button onClick={handleDeleteSubscription} className="danger-btn" disabled={actionLoading}>
                    {actionLoading ? 'Working...' : 'Delete Subscription'}
                  </button>
                </div>

                {isEditingSubscription && (
                  <form onSubmit={handleUpdateSubscription} className="inline-form">
                    <h4>Edit subscription</h4>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" required />
                    <input type="number" step="0.01" value={editCost} onChange={(e) => setEditCost(e.target.value)} placeholder="Cost" required />
                    <input type="number" value={editBillingDate} onChange={(e) => setEditBillingDate(e.target.value)} placeholder="Billing day" min="1" max="31" required />
                    <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" />
                    <button type="submit" className="secondary-btn" disabled={actionLoading}>
                      {actionLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </form>
                )}

                <div className="inline-form">
                  <h4>Add member</h4>
                  <div className="search-row">
                    <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search username or email" />
                    <button type="button" className="secondary-btn" onClick={handleSearchMembers} disabled={memberSearchLoading || actionLoading}>
                      {memberSearchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  {memberResults.length > 0 && (
                    <div className="member-results">
                      {memberResults.map((member) => (
                        <button
                          type="button"
                          key={member.id}
                          className="member-result-item"
                          onClick={() => handleAddMember(member.id)}
                          disabled={actionLoading}
                        >
                          <span>{member.username}</span>
                          <span>{member.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={() => setSelectedSub(null)} className="close-btn">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="side-panel side-panel-empty">
              <h3>Payment Insights</h3>
              <p>Select a subscription to see totals, statuses, and payment progress for each member.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
}

export default App;
