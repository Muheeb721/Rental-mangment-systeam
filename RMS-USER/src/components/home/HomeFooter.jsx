import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './home-redesign.css';

const defaultSiteContent = {
  brandName: 'RMS',
  footerDescription: 'Premium residential management for properties, residents, payments, and maintenance.',
};

export default function HomeFooter(){
  const [siteContent, setSiteContent] = useState(defaultSiteContent);

  useEffect(() => {
    let active = true;
    fetch('/api/site-content')
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result?.success || !result?.data) return;
        setSiteContent((prev) => ({ ...prev, ...result.data }));
      })
      .catch(() => {
        // keep default footer values
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="hr-footer">
      <div className="hr-footer-inner">
        <div className="hr-brand">{siteContent.brandName || defaultSiteContent.brandName}</div>
        <div className="hr-links">
          <div>
            <h5>Quick Links</h5>
            <Link to="/properties">Properties</Link>
            <Link to="/properties?transaction=Sale">For Sale</Link>
            <Link to="/properties?transaction=Rent">For Rent</Link>
          </div>
          <div>
            <h5>Company</h5>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/faq">FAQ</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
