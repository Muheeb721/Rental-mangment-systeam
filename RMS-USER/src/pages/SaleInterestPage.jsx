import { useEffect, useState } from 'react';
import { Alert, Button, Card, DatePicker, Form, Input, Spin, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import propertyService from '../services/propertyService';
import { createSaleInterest } from '../services/saleInterestService';

const { Title, Text } = Typography;

function SaleInterestPage() {
  const [form] = Form.useForm();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/sale-interest?propertyId=${params.get('propertyId') || ''}`)}`, { replace: true });
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const response = await propertyService.getPropertyById(params.get('propertyId'));
        if (!response?.success || !response.data) throw new Error(response?.message || 'Property not found.');
        if (mounted) {
          setProperty(response.data);
          form.setFieldsValue({
            fullName: user?.name || '',
            email: user?.email || '',
          });
        }
      } catch (error) {
        toast.error(error.message || 'Unable to load property.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [form, isAuthenticated, navigate, params, user]);

  const handleFinish = async (values) => {
    try {
      setSubmitting(true);
      const response = await createSaleInterest({
        propertyId: params.get('propertyId'),
        fullName: values.fullName,
        email: values.email,
        idCardNumber: values.idCardNumber,
        phone: values.phone,
        preferredMoveInDate: values.preferredMoveInDate.toISOString(),
      });
      if (!response?.success) throw new Error(response?.message || 'Unable to submit buying interest.');
      toast.success('Your buying interest was submitted successfully.');
      navigate(`/properties/${property?._id || property?.id}`, { replace: true });
    } catch (error) {
      toast.error(error.message || 'Unable to submit buying interest.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-shell" style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  if (!property) return <div className="page-shell"><Alert type="error" message="Property not found." /></div>;

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto' }}>
      <Card>
        <Title level={2}>Register Buying Interest</Title>
        <Text>Submit your interest in {property.title || 'this property'} and our team will contact you.</Text>
        <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 24 }}>
          <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Please enter your full name.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Gmail/Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="idCardNumber" label="ID Card Number" rules={[{ required: true, message: 'Please enter your ID card number.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true, message: 'Please enter your phone number.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="preferredMoveInDate" label="Preferred Move-in Date" rules={[{ required: true, message: 'Please select a preferred date.' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>Submit Buying Interest</Button>
        </Form>
      </Card>
    </div>
  );
}

export default SaleInterestPage;
