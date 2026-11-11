import { useState } from 'react';
import { Card, Form, Input, Button, Select } from 'antd';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { login as reduxLogin, addNotification } from '../redux/store';
import { createLoginNotification, createSignupNotification, saveSessionUser } from '../services/notificationService.jsx';
import authService from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { sanitizeFullName, fullNameRule } from '../utils/nameValidation.jsx';
import './RegisterPage.css';

const resolveFallbackRoute = (role) => {
  const normalizedRole = String(role || '').toLowerCase();
  return ['admin', 'owner', 'manager'].includes(normalizedRole) ? '/admin' : '/dashboard';
};

function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { login: authLogin } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      if (String(values.password || '').length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      if (String(values.password || '') !== String(values.confirmPassword || '')) {
        throw new Error('Passwords do not match.');
      }

      const payload = {
        name: sanitizeFullName(values.fullName) || (values.email ? values.email.split('@')[0].replace(/[._-]/g, ' ').trim() : 'RMS User'),
        email: String(values.email || '').trim(),
        phone: String(values.phone || '').trim(),
        password: String(values.password || ''),
        confirmPassword: String(values.confirmPassword || ''),
        role: values.role || 'resident',
        profileData: {
          phone: String(values.phone || '').trim(),
          fullName: sanitizeFullName(values.fullName) || (values.email ? values.email.split('@')[0].replace(/[._-]/g, ' ').trim() : 'RMS User'),
        },
      };

      const response = await authService.signup(payload);
      const success = Boolean(response?.success ?? response?.data?.success ?? response?.data?.result?.success);
      if (!response || !success) {
        throw new Error(response?.message || response?.data?.message || 'Unable to create account.');
      }

      const data = response?.data ?? {};
      const inner = data?.result ?? data;
      const token = inner?.token ?? data?.token ?? response?.token;
      const userData = inner?.user ?? data?.user ?? response?.user ?? {};

      if (!token) {
        throw new Error('Signup succeeded, but no auth token was returned.');
      }

      const now = new Date();
      const user = saveSessionUser({
        id: userData.id || userData._id || undefined,
        name: userData.name || payload.name,
        email: userData.email || payload.email,
        role: userData.role || payload.role,
        isLoggedIn: true,
        loginDate: now.toLocaleDateString('en-PK'),
        loginTime: now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
      });

      await authLogin({ user, token });
      if (typeof window !== 'undefined') {
        window.__RMS_AUTH_TOKEN = token;
        window.__rms_inmemory_token = token;
        window.localStorage.setItem('rms_token', token);
        window.localStorage.setItem('rms_auth_session', JSON.stringify(user));
        window.localStorage.setItem('rms_user_role', user.role || 'resident');
      }

      dispatch(reduxLogin(user));
      dispatch(addNotification(createLoginNotification(user)));
      dispatch(addNotification(createSignupNotification(user)));
      form.resetFields();
      toast.success('You have successfully registered on RMS. Welcome!');

      const params = new URLSearchParams(location.search);
      const redirectParam = params.get('redirect');
      const redirectTo = redirectParam ? decodeURIComponent(redirectParam) : resolveFallbackRoute(user.role);
      const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : resolveFallbackRoute(user.role);

      navigate(safeRedirect, { replace: true });
    } catch (error) {
      console.error('Register error:', error);
      toast.error(error?.message || 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <h2 className="auth-title">Create an account</h2>
        <p className="auth-subtitle">Join RMS to discover Lahore properties and hostels.</p>
        <Form form={form} layout="vertical" className="auth-form" onFinish={handleSubmit}>
          <Form.Item label="Full Name" name="fullName" rules={[fullNameRule('Full Name')]} getValueFromEvent={(event) => sanitizeFullName(event.target.value)}>
            <Input placeholder="Ahmed Khan" />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="you@example.com" />
          </Form.Item>
          <Form.Item label="Role" name="role" initialValue="resident">
            <Select>
              <Select.Option value="resident">Resident</Select.Option>
              <Select.Option value="owner">Owner</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
            <Input.Password placeholder="Enter password" />
          </Form.Item>
          <Form.Item
            label="Confirm Password"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match.'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Create Account
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default RegisterPage;
