import { Modal, Form, Input, Button, Tag, Typography } from "antd";
import { CheckCircleOutlined, ShareAltOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import api from "../services/api";
import { recordDashboardSubmission } from "../utils/dashboardSubmissionStorage.jsx";
import { sanitizeFullName, fullNameRule } from "../utils/nameValidation.jsx";

const { Title, Text } = Typography;

function ActionModal({ open, onClose, type, item, onSubmit }) {
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form
      .validateFields()
      .then(async (values) => {
        const submissionPayload = { ...values, item };

        if (type === "contact" && item) {
          try {
            const response = await api.request("/bookings", {
              method: "POST",
              body: {
                userName: values.name,
                userEmail: values.email,
                userPhone: values.phone || "",
                propertyId: item._id || item.id || "",
                propertyName: item.title || item.name || "",
                propertyTitle: item.title || item.name || "",
                propertyType: item.type || item.propertyType || "",
                message: values.message || "",
                flowType: "contact",
              },
            });

            if (!response || !response.success) {
              throw new Error(
                response?.message || "Unable to send viewing request",
              );
            }

            recordDashboardSubmission({
              id: `contact-modal-${Date.now()}`,
              source: "contact",
              formType: "Property Contact Request",
              title: `Viewing request for ${item.title || item.name || "property"}`,
              category: item.type || "Property",
              status: "New",
              userName: values.name || "Guest",
              email: values.email || "",
              phone: values.phone || "",
              propertyType: item.type || "Property",
              location: item.address || item.location || "",
              price: item.price || item.monthlyFee || "",
              description: values.message || "",
              submittedAt: new Date().toISOString(),
            });

            toast.success("Your viewing request has been sent.");
            onSubmit?.({ ...submissionPayload, serverResponse: response });
            form.resetFields();
            onClose();
            return;
          } catch (error) {
            console.error("Action modal contact submission failed", error);
            toast.error(error?.message || "Unable to send viewing request.");
            return;
          }
        }

        onSubmit?.(submissionPayload);
        form.resetFields();
        onClose();
      })
      .catch(() => {});
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        type === "details"
          ? "Listing overview"
          : type === "share"
            ? "Share this listing"
            : "Book a viewing"
      }
      centered
    >
      {type === "details" && item && (
        <div>
          <Title level={4}>{item.title}</Title>
          <Text type="secondary">{item.address}</Text>
          <div style={{ marginTop: 12 }}>
            <Tag color="blue">{item.type}</Tag>
            {item.availability && <Tag color="green">{item.availability}</Tag>}
          </div>
          <div style={{ marginTop: 12 }}>
            <Text strong>{item.price ? "Price:" : "Monthly fee:"}</Text>{" "}
            {item.price || item.monthlyFee}
          </div>
          <div style={{ marginTop: 8 }}>
            {item.owner && (
              <>
                <Text strong>Owner:</Text> {item.owner}
              </>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            {item.contact && (
              <>
                <Text strong>Contact:</Text> {item.contact}
              </>
            )}
          </div>
        </div>
      )}

      {type === "contact" && item && (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Your Name"
            rules={[fullNameRule("Name")]}
            getValueFromEvent={(event) => sanitizeFullName(event.target.value)}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              {
                required: true,
                type: "email",
                message: "Please enter a valid email",
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="message"
            label="Message"
            rules={[
              { required: true, message: "Please mention your interest" },
            ]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<CheckCircleOutlined />}
          >
            Request Viewing
          </Button>
        </Form>
      )}

      {type === "share" && item && (
        <div>
          <Text>
            Share this listing with a colleague, family member, or friend.
          </Text>
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<ShareAltOutlined />}
              onClick={() => {
                navigator.clipboard?.writeText(
                  `${window.location.origin}/properties/${item.id}`,
                );
                toast.success("Share link copied to clipboard");
                onClose();
              }}
            >
              Copy Link
            </Button>
          </div>
        </div>
      )}

      {type === "edit" && (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            title: item?.title || item?.name,
            image: item?.image || "",
            price: item?.price || item?.monthlyFee || item?.rentPrice || "",
            address: item?.address || item?.location || "",
            area: item?.area || "",
            type: item?.type || item?.category || "",
            bedrooms: item?.bedrooms,
            bathrooms: item?.bathrooms,
            seats: item?.seats,
            owner: item?.owner,
            availability: item?.availability || item?.status,
            lat: item?.lat,
            lng: item?.lng,
          }}
          onFinish={handleSubmit}
        >
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="image" label="Image URL">
            <Input />
          </Form.Item>
          <Form.Item name="price" label="Price / Monthly Fee">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input />
          </Form.Item>
          <Form.Item name="area" label="Area">
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Input />
          </Form.Item>
          <Form.Item name="bedrooms" label="Bedrooms">
            <Input />
          </Form.Item>
          <Form.Item name="bathrooms" label="Bathrooms">
            <Input />
          </Form.Item>
          <Form.Item name="seats" label="Seats">
            <Input />
          </Form.Item>
          <Form.Item name="owner" label="Owner">
            <Input />
          </Form.Item>
          <Form.Item name="availability" label="Availability">
            <Input />
          </Form.Item>
          <Form.Item name="lat" label="Latitude">
            <Input />
          </Form.Item>
          <Form.Item name="lng" label="Longitude">
            <Input />
          </Form.Item>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button
              type="primary"
              onClick={handleSubmit}
              icon={<CheckCircleOutlined />}
            >
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}

export default ActionModal;
