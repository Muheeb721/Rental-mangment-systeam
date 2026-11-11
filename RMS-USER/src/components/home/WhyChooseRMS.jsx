import React, { useEffect, useRef, useState } from 'react';
import { Row, Col, Card } from 'antd';
import './home-redesign.css';

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function formatCounterValue(value, end, suffix) {
  const safeValue = Number.isFinite(value) ? value : 0;

  if (end >= 1000 && safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(1).replace(/\.0$/, '')}k${suffix}`;
  }

  return `${Math.round(safeValue)}${suffix}`;
}

function CountUp({ end, suffix = '', duration = 2000, start = false }) {
  const [value, setValue] = useState(1);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!start) {
      setValue(1);
      return undefined;
    }

    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setValue(end);
      return undefined;
    }

    const startTime = performance.now();

    const tick = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const nextValue = 1 + (end - 1) * easedProgress;

      setValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [start, end, duration]);

  return <span className="why-metric-number">{formatCounterValue(value, end, suffix)}</span>;
}

export default function WhyChooseRMS() {
  const [startAnimation, setStartAnimation] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setStartAnimation(true);
      return undefined;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setStartAnimation(true);
      return undefined;
    }

    const section = document.querySelector('.hr-why');
    if (!section) {
      setStartAnimation(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStartAnimation(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  const stats = [
    { title: 'Properties Listed', end: 2400, suffix: '+' },
    { title: 'Happy Residents', end: 1800, suffix: '+' },
    { title: 'Verified Owners', end: 640, suffix: '+' },
    { title: 'Avg. Response Time', end: 8, suffix: ' min' },
  ];

  return (
    <section className="hr-section hr-why">
      <div className="section-header">
        <div>
          <h3 className="section-title">Why Choose RMS</h3>
          <p className="section-sub">A premium experience for residents, owners, and administrators.</p>
        </div>
      </div>
      <Row gutter={[16, 16]}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} md={6} key={stat.title}>
            <Card className="why-card why-metric-card">
              <div className="why-metric-value">
                <CountUp end={stat.end} suffix={stat.suffix} duration={2000} start={startAnimation} />
              </div>
              <div className="why-metric-label">{stat.title}</div>
            </Card>
          </Col>
        ))}
      </Row>
    </section>
  );
}
