import { useState } from "react";
import { Card, Row, Col, Descriptions, Button, Tag } from "antd";
import { useParams } from "react-router-dom";
import { hostelData } from "../data/dummyData";
import "./HostelDetailsPage.css";
import ActionModal from "../components/ActionModal";
import { getPrimaryImage, FALLBACK_IMAGE } from '../utils/imageUtils';
import { toast } from "react-toastify";

const hostelBanner = (hostel) => getPrimaryImage(hostel, Number(hostel?.id || 0), 'demo') || FALLBACK_IMAGE;

function HostelDetailsPage() {
  const { id } = useParams();
  const hostel = hostelData.find((item) => item.id === Number(id));
  const [contactOpen, setContactOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!hostel) return <div className="page-shell">Hostel not found.</div>;

  return (
    <div className="page-shell">
      <section className="section-card">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={14}>
              <Card
              cover={
                <img
                  alt={hostel.title}
                  src={hostelBanner(hostel)}
                  style={{ width: '100%', height: 360, objectFit: "cover", borderRadius: 8 }}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = FALLBACK_IMAGE; }}
                />
              }
            >
              <h2 className="section-title">{hostel.title}</h2>
              <p style={{ color: "#64809b" }}>{hostel.address}</p>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card>
              <Tag color="purple">{hostel.type}</Tag>
              <Descriptions column={1} style={{ marginTop: 12 }}>
                <Descriptions.Item label="Monthly Fee">
                  {hostel.monthlyFee}
                </Descriptions.Item>
                <Descriptions.Item label="Security Deposit">
                  {hostel.deposit}
                </Descriptions.Item>
                <Descriptions.Item label="Available Seats">
                  {hostel.seats}
                </Descriptions.Item>
                <Descriptions.Item label="Parking">
                  {hostel.parking ? "Available" : "Not Available"}
                </Descriptions.Item>
                <Descriptions.Item label="Wi-Fi">
                  {hostel.wifi ? "Available" : "Not Available"}
                </Descriptions.Item>
                <Descriptions.Item label="Laundry">
                  {hostel.laundry ? "Included" : "Not Included"}
                </Descriptions.Item>
                <Descriptions.Item label="Mess">
                  {hostel.mess ? "Included" : "Not Included"}
                </Descriptions.Item>
                <Descriptions.Item label="Security">
                  {hostel.security}
                </Descriptions.Item>
              </Descriptions>
              <div className="card-actions">
                <Button type="primary" onClick={() => setContactOpen(true)}>
                  Contact Owner
                </Button>
                <Button
                  onClick={() => {
                    setIsSaved((saved) => !saved);
                    toast.success(
                      isSaved
                        ? "Hostel removed from saved items."
                        : "Hostel saved successfully.",
                    );
                  }}
                >
                  {isSaved ? "Saved" : "Save Hostel"}
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </section>
      <ActionModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        type="contact"
        item={hostel}
        onSubmit={() => toast.success("Your viewing request has been sent.")}
      />
    </div>
  );
}

export default HostelDetailsPage;
