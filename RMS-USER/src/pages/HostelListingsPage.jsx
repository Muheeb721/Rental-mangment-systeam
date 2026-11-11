import { useState } from "react";
import {
  Row,
  Col,
  Card,
  Tag,
  Button,
  Rate,
  Statistic,
  Divider,
  Typography,
} from "antd";
import {
  WifiOutlined,
  SafetyOutlined,
  ProjectOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { hostelData } from "../data/dummyData";
import { getPrimaryImage, FALLBACK_IMAGE } from '../utils/imageUtils';
import ActionModal from "../components/ActionModal";
import FavoriteToggle from "../components/FavoriteToggle";
import { toast } from "react-toastify";
import "./HostelListingsPage.css";

const { Paragraph } = Typography;

function HostelListingsPage() {
  const [selectedHostel, setSelectedHostel] = useState(null);
  const [modalType, setModalType] = useState("details");
  const [hostels, setHostels] = useState(hostelData);

  const handleAction = (type, item) => {
    setSelectedHostel(item);
    setModalType(type);
  };

  const handleModalSubmit = (payload) => {
    if (!payload) return;
    const { item, ...updates } = payload;
    if (modalType === 'edit' && item) {
      setHostels((prev) => prev.map((h) => (h.id === item.id ? { ...h, ...updates } : h)));
      return;
    }

    toast.success('Thanks! We will contact you shortly');
  };

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Hostel Listings</h2>
        <Paragraph className="section-subtitle">
          Comfortable, secure, and amenity-rich hostel options for students and
          professionals across Lahore.
        </Paragraph>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Occupancy" value="92%" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Verified Facilities" value="24/7" />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Reviews" value="284" />
            </Card>
          </Col>
        </Row>
        <Divider />
        <Row gutter={[16, 16]}>
          {hostels.map((hostel, index) => (
            <Col xs={24} md={12} lg={8} key={hostel.id}>
              <Card
                className="hostel-card"
                cover={<img alt={hostel.title} src={getPrimaryImage(hostel, index, 'demo') || FALLBACK_IMAGE} style={{ width: '100%', height: 200, objectFit: 'cover' }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }} />}
              >
                <div className="card-body">
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <Tag color="purple">{hostel.type}</Tag>
                    <span style={{ fontWeight: 700 }}>{hostel.monthlyFee}</span>
                  </div>
                  <div className="card-title">{hostel.title}</div>
                  <div style={{ color: "#64809b" }}>{hostel.address}</div>
                  <div className="meta-row">
                    <span className="meta-pill">{hostel.seats} seats</span>
                    <span className="meta-pill">Deposit {hostel.deposit}</span>
                    <span className="meta-pill">{hostel.security}</span>
                  </div>
                  <div className="meta-row" style={{ marginTop: 8 }}>
                    <span className="meta-pill">
                      <WifiOutlined /> Wi-Fi
                    </span>
                    <span className="meta-pill">
                      <SafetyOutlined /> Secure
                    </span>
                    <span className="meta-pill">
                      <ProjectOutlined /> Mess
                    </span>
                  </div>
                  <Rate
                    disabled
                    defaultValue={hostel.rating}
                    style={{ marginTop: 8 }}
                  />
                  <div className="card-actions">
                    <Button
                      type="primary"
                      onClick={() => handleAction("contact", hostel)}
                    >
                      Contact Owner
                    </Button>
                    <Button onClick={() => handleAction("details", hostel)}>
                      View
                    </Button>
                    <FavoriteToggle item={hostel} label="Save" />
                    <Button onClick={() => handleAction("share", hostel)}>
                      Share
                    </Button>
                    <Button onClick={() => handleAction('edit', hostel)}>Edit</Button>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </section>
      <ActionModal
        open={Boolean(selectedHostel)}
        onClose={() => setSelectedHostel(null)}
        type={modalType}
        item={selectedHostel}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}

export default HostelListingsPage;
