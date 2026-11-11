import { Modal, Form, Input, Button } from 'antd';
import { add as addComparison } from '../utils/propertyComparisonsStorage.jsx';

function CompareSaveModal({ open, onClose, propertyIds = [], onSaved }) {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        name: values.name,
        propertyIds: Array.isArray(propertyIds) ? propertyIds : [],
        createdAt: new Date().toISOString(),
      };

      addComparison(payload);
      onSaved && onSaved(payload);
      form.resetFields();
      onClose();
    });
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Save Comparison" centered>
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ name: '' }}>
        <Form.Item name="name" label="Comparison Name" rules={[{ required: true, message: 'Please provide a name for this comparison' }]}>
          <Input />
        </Form.Item>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" htmlType="submit">Save</Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
}

export default CompareSaveModal;
