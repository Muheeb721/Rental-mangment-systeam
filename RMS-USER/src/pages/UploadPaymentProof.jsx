import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function UploadPaymentProof() {
  const [rentId, setRentId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rentId) return alert('Enter Rent Record ID');
    if (!file) return alert('Choose an image file to upload');

    setLoading(true);
    try {
      const form = new FormData();
      form.append('image', file);

      // Upload image to backend image endpoint
      const upl = await fetch('/api/images', { method: 'POST', body: form });
      const uplJson = await upl.json();
      if (!uplJson || !uplJson.success || !uplJson.data) {
        throw new Error('Image upload failed');
      }

      const imageUrl = uplJson.data.url || uplJson.data.imageUrl || uplJson.data.path || uplJson.data.src || uplJson.data;
      // send proof image to rent record pay endpoint
      const resp = await api.request(`/rents/${encodeURIComponent(rentId)}/pay`, { method: 'POST', body: { proofImage: imageUrl } });
      if (!resp || !resp.success) throw new Error(resp?.message || 'Unable to attach proof');

      alert('Payment proof uploaded successfully');
      navigate('/my-rent');
    } catch (err) {
      console.error('Upload failed', err);
      alert(err?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <section style={{ maxWidth: 740, margin: '0 auto' }}>
        <h2>Upload Payment Proof</h2>
        <p>Enter the Rent Record ID shown in your My Rent page, choose the payment proof image and submit.</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label>Rent Record ID</label>
            <input value={rentId} onChange={(e) => setRentId(e.target.value)} style={{ width: '100%', padding: 8 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Proof Image</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
          </div>
          <div>
            <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload Proof'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
