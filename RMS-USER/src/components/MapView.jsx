import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';
import { propertyData, hostelData } from '../data/dummyData';
import L from 'leaflet';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -30],
});

function MapView({ selectedArea = 'All Areas' }) {
  const filteredProperties = selectedArea && selectedArea !== 'All Areas'
    ? propertyData.filter((property) => property.area === selectedArea)
    : propertyData;

  const filteredHostels = selectedArea && selectedArea !== 'All Areas'
    ? hostelData.filter((hostel) => hostel.area === selectedArea)
    : hostelData;

  const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

  const propertiesWithCoords = filteredProperties.filter(
    (p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng)
  );
  const hostelsWithCoords = filteredHostels.filter(
    (h) => isFiniteNumber(h.lat) && isFiniteNumber(h.lng)
  );

  const allWithCoords = [...propertiesWithCoords, ...hostelsWithCoords];
  const mapCenter = allWithCoords.length
    ? [allWithCoords[0].lat, allWithCoords[0].lng]
    : [31.5204, 74.3587];

  return (
    <div className="map-shell">
      <MapContainer center={mapCenter} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%', minHeight: 240 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {propertiesWithCoords.map((property) => (
          <Marker key={property.id} position={[property.lat, property.lng]} icon={defaultIcon}>
            <Popup>{property.title} · {property.area}</Popup>
          </Marker>
        ))}
        {hostelsWithCoords.map((hostel) => (
          <Marker key={hostel.id} position={[hostel.lat, hostel.lng]} icon={defaultIcon}>
            <Popup>{hostel.title} · {hostel.area}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapView;
