import { useState } from 'react';
import './ApiPanelPage.css';

function ApiPanelPage({ appState, setAppState }) {
  const [form, setForm] = useState(appState.apiConfig);

  const handleSubmit = (event) => {
    event.preventDefault();
    setAppState((prev) => ({ ...prev, apiConfig: form }));
  };

  return (
    <div className="page-section api-panel-page">
      <section className="panel-card">
        <div className="card-header">
          <h3>API Management</h3>
        </div>
        <form onSubmit={handleSubmit} className="property-form">
          <label>
            Base URL
            <input value={form.baseUrl} onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))} />
          </label>
          <label>
            API Token
            <input value={form.token} onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))} />
          </label>
          <label>
            Timeout (ms)
            <input value={form.timeout} type="number" onChange={(e) => setForm((prev) => ({ ...prev, timeout: Number(e.target.value) }))} />
          </label>
          <label>
            Environment
            <select value={form.mode} onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))}>
              <option value="Development">Development</option>
              <option value="Staging">Staging</option>
              <option value="Production">Production</option>
            </select>
          </label>
          <button type="submit" className="primary-button">Save API Settings</button>
        </form>
      </section>
    </div>
  );
}

export default ApiPanelPage;
