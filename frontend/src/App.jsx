import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ProviderDashboard from './components/ProviderDashboard';
import UserDashboard from './components/UserDashboard';
import ResetPassword from './components/ResetPassword';
import AbroadVerify from './components/AbroadVerify';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin_dashboard" element={<AdminDashboard />} />
        <Route path="/provider_dashboard" element={<ProviderDashboard />} />
        <Route path="/user_dashboard" element={<UserDashboard />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-abroad" element={<AbroadVerify />} />
      </Routes>
    </Router>
  );
}

export default App;
