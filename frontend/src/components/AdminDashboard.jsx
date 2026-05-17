import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, UserCheck, AlertTriangle, Lock, Database, Activity, Settings, LogOut, Plus, Download, Save } from 'lucide-react';
import { fmtDate } from '../utils/helpers';

const API = '';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [providers, setProviders] = useState([]);
  const [users, setUsers] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [accessLogs, setAccessLogs] = useState([]);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  
  // Provider form state
  const [providerForm, setProviderForm] = useState({
    name: '', email: '', phone: '', national_id: '', sex: '', status: '1', password: ''
  });
  
  // User form state
  const [userForm, setUserForm] = useState({
    name: '', email: '', phone: '', national_id: '', sex: '', balance: '', status: '1'
  });
  
  // Settings state
  const [settings, setSettings] = useState({
    system_name: 'Mobile Money Fraud Detection',
    max_transfer: 10000,
    fraud_threshold: 0.7,
    session_timeout: 30,
    max_pin_attempts: 3
  });
  
  const sessionToken = localStorage.getItem('sessionToken');
  
  useEffect(() => {
    validateSession();
    loadDashboardData();
    loadPerformanceData();
  }, []);
  
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);
  
  const validateSession = async () => {
    try {
      document.getElementById('admin-name').textContent = 'System Administrator';
    } catch (error) {
      console.log('Session validation error:', error);
    }
  };
  
  const loadDashboardData = async () => {
    loadOverviewData();
    loadProviders();
  };
  
  const loadTabData = async (tabName) => {
    switch(tabName) {
      case 'overview':
        loadOverviewData();
        break;
      case 'providers':
        loadProviders();
        break;
      case 'users':
        loadUsers();
        break;
      case 'fraud-alerts':
        loadFraudAlerts();
        break;
      case 'security':
        loadAccessLogs();
        break;
      case 'performance':
        loadPerformanceData();
        break;
    }
  };
  
  const loadOverviewData = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      const result = await response.json();
      if (result.success) {
        setStats(prev => ({ ...prev, ...result.stats }));
      }
    } catch (error) {
      console.error('Error loading overview data:', error);
    }
  };
  
  const loadProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers');
      const result = await response.json();
      if (result.success) {
        const normalized = (result.providers || []).map(p => ({
          ...p,
          status: p.is_active ? '1' : '0',
          created_at: p.created_date || p.created_at,
        }));
        setProviders(normalized);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };
  
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const result = await response.json();
      if (result.success) {
        // normalize backend field names to what the table expects
        const normalized = (result.users || []).map(u => ({
          phone: u.phone_number || u.phone,
          name: u.full_name || u.name,
          email: u.email,
          national_id: u.national_id,
          sex: u.sex || u.gender,
          balance: u.account_balance ?? u.balance ?? 0,
          is_active: u.is_active,
        }));
        setUsers(normalized);
      } else {
        console.error('Users API error:', result);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };
  
  const loadFraudAlerts = async () => {
    try {
      const response = await fetch('/api/fraud/alerts');
      const result = await response.json();
      if (result.success) {
        setFraudAlerts(result.alerts || []);
      }
    } catch (error) {
      console.error('Error loading fraud alerts:', error);
    }
  };

  const loadAccessLogs = async () => {
    try {
      const response = await fetch('/api/admin/access-logs?limit=50');
      const result = await response.json();
      if (result.success) {
        console.log('First log sample:', result.logs[0]); // ADD THIS
        setAccessLogs(result.logs || []);
      }
    } catch (error) {
      console.error('Error loading access logs:', error);
    }
  };
  
  const loadPerformanceData = async () => {
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/dashboard/stats')
      ]);
      const healthData = await healthRes.json();
      const statsData = await statsRes.json();
      setStats(prev => ({
        ...prev,
        health: healthData,
        txStats: statsData.success ? statsData.stats : null
      }));
    } catch (error) {
      console.error('Error loading performance data:', error);
    }
  };
  
  const logout = () => {
    localStorage.removeItem('sessionToken');
    navigate('/login');
  };
  
  const showAddProviderModal = () => {
    setEditingProvider(null);
    setProviderForm({ name: '', email: '', phone: '', national_id: '', sex: '', status: '1', password: '' });
    setShowProviderModal(true);
  };
  
  const showEditProviderModal = (provider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      email: provider.email,
      phone: provider.phone,
      national_id: provider.national_id,
      sex: provider.sex,
      status: provider.status,
      password: ''
    });
    setShowProviderModal(true);
  };
  
  const showEditUserModal = (user) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      national_id: user.national_id,
      sex: user.sex,
      balance: user.balance,
      status: user.status
    });
    setShowUserModal(true);
  };
  
  const saveProvider = async (e) => {
    e.preventDefault();
    try {
      const url = editingProvider ? '/api/admin/update-provider' : '/api/admin/add-provider';
      const body = editingProvider 
        ? { ...providerForm, provider_id: editingProvider.id } 
        : providerForm;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      
      if (result.success) {
        setShowProviderModal(false);
        loadProviders();
      } else {
        alert(result.error || 'Failed to save provider');
      }
    } catch (error) {
      console.error('Error saving provider:', error);
      alert('Server error. Please try again.');
    }
  };
  
  const saveUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/update-user-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: editingUser.phone,
          full_name: userForm.name,
          email: userForm.email,
          national_id: userForm.national_id,
          sex: userForm.sex,
          account_balance: userForm.balance,
          is_active: userForm.status === '1'
        })
      });
      const result = await response.json();
      if (result.success) {
        setShowUserModal(false);
        loadUsers();
      } else {
        alert(result.error || 'Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Server error. Please try again.');
    }
  };
  
  const saveSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const result = await response.json();
      if (result.success) {
        alert('Settings saved successfully');
      } else {
        alert(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Server error. Please try again.');
    }
  };

  const deleteProvider = async (id) => {
    if (!window.confirm('Are you sure you want to delete this provider?')) return;
    try {
      const response = await fetch('/api/admin/delete-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: id })
      });
      const result = await response.json();
      if (result.success) {
        loadProviders();
      } else {
        alert(result.error || 'Failed to delete provider');
      }
    } catch (error) {
      alert('Server error. Please try again.');
    }
  };

  const deleteUser = async (phone) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone })
      });
      const result = await response.json();
      if (result.success) {
        loadUsers();
      } else {
        alert(result.error || 'Failed to delete user');
      }
    } catch (error) {
      alert('Server error. Please try again.');
    }
  };
  
  const TabButton = ({ tab, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-3 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
        activeTab === tab
          ? 'text-blue-600 border-blue-600'
          : 'text-gray-500 border-transparent hover:text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
  
  const Card = ({ children, className = '', ...props }) => (
    <div className={`bg-white rounded-lg shadow p-6 mb-6 ${className}`} {...props}>{children}</div>
  );
  
  const Button = ({ children, variant = 'primary', className = '', ...props }) => {
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      success: 'bg-green-600 text-white hover:bg-green-700'
    };
    return (
      <button
        className={`px-4 py-2 rounded transition-colors ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Shield className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span id="admin-name" className="text-gray-700">System Administrator</span>
              <Button variant="danger" onClick={logout}>
                <LogOut className="inline w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <nav className="flex py-4 space-x-8">
            <TabButton tab="overview" icon={LayoutDashboard} label="Overview" />
            <TabButton tab="providers" icon={Users} label="Managers" />
            <TabButton tab="users" icon={UserCheck} label="Users" />
            <TabButton tab="fraud-alerts" icon={AlertTriangle} label="Fraud Alerts" />
            <TabButton tab="security" icon={Lock} label="Security" />
            <TabButton tab="backup" icon={Database} label="Backup" />
            <TabButton tab="performance" icon={Activity} label="Performance" />
            <TabButton tab="settings" icon={Settings} label="Settings" />
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-4 py-8 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="transition-shadow cursor-pointer hover:shadow-lg" onClick={() => setActiveTab('users')}>
                <div className="flex items-center">
                  <Users className="w-8 h-8 mr-3 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Users</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_users || '0'}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="transition-shadow cursor-pointer hover:shadow-lg" onClick={() => setActiveTab('providers')}>
                <div className="flex items-center">
                  <Users className="w-8 h-8 mr-3 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Active Managers</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.active_providers || '0'}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="transition-shadow cursor-pointer hover:shadow-lg" onClick={() => setActiveTab('fraud-alerts')}>
                <div className="flex items-center">
                  <AlertTriangle className="w-8 h-8 mr-3 text-orange-600" />
                  <div>
                    <p className="text-sm text-gray-600">Fraud Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.fraud_alerts || '0'}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="transition-shadow cursor-pointer hover:shadow-lg" onClick={() => setActiveTab('performance')}>
                <div className="flex items-center">
                  <Activity className="w-8 h-8 mr-3 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">System Status</p>
                    <p className="text-lg font-bold text-gray-900">Healthy</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <h3 className="mb-4 text-lg font-semibold">Recent Activity</h3>
                <div className="space-y-2">
                  <p className="text-gray-500">No recent activity</p>
                </div>
              </Card>
              <Card>
                <h3 className="mb-4 text-lg font-semibold">System Health</h3>
                <div className="space-y-2">
                  {stats.health ? (
                    Object.entries(stats.health).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">Loading system health...</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Managers Tab */}
        {activeTab === 'providers' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Management of Managers</h2>
              <Button onClick={showAddProviderModal}>
                <Plus className="inline w-4 h-4 mr-2" />
                Add Manager
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">NAME</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">EMAIL</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">PHONE</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">NATIONAL ID</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">SEX</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">STATUS</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">CREATED</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {providers.length === 0 ? (
                    <tr><td colSpan="9" className="px-6 py-4 text-center text-gray-500">No providers found</td></tr>
                  ) : (
                    providers.map((provider) => (
                      <tr key={provider.id}>
                        <td className="px-6 py-4 text-sm">{provider.id}</td>
                        <td className="px-6 py-4 text-sm">{provider.name}</td>
                        <td className="px-6 py-4 text-sm">{provider.email}</td>
                        <td className="px-6 py-4 text-sm">{provider.phone}</td>
                        <td className="px-6 py-4 text-sm">{provider.national_id}</td>
                        <td className="px-6 py-4 text-sm">{provider.sex}</td>
                        <td className="px-6 py-4 text-sm">{provider.status === '1' ? 'Active' : 'Inactive'}</td>
                        <td className="px-6 py-4 text-sm">{fmtDate(provider.created_at)}</td>
                        <td className="flex gap-2 px-6 py-4 text-sm">
                          <Button className="text-xs" onClick={() => showEditProviderModal(provider)}>Edit</Button>
                          <Button variant="danger" className="text-xs" onClick={() => deleteProvider(provider.id)}>Delete</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">User Management</h2>
              <input
                type="text"
                placeholder="Search by phone or name..."
                className="px-3 py-2 border rounded"
              />
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">National ID</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Sex</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Balance</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-left text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr><td colSpan="8" className="px-6 py-4 text-center text-gray-500">No users found</td></tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.phone}>
                        <td className="px-6 py-4 text-sm">{user.phone}</td>
                        <td className="px-6 py-4 text-sm">{user.name}</td>
                        <td className="px-6 py-4 text-sm">{user.email}</td>
                        <td className="px-6 py-4 text-sm">{user.national_id}</td>
                        <td className="px-6 py-4 text-sm">{user.sex}</td>
                        <td className="px-6 py-4 text-sm">{Number(user.balance).toLocaleString()} RWF</td>
                        <td className="px-6 py-4 text-sm">{user.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="flex gap-2 px-6 py-4 text-sm">
                          <Button className="text-xs" onClick={() => showEditUserModal(user)}>Edit</Button>
                          <Button variant="danger" className="text-xs" onClick={() => deleteUser(user.phone)}>Delete</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Fraud Alerts Tab */}
        {activeTab === 'fraud-alerts' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Fraud Alerts</h2>
              <span className="text-xs text-gray-500">Auto-refreshing every 15 seconds</span>
            </div>
            <div className="space-y-3">
              {fraudAlerts.length === 0 ? (
                <p className="text-gray-500">No fraud alerts</p>
              ) : (
                fraudAlerts.map((alert) => (
                  <div key={alert.id} className="p-4 rounded-lg bg-gray-50">
                    <p className="text-sm">{alert.message}</p>
                    <p className="mt-1 text-xs text-gray-500">{fmtDate(alert.created_at)} | Score: {((alert.fraud_score || 0) * 100).toFixed(1)}%</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-semibold">Security Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Two-Factor Authentication</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <span>PIN Security</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Face Recognition</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5" />
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Access Logs</h3>
                <span className="text-xs text-gray-500">Auto-refreshing every 30 seconds</span>
              </div>
              <div className="space-y-2 overflow-y-auto max-h-72">
                {accessLogs.length === 0 ? (
                  <p className="text-gray-500">No access logs found</p>
                ) : (
                  accessLogs.map((log) => (
                    <div key={log.id} className="p-2 text-xs border-l-4 border-blue-400 rounded bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className={`font-semibold ${log.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.event_type}
                        </span>
                        <span className="text-gray-400">{log.ip_address}</span>
                      </div>
                      <div className="mt-1 text-gray-700">
                        {log.full_name || 'Unknown'} — {log.identifier}
                      </div>
                      {log.detail && <div className="text-gray-500 mt-0.5">{log.detail}</div>}
                      <div className="text-gray-400 mt-0.5">{fmtDate(log.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-semibold">Database Backup</h3>
              <div className="space-y-4">
                <Button variant="success" className="w-full">
                  <Download className="inline w-4 h-4 mr-2" />
                  Create Backup
                </Button>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Restore from Backup</label>
                  <input type="file" accept=".db,.sql" className="w-full px-3 py-2 border rounded" />
                  <Button className="w-full mt-2">Restore</Button>
                </div>
              </div>
            </Card>
            
            <Card>
              <h3 className="mb-4 text-lg font-semibold">Backup History</h3>
              <div className="space-y-2">
                <p className="text-gray-500">No backup history available</p>
              </div>
            </Card>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-semibold">System Performance</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">CPU Usage</span>
                    <span className="text-sm font-medium">-</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-blue-600 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">Memory Usage</span>
                    <span className="text-sm font-medium">-</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-green-600 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <h3 className="mb-4 text-lg font-semibold">Transaction Statistics</h3>
              <div className="space-y-3">
                {stats.txStats ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Transfers Today</span>
                      <span className="font-medium">{stats.txStats.transfers_today ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Transfers (7 days)</span>
                      <span className="font-medium">{stats.txStats.transfers_7d ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fraud Blocked (7 days)</span>
                      <span className="font-medium text-red-600">{stats.txStats.fraud_blocked_7d ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fraud Rate (7 days)</span>
                      <span className="font-medium text-orange-600">{stats.txStats.fraud_rate_7d ?? 0}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Volume (7 days)</span>
                      <span className="font-medium">{Number(stats.txStats.total_volume_7d ?? 0).toLocaleString()} RWF</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Face Verified Transfers</span>
                      <span className="font-medium text-green-600">{stats.txStats.face_verified_transfers ?? 0}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">Loading transaction statistics...</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <Card>
            <h3 className="mb-4 text-lg font-semibold">System Settings</h3>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">System Name</label>
                  <input
                    type="text"
                    value={settings.system_name}
                    onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Max Transfer Amount</label>
                  <input
                    type="number"
                    value={settings.max_transfer}
                    onChange={(e) => setSettings({ ...settings, max_transfer: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Fraud Threshold</label>
                  <input
                    type="number"
                    value={settings.fraud_threshold}
                    onChange={(e) => setSettings({ ...settings, fraud_threshold: e.target.value })}
                    step="0.1"
                    min="0"
                    max="1"
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={settings.session_timeout}
                    onChange={(e) => setSettings({ ...settings, session_timeout: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Max PIN Attempts</label>
                  <input
                    type="number"
                    value={settings.max_pin_attempts}
                    onChange={(e) => setSettings({ ...settings, max_pin_attempts: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <Button onClick={saveSettings} className="w-full">
                  <Save className="inline w-4 h-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>

      {/* Provider Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="p-5 bg-white rounded-lg shadow-lg w-96">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {editingProvider ? 'Edit Provider' : 'Add New Provider'}
            </h3>
            <form onSubmit={saveProvider} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Provider Name</label>
                <input
                  type="text"
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={providerForm.email}
                  onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  value={providerForm.phone}
                  onChange={(e) => setProviderForm({ ...providerForm, phone: e.target.value })}
                  placeholder="2507xxxxxxx"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">National ID</label>
                <input
                  type="text"
                  value={providerForm.national_id}
                  onChange={(e) => setProviderForm({ ...providerForm, national_id: e.target.value })}
                  placeholder="National ID Number"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Sex</label>
                <select
                  value={providerForm.sex}
                  onChange={(e) => setProviderForm({ ...providerForm, sex: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Status</label>
                <select
                  value={providerForm.status}
                  onChange={(e) => setProviderForm({ ...providerForm, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              {!editingProvider && (
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={providerForm.password}
                    onChange={(e) => setProviderForm({ ...providerForm, password: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              )}
              <div className="flex justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowProviderModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">
                  {editingProvider ? 'Update' : 'Add'} Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="p-5 bg-white rounded-lg shadow-lg w-96">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Edit User</h3>
            <form onSubmit={saveUser} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  value={userForm.phone}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-100 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">National ID</label>
                <input
                  type="text"
                  value={userForm.national_id}
                  onChange={(e) => setUserForm({ ...userForm, national_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Sex</label>
                <select
                  value={userForm.sex}
                  onChange={(e) => setUserForm({ ...userForm, sex: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Account Balance</label>
                <input
                  type="number"
                  value={userForm.balance}
                  onChange={(e) => setUserForm({ ...userForm, balance: e.target.value })}
                  step="0.01"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Status</label>
                <select
                  value={userForm.status}
                  onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="flex justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700">
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
