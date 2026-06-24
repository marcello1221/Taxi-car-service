import type { RouteInfo } from '@taxi/shared';

interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      status: string;
      distance?: { value: number };
      duration?: { value: number };
      duration_in_traffic?: { value: number };
    }>;
  }>;
}

const METERS_TO_MILES = 0.000621371;

export async function getRouteInfo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  departureTime?: Date
): Promise<RouteInfo> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return estimateRoute(origin, destination);
  }

  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: `${destination.lat},${destination.lng}`,
    units: 'imperial',
    key: apiKey,
  });

  if (departureTime) {
    params.set('departure_time', Math.floor(departureTime.getTime() / 1000).toString());
    params.set('traffic_model', 'best_guess');
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
  const res = await fetch(url);
  const data = (await res.json()) as DistanceMatrixResponse & { status: string; error_message?: string };

  if (data.status !== 'OK') {
    console.warn('Google Maps API fallback:', data.error_message || data.status);
    return estimateRoute(origin, destination);
  }

  const element = data.rows[0]?.elements[0];
  if (!element || element.status !== 'OK') {
    return estimateRoute(origin, destination);
  }

  const distanceMiles = (element.distance!.value * METERS_TO_MILES);
  const durationMinutes = element.duration!.value / 60;
  const durationInTrafficMinutes = element.duration_in_traffic
    ? element.duration_in_traffic.value / 60
    : durationMinutes;

  return {
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes: Math.round(durationMinutes * 100) / 100,
    durationInTrafficMinutes: Math.round(durationInTrafficMinutes * 100) / 100,
  };
}

/** Haversine fallback when API key unavailable */
function estimateRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): RouteInfo {
  const R = 3958.8;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;
  const distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const durationMinutes = (distanceMiles / 25) * 60;

  return {
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes: Math.round(durationMinutes * 100) / 100,
    durationInTrafficMinutes: Math.round(durationMinutes * 1.15 * 100) / 100,
  };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const NOMINATIM_HEADERS = { 'User-Agent': 'TaxiCarService/1.0 (https://taxi-car-service.vercel.app)' };

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: NOMINATIM_HEADERS,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    if (!data.display_name) return null;
    return { lat, lng, formatted: data.display_name };
  } catch {
    return null;
  }
}

async function geocodeWithNominatim(
  address: string
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const params = new URLSearchParams({
      q: address.trim(),
      format: 'json',
      limit: '1',
      countrycodes: 'us',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: NOMINATIM_HEADERS,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const hit = data[0];
    if (!hit) return null;
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      formatted: hit.display_name,
    };
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    const params = new URLSearchParams({
      address,
      components: 'country:US',
      key: apiKey,
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json() as { results: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }> };

    const result = data.results[0];
    if (result) {
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted: result.formatted_address,
      };
    }
  }

  return geocodeWithNominatim(address);
}

export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string;
  description: string;
}

const AUTOCOMPLETE_BIAS_RADIUS = 50000;

export async function autocompleteAddress(
  input: string,
  location?: { lat: number; lng: number }
): Promise<PlaceSuggestion[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return searchPlacesNominatim(trimmed, location);
  }

  const params = new URLSearchParams({
    input: trimmed,
    components: 'country:us',
    key: apiKey,
  });

  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    params.set('location', `${location.lat},${location.lng}`);
    params.set('radius', String(AUTOCOMPLETE_BIAS_RADIUS));
  }

  const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const data = await res.json() as {
    status: string;
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting: { main_text: string; secondary_text?: string };
    }>;
  };

  if (data.status !== 'OK' || !data.predictions) {
    return searchPlacesNominatim(input.trim(), location);
  }

  return data.predictions.map((p) => ({
    placeId: p.place_id,
    main: p.structured_formatting.main_text,
    secondary: p.structured_formatting.secondary_text || '',
    description: p.description,
  }));
}

async function searchPlacesNominatim(
  input: string,
  location?: { lat: number; lng: number }
): Promise<PlaceSuggestion[]> {
  try {
    const params = new URLSearchParams({
      q: input,
      format: 'json',
      limit: '6',
      countrycodes: 'us',
      addressdetails: '1',
    });

    if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
      const delta = 0.35;
      const left = location.lng - delta;
      const right = location.lng + delta;
      const top = location.lat + delta;
      const bottom = location.lat - delta;
      params.set('viewbox', `${left},${top},${right},${bottom}`);
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: NOMINATIM_HEADERS,
    });
    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      name?: string;
    }>;

    return data.map((item) => {
      const parts = item.display_name.split(',').map((part) => part.trim());
      const main = item.name || parts[0] || item.display_name;
      const secondary = parts.slice(1).join(', ');
      return {
        placeId: `nominatim:${item.lat}:${item.lon}`,
        main,
        secondary,
        description: item.display_name,
      };
    });
  } catch {
    return [];
  }
}

export async function getPlaceDetails(
  placeId: string
): Promise<{ lat: number; lng: number; formatted: string; placeId: string } | null> {
  if (placeId.startsWith('nominatim:')) {
    const [, latStr, lngStr] = placeId.split(':');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const reversed = await reverseGeocode(lat, lng);
    if (!reversed) return { lat, lng, formatted: `${lat}, ${lng}`, placeId };
    return { ...reversed, placeId };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !placeId) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'formatted_address,geometry,place_id',
    key: apiKey,
  });

  const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const data = await res.json() as {
    status: string;
    result?: {
      place_id: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    };
  };

  const result = data.result;
  if (data.status !== 'OK' || !result) return null;

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted: result.formatted_address,
    placeId: result.place_id,
  };
}
