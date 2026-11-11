import { Modal, Form, Input, Button } from 'antd';
import { add as addSavedSearch } from '../utils/savedSearchesStorage.jsx';

function SavedSearchModal({ open, onClose, filters, onSaved }) {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        name: values.name,
        filters: filters || {},
        createdAt: new Date().toISOString(),
      };
      addSavedSearch(payload);
      onSaved && onSaved(payload);
      form.resetFields();
      onClose();
    });
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Save This Search" centered>
      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ name: '' }}>
        <Form.Item name="name" label="Search Name" rules={[{ required: true, message: 'Please provide a name for this search' }]}>
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

export default SavedSearchModal;
