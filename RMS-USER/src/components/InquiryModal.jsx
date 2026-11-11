import { Modal, Form, Input, Select, Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { add as addInquiry } from '../utils/propertyInquiriesStorage.jsx';
import { createContactNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';
import api from '../services/api.js';

function InquiryModal({ open, onClose, property, onSubmitted }) {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then(async (values) => {
      const payload = {
        fullName: values.name,
        phone: values.phone,
        email: values.email,
        propertyId: property?.id,
        propertyName: property?.title,
        propertyType: property?.type || 'Property',
        preferredContactMethod: values.preferredContactMethod,
        message: values.message,
        inquiryType: 'Property Inquiry',
      };

      try {
        const response = await api.request('/contact', {
          method: 'POST',
          body: payload,
        });

        if (!response || !response.success) {
          throw new Error(response?.message || 'Unable to send inquiry');
        }

        addInquiry({
          ...payload,
          name: values.name,
          propertyTitle: property?.title,
          status: 'New',
          createdAt: new Date().toISOString(),
        });

        try {
          const note = createContactNotification({ fullName: payload.fullName, inquiryType: payload.inquiryType, property: payload.propertyName, message: payload.message, email: payload.email });
          addStoredNotification(note);
        } catch (e) {
          console.error('notify inquiry', e);
        }

        toast.success('Inquiry submitted.');
        form.resetFields();
        onClose();
        onSubmitted && onSubmitted(response.data || payload);
      } catch (error) {
        console.error('Inquiry API submission failed', error);
        form.setFieldValue('message', values.message);
        throw error;
      }
    }).catch(() => {});
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={`Contact About This Property`} centered>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="Full Name" rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Phone" rules={[{ required: true }]}> 
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}> 
          <Input />
        </Form.Item>
        <Form.Item name="preferredContactMethod" label="Preferred Contact Method" initialValue="Email">
          <Select>
            <Select.Option value="Email">Email</Select.Option>
            <Select.Option value="Phone">Phone</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="message" label="Message" rules={[{ required: true }]}> 
          <Input.TextArea rows={4} />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" htmlType="submit" icon={<CheckCircleOutlined />}>Send Inquiry</Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
}

export default InquiryModal;
