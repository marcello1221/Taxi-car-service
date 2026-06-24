'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Address } from '@taxi/shared';
import styles from './BookingMap.module.css';

interface BookingMapProps {
  center: { lat: number; lng: number };
  pickup: Address | null;
  dropoff: Address | null;
}

const pickupIcon = L.divIcon({
  className: styles.pickupPin,
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#00d4aa;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"><span style="display:block;transform:rotate(45deg);text-align:center;font-size:10px;font-weight:700;color:#0a0e17;line-height:24px;">P</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const dropoffIcon = L.divIcon({
  className: styles.dropoffPin,
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#7c3aed;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"><span style="display:block;transform:rotate(45deg);text-align:center;font-size:10px;font-weight:700;color:#fff;line-height:24px;">D</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function MapViewport({
  center,
  pickup,
  dropoff,
}: {
  center: { lat: number; lng: number };
  pickup: Address | null;
  dropoff: Address | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (pickup && dropoff) {
      map.fitBounds(
        L.latLngBounds([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]).pad(0.2),
        { animate: true }
      );
      return;
    }
    if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14, { animate: true });
      return;
    }
    if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14, { animate: true });
      return;
    }
    map.setView([center.lat, center.lng], 12, { animate: true });
  }, [center.lat, center.lng, dropoff, map, pickup]);

  return null;
}

export default function BookingMap({ center, pickup, dropoff }: BookingMapProps) {
  const routeLine =
    pickup && dropoff
      ? ([
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ] as [number, number][])
      : null;

  return (
    <div className={styles.mapLayer} aria-hidden>
      <MapContainer center={[center.lat, center.lng]} zoom={12} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport center={center} pickup={pickup} dropoff={dropoff} />
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />}
        {routeLine && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#00d4aa', weight: 5, opacity: 0.85 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
