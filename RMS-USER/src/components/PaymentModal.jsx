import { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Input } from 'antd';
import api from '../services/api';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';

function PaymentModal({ open, onClose, booking }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      amount: booking?.rent || 0,
      method: 'Bank Transfer',
      type: 'Advance',
      reference: '',
    });
  }, [open, booking]);

  const handleFinish = async (values) => {
    try {
      const amount = Number(values.amount || 0);
      const response = await api.request('/payments', {
        method: 'POST',
        body: {
          bookingId: booking?.bookingId || booking?.id,
          propertyId: booking?.propertyId,
          propertyName: booking?.propertyName,
          propertyType: booking?.propertyType,
          amount,
          paymentType: values.type || 'Advance',
          method: values.method || 'Bank Transfer',
          reference: values.reference || '',
          status: 'Approved',
          userName: booking?.userName,
          userEmail: booking?.userEmail,
          userPhone: booking?.userPhone,
        },
      });

      if (response && response.success) {
        try {
          const note = createNotification({
            type: 'payment',
            title: 'Payment Recorded',
            message: `Payment of Rs ${amount} recorded for ${booking?.propertyName}`,
            userName: booking?.userName,
            email: booking?.userEmail,
          });
          addStoredNotification(note);
        } catch (e) {}
      }

      if (onClose) onClose(true);
    } catch (e) {
      console.error('Payment failed', e);
      if (onClose) onClose(false);
    }
  };

  return (
    <Modal open={open} title={`Pay for ${booking?.propertyName || 'Booking'}`} onCancel={() => onClose && onClose(false)} okText="Pay" onOk={() => form.submit()}>
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item label="Payment Type" name="type">
          <Select>
            <Select.Option value="Advance">Advance</Select.Option>
            <Select.Option value="Partial">Partial</Select.Option>
            <Select.Option value="Final">Final</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Amount" name="amount" rules={[{ required: true, message: 'Enter an amount' }]}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>

        <Form.Item label="Payment Method" name="method">
          <Select>
            <Select.Option value="Bank Transfer">Bank Transfer</Select.Option>
            <Select.Option value="Mobile Wallet">Mobile Wallet</Select.Option>
            <Select.Option value="Cash">Cash</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Reference / Transaction ID" name="reference">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default PaymentModal;
