import { Card, Switch, Form, Select, Button } from 'antd';
import './SettingsPage.css';

function SettingsPage() {
  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Settings</h2>
        <Card>
          <Form layout="vertical">
            <Form.Item label="Theme Preference"><Select defaultValue="dark"><Select.Option value="light">Light</Select.Option><Select.Option value="dark">Dark</Select.Option></Select></Form.Item>
            <Form.Item label="Email Notifications"><Switch defaultChecked /></Form.Item>
            <Form.Item label="SMS Alerts"><Switch /></Form.Item>
            <Button type="primary">Save Preferences</Button>
          </Form>
        </Card>
      </section>
    </div>
  );
}

export default SettingsPage;
