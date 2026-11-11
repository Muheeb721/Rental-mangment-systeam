import './MessagesPage.css';
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';

function MessagesPage({ appData, setAppData, notify }) {
  const [messages, setMessages] = useState(appData.messages || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiService.request('/contact');
        if (res?.success) {
          const items = Array.isArray(res.data) ? res.data : [];
          setMessages(items);
          setAppData((prev) => ({ ...prev, messages: items }));
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
        notify?.({ message: err.message || 'Unable to load messages', variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [setAppData, notify]);

  return (
    <div className="page-section messages-page">
      <section className="panel-card">
        <div className="card-header">
          <h3>Messages & Support</h3>
          <button className="mini-button">Create Ticket</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sender</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(!loading && messages.length === 0) && (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No messages</td></tr>
              )}
              {messages.map((message) => (
                <tr key={message._id || message.id || message.contactId || message.sender}>
                  <td>{message.name || message.sender || message.email || 'Unknown'}</td>
                  <td>{message.subject || message.message || message.title || '-'}</td>
                  <td><span className={`status-badge ${(message.status === 'Open' || !message.status) ? 'pending' : 'active'}`}>{message.status || 'Open'}</span></td>
                  <td>{message.createdAt ? new Date(message.createdAt).toLocaleString() : (message.date || '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MessagesPage;
