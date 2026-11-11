import { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, InputNumber } from 'antd';
import { readSessionUser } from '../services/notificationService.jsx';
import bookingService from '../services/bookingService';
import { createPayment } from '../services/paymentsService.jsx';
import { createNotification } from '../services/notificationService.jsx';
import { addStoredNotification } from '../utils/notificationsStorage.jsx';

function RentalBookingModal({ open, onClose, property }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    const user = readSessionUser();
    form.resetFields();
    form.setFieldsValue({
      fullName: user?.name || '',
      email: user?.email || '',
      phone: '',
      property: property?.title || '',
      propertyId: property?.id || '',
      propertyType: property?.type || '',
      rent: property?.rentPrice || property?.price || '',
      rentFrequency: property?.rentFrequency || 'Monthly',
      moveInDate: null,
      rentalDuration: '1 month',
      occupants: 1,
      message: '',
    });
  }, [open, property]);

  const handleFinish = async (values) => {
    try {
      const user = readSessionUser();
      const booking = {
        userId: user?.email || null,
        userName: values.fullName,
        userEmail: values.email,
        userPhone: values.phone,
        propertyId: property?.id || values.propertyId,
        propertyName: property?.title || values.property,
        propertyType: property?.type || values.propertyType,
        rent: Number(values.rent || 0),
        rentFrequency: values.rentFrequency,
        moveInDate: values.moveInDate ? values.moveInDate.toISOString() : null,
        rentalDuration: values.rentalDuration,
        occupants: values.occupants,
        message: values.message,
        paymentStatus: 'Pending',
        bookingStatus: 'Pending',
        bookingDate: new Date().toISOString(),
      };

      try {
        const res = await bookingService.createBooking(booking);
        if (res && res.success && res.data) {
          try {
            const created = res.data;
            const note = createNotification({
              type: 'booking',
              title: 'New Rental Booking',
              message: `Booking for ${created.propertyName || booking.propertyName} by ${created.userName || booking.userName}`,
              userName: created.userName || booking.userName,
              email: created.userEmail || booking.userEmail,
            });
            addStoredNotification(note);
          } catch (e) {
            console.warn('Unable to store booking notification', e);
          }

          // Create an initial payment record if there is a rent/amount defined
          try {
            const total = Number(booking.rent || booking.amount || 0);
            const advance = Number(booking.advance || 0);
            if (total > 0 || advance > 0) {
              createPayment({
                bookingId: res.data.id || (res.data.bookingId || undefined),
                userName: res.data.userName || booking.userName,
                userEmail: res.data.userEmail || booking.userEmail,
                userPhone: res.data.userPhone || booking.userPhone,
                propertyName: res.data.propertyName || booking.propertyName || property?.title,
                propertyId: res.data.propertyId || booking.propertyId || property?.id,
                propertyType: res.data.propertyType || booking.propertyType || property?.type,
                totalAmount: total,
                advanceAmount: advance,
                amountPaid: 0,
                method: 'Pending',
                notes: 'Auto-created from booking',
              });
            }
          } catch (e) {
            console.warn('Unable to create initial payment record', e);
          }
        }
      } catch (e) {
        console.error('Unable to create booking via API', e);
      }

      form.resetFields();
      if (onClose) onClose();
    } catch (e) {
      console.error('Unable to save booking', e);
    }
  };

  return (
    <Modal open={open} title={`Book ${property?.title || 'Property'}`} onCancel={onClose} okText="Submit" onOk={() => form.submit()}>
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item label="Name" name="fullName" rules={[{ required: true, message: 'Please enter your name' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Contact Number" name="phone" rules={[{ required: true, message: 'Please enter contact number' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="House / Property Name" name="property">
          <Input disabled />
        </Form.Item>

        <Form.Item label="Price" name="rent" rules={[{ required: true, message: 'Enter the price' }]}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default RentalBookingModal;
