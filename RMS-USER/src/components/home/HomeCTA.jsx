import React from 'react';
import { Link } from 'react-router-dom';
import './home-redesign.css';

export default function HomeCTA(){
  return (
    <section className="hr-cta-section">
      <div className="hr-cta-inner">
        <div>
          <h3 className="section-title">Ready to Find Your Next Property?</h3>
          <p className="section-sub">Explore our houses, apartments, flats and rooms today.</p>
        </div>
        <div className="hr-cta-actions">
          <Link to="/properties" className="btn-primary">Browse Properties</Link>
          <Link to="/properties?transaction=Rent" className="btn-secondary">Find a Rental</Link>
        </div>
      </div>
    </section>
  );
}
