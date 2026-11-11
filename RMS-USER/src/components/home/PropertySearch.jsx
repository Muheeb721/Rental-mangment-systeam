import React, { useState } from 'react';
import { Select, Input, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import './home-redesign.css';

const LOCATION_OPTIONS = ['DHA Phase 5', 'DHA Phase 6', 'DHA Phase 8', 'DHA Phase 9', 'Askari'];
const BUDGET_OPTIONS = ['Under PKR 3M', 'PKR 3M - 5M', 'PKR 5M - 8M', 'PKR 8M - 12M', 'PKR 12M+'];

export default function PropertySearch() {
  const [transaction, setTransaction] = useState('All');
  const [type, setType] = useState('All');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const navigate = useNavigate();

  const doSearch = () => {
    const params = new URLSearchParams();
    if (transaction && transaction !== 'All') params.set('transaction', transaction);
    if (type && type !== 'All') params.set('type', type);
    if (location) params.set('area', location);
    if (budget) params.set('budget', budget);
    navigate(`/properties?${params.toString()}`);
  };

  return (
    <div className="hr-search-card">
      <div className="search-header-row">
        <h4 className="search-title">Search Properties</h4>
        <span className="search-subtle">Buy or rent with RMS</span>
      </div>
      <div className="search-row">
        <Select value={transaction} onChange={setTransaction} style={{ minWidth: 150 }}>
          <Select.Option value="All">Intent</Select.Option>
          <Select.Option value="Sale">Buy</Select.Option>
          <Select.Option value="Rent">Rent</Select.Option>
        </Select>

        <Select value={type} onChange={setType} style={{ minWidth: 170 }}>
          <Select.Option value="All">Property Type</Select.Option>
          <Select.Option value="House">House</Select.Option>
          <Select.Option value="Flat">Flat</Select.Option>
          <Select.Option value="Apartment">Apartment</Select.Option>
          <Select.Option value="Room">Room</Select.Option>
          <Select.Option value="Hostel">Hostel</Select.Option>
        </Select>

        <Select value={location} onChange={setLocation} placeholder="Location" style={{ minWidth: 190 }} allowClear>
          <Select.Option value="">All locations</Select.Option>
          {LOCATION_OPTIONS.map((option) => (
            <Select.Option key={option} value={option}>{option}</Select.Option>
          ))}
        </Select>

        <Select value={budget} onChange={setBudget} placeholder="Budget" style={{ minWidth: 180 }} allowClear>
          <Select.Option value="">Any budget</Select.Option>
          {BUDGET_OPTIONS.map((option) => (
            <Select.Option key={option} value={option}>{option}</Select.Option>
          ))}
        </Select>

        <Button type="primary" onClick={doSearch} className="search-button">Search</Button>
      </div>
    </div>
  );
}
