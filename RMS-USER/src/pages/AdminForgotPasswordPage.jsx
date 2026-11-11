import { useState } from 'react';
import { Alert, Button, Card, Form, Input } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('admin@rms.com');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const request = async (route, data) => {
    const result = await api.request(route, { method: 'POST', data });
    if (!result?.success) throw new Error(result?.message || 'Unable to complete password reset.');
    return result;
  };

  const submit = async (values) => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (step === 'email') {
        const response = await request('/auth/admin/forgot-password', { email: values.email });
        setEmail(values.email);
        setMessage(response.message);
        setStep('otp');
      } else if (step === 'otp') {
        const response = await request('/auth/admin/verify-otp', { email, otp: values.otp });
        setResetToken(response.resetToken);
        setStep('password');
      } else {
        const response = await request('/auth/admin/reset-password', {
          email,
          resetToken,
          password: values.password,
          confirmPassword: values.confirmPassword,
        });
        navigate('/admin/login', { replace: true, state: { passwordResetMessage: response.message } });
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || 'Unable to complete password reset.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await request('/auth/admin/forgot-password', { email });
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || 'Unable to send another code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #123a70 100%)', padding: 24 }}>
      <Card title={step === 'email' ? 'Admin password recovery' : step === 'otp' ? 'Verify admin email' : 'Set a new password'} style={{ width: '100%', maxWidth: 460 }}>
        <p>{step === 'email' ? 'A six-digit code will be sent to the configured admin email.' : step === 'otp' ? `Enter the verification code sent to ${email}. It expires in 10 minutes.` : 'Your new password must contain at least 6 characters.'}</p>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        {message && <Alert type="success" showIcon title={message} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={submit}>
          {step === 'email' && (
            <Form.Item label="Admin email" name="email" initialValue={email} rules={[{ required: true }, { type: 'email', message: 'Enter a valid email.' }]}>
              <Input size="large" autoComplete="email" />
            </Form.Item>
          )}
          {step === 'otp' && (
            <Form.Item label="Six-digit OTP" name="otp" rules={[{ required: true }, { pattern: /^\d{6}$/, message: 'Enter the six-digit code.' }]}>
              <Input size="large" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
            </Form.Item>
          )}
          {step === 'password' && (
            <>
              <Form.Item label="New password" name="password" rules={[{ required: true }, { min: 6, message: 'Password must be at least 6 characters.' }]}>
                <Input.Password size="large" autoComplete="new-password" />
              </Form.Item>
              <Form.Item label="Confirm password" name="confirmPassword" dependencies={['password']} rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return !value || getFieldValue('password') === value
                      ? Promise.resolve()
                      : Promise.reject(new Error('Passwords do not match.'));
                  },
                }),
              ]}>
                <Input.Password size="large" autoComplete="new-password" />
              </Form.Item>
            </>
          )}
          <Button type="primary" htmlType="submit" loading={loading} size="large" block>
            {step === 'email' ? 'Send OTP' : step === 'otp' ? 'Verify OTP' : 'Reset password'}
          </Button>
        </Form>
        {step === 'otp' && <Button type="link" onClick={resend} loading={loading} style={{ paddingLeft: 0 }}>Resend OTP</Button>}
        <div style={{ marginTop: 12 }}><Link to="/admin/login">Back to admin login</Link></div>
      </Card>
    </div>
  );
}

export default AdminForgotPasswordPage;
