import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Spin, Typography } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { toast } from 'react-toastify';

const { Title, Text } = Typography;

function TenantProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useSelector((state) => state.auth?.user || {});
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [savedImages, setSavedImages] = useState({ profileImage: '', cnicImage: '' });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [cnicImageFile, setCnicImageFile] = useState(null);
  const [error, setError] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');
  const [cnicImagePreview, setCnicImagePreview] = useState('');

  const returnTo = useMemo(() => {
    const route = searchParams.get('returnTo');
    if (!route) {
      const selectedId = searchParams.get('propertyId');
      return selectedId
        ? `/rental-application?propertyId=${encodeURIComponent(selectedId)}`
        : '/my-rent';
    }
    return route.startsWith('/') && !route.startsWith('//') ? route : '/my-rent';
  }, [searchParams]);

  const propertyId = searchParams.get('propertyId') || '';
  const propertyTitle = searchParams.get('propertyTitle') || '';
  const propertyType = searchParams.get('propertyType') || '';

  useEffect(() => () => {
    if (profileImagePreview.startsWith('blob:')) URL.revokeObjectURL(profileImagePreview);
    if (cnicImagePreview.startsWith('blob:')) URL.revokeObjectURL(cnicImagePreview);
  }, [profileImagePreview, cnicImagePreview]);

  useEffect(() => {
    if (!user?.email && !user?.id) {
      const target = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      navigate(`/login?redirect=${target}`, { replace: true });
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      let rentalProfile = null;
      try {
        const response = await api.request('/tenant-profiles/me');
        if (response?.success && response.data) {
          rentalProfile = response.data;
          setProfile(rentalProfile);
          form.setFieldsValue({
            fullName: rentalProfile.fullName || user.name || '',
            email: rentalProfile.email || user.email || '',
            phone: rentalProfile.phone || user.phone || '',
            address: rentalProfile.currentAddress || rentalProfile.address || '',
            city: rentalProfile.city || '',
            occupation: rentalProfile.occupation || '',
            emergencyContact: rentalProfile.emergencyContactName || '',
            emergencyContactNumber: rentalProfile.emergencyContactPhone || '',
          });
        }
      } catch (err) {
        // no existing profile yet; keep empty form
      } finally {
        try {
          const userResponse = await api.request('/users/profile');
          const userProfile = userResponse?.data?.profile || {};
          const profileImage = rentalProfile?.profileImage || rentalProfile?.image || userProfile.profileImage || userResponse?.data?.profileImage || '';
          const cnicImage = rentalProfile?.cnicImage || rentalProfile?.idCardImage || userProfile.cnicImage || '';
          setSavedImages({ profileImage, cnicImage });
          setProfileImagePreview(profileImage);
          setCnicImagePreview(cnicImage);
        } catch (imageError) {
          console.warn('Unable to load existing rental profile images', imageError);
          const profileImage = rentalProfile?.profileImage || rentalProfile?.image || '';
          const cnicImage = rentalProfile?.cnicImage || rentalProfile?.idCardImage || '';
          setSavedImages({ profileImage, cnicImage });
          setProfileImagePreview(profileImage);
          setCnicImagePreview(cnicImage);
        }
        setLoading(false);
      }
    })();
  }, [form, navigate, user]);

  const handleSubmit = async (values) => {
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('fullName', values.fullName?.trim() || '');
      formData.append('email', (values.email || user.email || '').trim());
      formData.append('phone', values.phone?.trim() || '');
      formData.append('currentAddress', values.address?.trim() || '');
      formData.append('city', values.city?.trim() || '');
      formData.append('occupation', values.occupation?.trim() || '');
      formData.append('emergencyContactName', values.emergencyContact?.trim() || '');
      formData.append('emergencyContactPhone', values.emergencyContactNumber?.trim() || '');
      formData.append('profileImage', savedImages.profileImage);
      formData.append('cnicImage', savedImages.cnicImage);

      if (profileImageFile instanceof File) {
        formData.append('profileImage', profileImageFile);
      }
      if (cnicImageFile instanceof File) {
        formData.append('cnicImage', cnicImageFile);
      }

      const response = await api.request('/users/profile', {
        method: 'PUT',
        data: formData,
      });

      if (!response || !response.success) {
        throw new Error(response?.message || 'Unable to upload rental profile images.');
      }

      const userProfile = response.data?.profile || {};
      const profileImage = userProfile.profileImage || response.data?.profileImage || savedImages.profileImage;
      const cnicImage = userProfile.cnicImage || savedImages.cnicImage;
      setSavedImages({ profileImage, cnicImage });
      setProfileImagePreview(profileImage);
      setCnicImagePreview(cnicImage);
      setProfileImageFile(null);
      setCnicImageFile(null);

      const rentalProfileResponse = await api.request('/tenant-profiles', {
        method: 'POST',
        body: {
          fullName: values.fullName?.trim() || '',
          email: (values.email || user.email || '').trim(),
          phone: values.phone?.trim() || '',
          profileImage,
          cnicImage,
          currentAddress: values.address?.trim() || '',
          city: values.city?.trim() || '',
          occupation: values.occupation?.trim() || '',
          emergencyContactName: values.emergencyContact?.trim() || '',
          emergencyContactPhone: values.emergencyContactNumber?.trim() || '',
          propertyId: propertyId || profile?.propertyId || '',
          propertyName: propertyTitle || profile?.propertyName || '',
          propertyType: propertyType || profile?.propertyType || '',
          status: profile?.status || 'Pending',
        },
      });

      if (!rentalProfileResponse?.success || !rentalProfileResponse.data) {
        throw new Error(rentalProfileResponse?.message || 'Unable to save rental profile.');
      }

      setProfile(rentalProfileResponse.data);
      toast.success(profile ? 'Rental profile updated.' : 'Rental profile created successfully.');
      navigate(returnTo, { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Unable to save rental profile.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Form form={form} style={{ display: 'none' }} />
        <Spin size="large" description="Loading rental profile..." />
      </div>
    );
  }

  return (
    <div className="page-shell" style={{ maxWidth: 1000, margin: '32px auto', padding: '0 16px' }}>
      <Card>
        <Title level={3}>{profile ? 'Update Rental Profile' : 'Create Rental Profile'}</Title>
        <Text type="secondary">
          {propertyTitle
            ? `Complete your profile to continue with ${propertyTitle}.`
            : 'Complete your tenant profile to continue with your rental application.'}
        </Text>

        {error && <Alert type="error" message={error} showIcon style={{ marginTop: 16 }} />}

        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
          onFinish={handleSubmit}
          initialValues={{
            fullName: user.name || '',
            email: user.email || '',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Full name is required.' }]}>
                <Input placeholder="Enter your full name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email is required.' }]}>
                <Input placeholder="Enter your email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Phone Number" rules={[{ required: true, message: 'Phone number is required.' }]}>
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="city" label="City" rules={[{ required: true, message: 'City is required.' }]}>
                <Input placeholder="Enter city" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Profile Photo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setProfileImageFile(file);
                    setProfileImagePreview(file ? URL.createObjectURL(file) : savedImages.profileImage);
                  }}
                />
              </Form.Item>
              {profileImagePreview && (
                <img src={profileImagePreview} alt="Profile preview" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />
              )}
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="CNIC/ID Photo">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setCnicImageFile(file);
                    setCnicImagePreview(file ? URL.createObjectURL(file) : savedImages.cnicImage);
                  }}
                />
              </Form.Item>
              {cnicImagePreview && (
                <img src={cnicImagePreview} alt="CNIC preview" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }} />
              )}
            </Col>
          </Row>

          <Form.Item name="address" label="Address" rules={[{ required: true, message: 'Address is required.' }]}>
            <Input placeholder="Enter your current address" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="occupation" label="Occupation" rules={[{ required: true, message: 'Occupation is required.' }]}>
                <Input placeholder="Enter occupation" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="emergencyContact" label="Emergency Contact" rules={[{ required: true, message: 'Emergency contact is required.' }]}>
                <Input placeholder="Emergency contact name" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="emergencyContactNumber" label="Emergency Contact Number" rules={[{ required: true, message: 'Emergency contact number is required.' }]}>
            <Input placeholder="Emergency contact number" />
          </Form.Item>

          {propertyId && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`Property context: ${propertyTitle || propertyId}${propertyType ? ` (${propertyType})` : ''}`}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => navigate(returnTo, { replace: true })}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>
              {profile ? 'Update Profile' : 'Create Profile'}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default TenantProfilePage;
