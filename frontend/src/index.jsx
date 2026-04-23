/**
 * Simplified Main App
 * All pages in one component - easier to understand flow
 */

import React, { useState, useEffect } from 'react';
import api from './api';
import './styles.css';

function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Subscription form
  const [subName, setSubName] = useState('');
  const [subCost, setSubCost] = useState('');
  const [subDescription, setSubDescription] = useState('');

  // Check if logged in
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
      setError('');
      setPage('login');
      // Clear form
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

  // ==================== PAYMENT SUMMARY ====================
  const [paymentSummary, setPaymentSummary] = useState(null);

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
      <div className="auth-container">
        <h1>💰 Money Lovers</h1>
        <h2>Login</h2>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p>
          Don't have an account?{' '}
          <a href="#" onClick={() => { setPage('register'); setError(''); }}>
            Register
          </a>
        </p>
      </div>
    );
  }

  // REGISTER PAGE
  if (page === 'register') {
    return (
      <div className="auth-container">
        <h1>💰 Money Lovers</h1>
        <h2>Create Account</h2>
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        
        <p>
          Already have an account?{' '}
          <a href="#" onClick={() => { setPage('login'); setError(''); }}>
            Login
          </a>
        </p>
      </div>
    );
  }

  // DASHBOARD PAGE
  if (page === 'dashboard' && user) {
    return (
      <div className="dashboard">
        <div className="header">
          <h1>💰 Money Lovers Dashboard</h1>
          <div className="user-section">
            <span>Welcome, {user.username}!</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>

        <div className="content">
          {/* Left: Subscriptions */}
          <div className="main-panel">
            <div className="create-form">
              <h3>Create New Subscription</h3>
              <form onSubmit={handleCreateSubscription}>
                <input
                  type="text"
                  placeholder="Name (Netflix, Spotify, etc)"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required
                  disabled={loading}
                />
                
                <input
                  type="number"
                  placeholder="Monthly Cost ($)"
                  step="0.01"
                  value={subCost}
                  onChange={(e) => setSubCost(e.target.value)}
                  required
                  disabled={loading}
                />
                
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  disabled={loading}
                />
                
                {error && <div className="error">{error}</div>}
                
                <button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Subscription'}
                </button>
              </form>
            </div>

            <div className="subscriptions-list">
              <h3>Your Subscriptions</h3>
              {subscriptions.length === 0 ? (
                <p>No subscriptions yet. Create one above!</p>
              ) : (
                subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`subscription-card ${selectedSub?.id === sub.id ? 'active' : ''}`}
                    onClick={() => handleSelectSubscription(sub)}
                  >
                    <h4>{sub.name}</h4>
                    <p>{sub.description}</p>
                    <div className="sub-info">
                      <span>💵 ${sub.cost.toFixed(2)}</span>
                      <span>👥 {sub.members_count} members</span>
                      <span>💸 ${sub.per_person_cost.toFixed(2)}/person</span>
                    </div>
                    <button className="view-btn">View Details</button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Payment Summary */}
          {selectedSub && paymentSummary && (
            <div className="side-panel">
              <h3>{selectedSub.name} - Payment Summary</h3>
              
              <div className="summary-box">
                <div className="stat">
                  <span>Total:</span>
                  <span className="amount">${paymentSummary.total_amount.toFixed(2)}</span>
                </div>
                <div className="stat">
                  <span>Completed:</span>
                  <span className="amount completed">${paymentSummary.completed_amount.toFixed(2)}</span>
                </div>
                <div className="stat">
                  <span>Pending:</span>
                  <span className="amount pending">${paymentSummary.pending_amount.toFixed(2)}</span>
                </div>
                <div className="stat">
                  <span>Overdue:</span>
                  <span className="amount overdue">${paymentSummary.overdue_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${paymentSummary.completion_percentage}%` }}
                >
                  {paymentSummary.completion_percentage}%
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
                    ([username, payment]) => (
                      <tr key={payment.user_id}>
                        <td>{username}</td>
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

              <button 
                onClick={() => setSelectedSub(null)}
                className="close-btn"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
}

export default App;
