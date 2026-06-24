'use client';

import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Address } from '@taxi/shared';
import styles from './BookingMap.module.css';

export type MapTarget = 'pickup' | 'dropoff';

interface BookingMapProps {
  center: { lat: number; lng: number };
  pickup: Address | null;
  dropoff: Address | null;
  mapTarget: MapTarget;
  onMapTargetChange: (target: MapTarget) => void;
  onMapClick: (lat: number, lng: number) => void;
}

const pickupIcon = L.divIcon({
  className: styles.pickupPin,
  html: '<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#00d4aa;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:10px;font-weight:700;color:#0a0e17;"><span style="transform:rotate(45deg);display:block;">P</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const dropoffIcon = L.divIcon({
  className: styles.dropoffPin,
  html: '<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#7c3aed;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:10px;font-weight:700;color:#fff;"><span style="transform:rotate(45deg);display:block;">D</span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

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
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng]
      );
      map.fitBounds(bounds.pad(0.2), { animate: true });
      return;
    }
    if (pickup) {
      map.setView([pickup.lat, pickup.lng], 15, { animate: true });
      return;
    }
    if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 15, { animate: true });
      return;
    }
    map.setView([center.lat, center.lng], 13, { animate: true });
  }, [center.lat, center.lng, dropoff, map, pickup]);

  return null;
}

export default function BookingMap({
  center,
  pickup,
  dropoff,
  mapTarget,
  onMapTargetChange,
  onMapClick,
}: BookingMapProps) {
  const routeLine =
    pickup && dropoff
      ? [
          [pickup.lat, pickup.lng] as [number, number],
          [dropoff.lat, dropoff.lng] as [number, number],
        ]
      : null;

  return (
    <div className={styles.mapLayer} aria-hidden>
      <div className={styles.mapTargetBar}>
        <button
          type="button"
          className={`${styles.mapTargetBtn} ${mapTarget === 'pickup' ? styles.mapTargetPickupActive : ''}`}
          onClick={() => onMapTargetChange('pickup')}
        >
          Set pickup
        </button>
        <button
          type="button"
          className={`${styles.mapTargetBtn} ${mapTarget === 'dropoff' ? styles.mapTargetDropoffActive : ''}`}
          onClick={() => onMapTargetChange('dropoff')}
        >
          Set dropoff
        </button>
      </div>

      <p className={styles.mapHint}>
        OpenStreetMap · click the map to autofill the active address field
      </p>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={onMapClick} />
        <MapViewport center={center} pickup={pickup} dropoff={dropoff} />

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon} />
        )}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon} />
        )}
        {routeLine && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#00d4aa', weight: 4, opacity: 0.75, dashArray: '8 8' }}
          />
        )}
        {pickup && !dropoff && (
          <CircleMarker
            center={[pickup.lat, pickup.lng]}
            radius={18}
            pathOptions={{ color: '#00d4aa', fillColor: '#00d4aa', fillOpacity: 0.08, weight: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
