import { Modal, Form, Input, DatePicker, TimePicker, Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { add as addVisit } from '../utils/propertyVisitsStorage.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import { createNotification } from '../services/notificationService.jsx';

function VisitModal({ open, onClose, property, onSubmitted }) {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then(async (values) => {
      const date = values.date ? values.date.toISOString() : null;
      const time = values.time ? values.time.format('HH:mm') : null;
      const payload = {
        name: values.name,
        phone: values.phone,
        email: values.email,
        propertyId: property?.id,
        propertyTitle: property?.title,
        date,
        time,
        message: values.message,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };

      try {
        const result = await addVisit(payload);
        if (!result) {
          throw new Error('Unable to schedule visit');
        }

        try {
          const note = createNotification({ type: 'contact', title: 'Visit Scheduled', message: `${payload.name} scheduled a visit for ${payload.propertyTitle} on ${date || 'N/A'} ${time || ''}` });
          addStoredNotification(note);
        } catch (e) {
          console.error('notify visit', e);
        }

        toast.success('Visit request submitted.');
        form.resetFields();
        onClose();
        onSubmitted && onSubmitted(result);
      } catch (error) {
        console.error('Visit submission failed', error);
      }
    }).catch(() => {});
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={`Schedule a Visit`} centered>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="Full Name" rules={[{ required: true }]}> 
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Phone" rules={[{ required: true }]}> 
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email"> 
          <Input />
        </Form.Item>
        <Form.Item name="date" label="Preferred Date"> 
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="time" label="Preferred Time"> 
          <TimePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="message" label="Message"> 
          <Input.TextArea rows={3} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>Request Visit</Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
}

export default VisitModal;
