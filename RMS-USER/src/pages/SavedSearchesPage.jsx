import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Card, Button, Spin, Alert } from 'antd';
import { fetchSavedSearches, deleteSavedSearchById } from '../utils/savedSearchesStorage';

function SavedSearchesPage() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchSavedSearches();
        if (!mounted) return;
        setSaved(items || []);
      } catch (e) {
        console.error('fetch saved searches failed', e);
        if (mounted) setError('Unable to load saved searches');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const run = (filters) => {
    const params = new URLSearchParams();
    if (!filters) return navigate('/properties');
    if (filters.q) params.set('q', filters.q);
    if (filters.type && filters.type !== 'Any Type') params.set('type', filters.type);
    if (filters.area && filters.area !== 'All Areas') params.set('area', filters.area);
    navigate(`/properties?${params.toString()}`);
  };

  const del = async (id) => {
    const res = await deleteSavedSearchById(id);
    if (res && res.success) {
      setSaved((prev) => prev.filter((s) => String(s.id) !== String(id)));
    }
  };

  return (
    <div className="page-shell">
      <section className="section-card">
        <h2 className="section-title">Saved Searches</h2>
        <p className="section-subtitle">View, run, or delete your saved searches.</p>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : error ? (
          <Alert type="error" message={error} />
        ) : (
          <List dataSource={saved} renderItem={(item) => (
          <List.Item actions={[<Button key="run" onClick={() => run(item.filters)}>Run</Button>, <Button key="delete" danger onClick={() => del(item.id)}>Delete</Button>] }>
            <List.Item.Meta title={item.name} description={JSON.stringify(item.filters)} />
          </List.Item>
          )} />
        )}
      </section>
    </div>
  );
}

export default SavedSearchesPage;
