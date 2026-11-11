import React from 'react';
import { Row, Col, Card } from 'antd';
import './home-redesign.css';

export default function HowItWorks(){
  const steps = [
    { title: 'Search Property', desc: 'Find the right property using filters.' },
    { title: 'View Details', desc: 'See photos, specs and owner info.' },
    { title: 'Book or Send Inquiry', desc: 'Schedule visit or rent/purchase.' },
    { title: 'Move In / Purchase', desc: 'Complete payment and move in.' },
  ];

  return (
    <section className="hr-section hr-steps">
      <h3 className="section-title">How It Works</h3>
      <Row gutter={[16,16]}>
        {steps.map((s, idx) => (
          <Col xs={24} sm={12} md={6} key={s.title}>
            <Card className="step-card">
              <div className="step-index">{String(idx+1).padStart(2,'0')}</div>
              <h4>{s.title}</h4>
              <p className="muted">{s.desc}</p>
            </Card>
          </Col>
        ))}
      </Row>
    </section>
  );
}
