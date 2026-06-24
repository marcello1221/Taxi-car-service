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

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    address,
    components: 'country:US',
    key: apiKey,
  });

  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await res.json() as { results: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }> };

  const result = data.results[0];
  if (!result) return null;

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted: result.formatted_address,
  };
}

export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string;
  description: string;
}

export async function autocompleteAddress(input: string): Promise<PlaceSuggestion[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || input.trim().length < 3) return [];

  const params = new URLSearchParams({
    input: input.trim(),
    components: 'country:us',
    types: 'geocode',
    key: apiKey,
  });

  const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const data = await res.json() as {
    status: string;
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting: { main_text: string; secondary_text?: string };
    }>;
  };

  if (data.status !== 'OK' || !data.predictions) return [];

  return data.predictions.map((p) => ({
    placeId: p.place_id,
    main: p.structured_formatting.main_text,
    secondary: p.structured_formatting.secondary_text || '',
    description: p.description,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; formatted: string; placeId: string } | null> {
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
