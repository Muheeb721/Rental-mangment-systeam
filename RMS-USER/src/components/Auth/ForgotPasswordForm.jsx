import { useState } from 'react';
import { Form, Input, Button } from 'antd';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { addNotification } from '../../redux/store';
import { createForgotPasswordNotification } from '../../services/notificationService.jsx';
import { sanitizeFullName, fullNameRule } from '../../utils/nameValidation.jsx';

function ForgotPasswordForm() {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (values) => {
    setLoading(true);
    const user = {
      name: sanitizeFullName(values.name) || 'Guest',
      email: values.email?.trim() || 'unknown@example.com',
    };

    dispatch(addNotification(createForgotPasswordNotification(user)));
    form.resetFields();
    setLoading(false);
    toast.success('Password reset request submitted.');
  };

  return (
    <Form form={form} layout="vertical" className="auth-form" onFinish={handleSubmit}>
      <Form.Item label="Name" name="name" rules={[fullNameRule('Name')]} getValueFromEvent={(event) => sanitizeFullName(event.target.value)}>
        <Input placeholder="Ahmed Khan" />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Please enter a valid email' }] }>
        <Input placeholder="you@example.com" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        Send Recovery Link
      </Button>
    </Form>
  );
}

export default ForgotPasswordForm;
