import { useState } from 'react';
import { Form, Input, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import authService from '../../services/authService';

function LoginForm() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const result = await authService.login(values.email, values.password);
      const success = Boolean(result?.success ?? result?.data?.success ?? result?.data?.result?.success);
      if (!success || !result?.token && !result?.data?.token && !result?.data?.result?.token) {
        throw new Error(result?.message || result?.data?.message || 'Login failed');
      }

      const token = result?.token ?? result?.data?.token ?? result?.data?.result?.token;
      const user = result?.user ?? result?.data?.user ?? result?.data?.result?.user;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rms_token', token);
        window.localStorage.setItem('rms_auth_session', JSON.stringify(user));
      }

      form.resetFields();
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Unable to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" className="auth-form" onFinish={handleSubmit}>
      <Form.Item
        label="Email or Username"
        name="email"
        rules={[
          { required: true, message: 'Please enter your email or username' },
          {
            validator: (_, value) => {
              const cleaned = String(value || '').trim();
              if (!cleaned) {
                return Promise.reject(new Error('Please enter your email or username'));
              }
              return Promise.resolve();
            },
          },
        ]}
      >
        <Input placeholder="you@example.com or username" />
      </Form.Item>
      <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
        <Input.Password placeholder="Enter password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        Login
      </Button>
    </Form>
  );
}

export default LoginForm;
