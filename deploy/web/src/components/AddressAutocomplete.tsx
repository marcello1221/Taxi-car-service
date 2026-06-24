'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Address } from '@taxi/shared';
import styles from './AddressAutocomplete.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://taxi-car-service-api.vercel.app';
const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;
const BIAS_RADIUS_METERS = 50000;

export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string;
  description: string;
}

interface LocationBias {
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: Address) => void;
  onBlurFallback?: (text: string) => void;
  placeholder: string;
  isLoaded: boolean;
  locationBias?: LocationBias | null;
  inputClassName?: string;
  id?: string;
}

function predictionsToSuggestions(
  predictions: google.maps.places.AutocompletePrediction[]
): PlaceSuggestion[] {
  return predictions.map((p) => ({
    placeId: p.place_id,
    main: p.structured_formatting.main_text,
    secondary: p.structured_formatting.secondary_text || '',
    description: p.description,
  }));
}

function hasGooglePlaces(): boolean {
  return typeof window !== 'undefined' && Boolean(window.google?.maps?.places);
}

function buildAutocompleteUrl(input: string, locationBias?: LocationBias | null): string {
  const params = new URLSearchParams({ input });
  if (locationBias) {
    params.set('lat', String(locationBias.lat));
    params.set('lng', String(locationBias.lng));
  }
  return `${API_URL}/api/places/autocomplete?${params}`;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlurFallback,
  placeholder,
  isLoaded,
  locationBias,
  inputClassName,
  id,
}: AddressAutocompleteProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestIdRef = useRef(0);
  const pickingRef = useRef(false);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

  const ensureGoogleServices = useCallback(() => {
    if (!hasGooglePlaces()) return false;
    if (!serviceRef.current) {
      serviceRef.current = new google.maps.places.AutocompleteService();
      placesRef.current = new google.maps.places.PlacesService(document.createElement('div'));
    }
    return true;
  }, []);

  const fetchFromApi = useCallback(async (input: string, bias?: LocationBias | null) => {
    const res = await fetch(buildAutocompleteUrl(input, bias));
    if (!res.ok) return [];
    return (await res.json()) as PlaceSuggestion[];
  }, []);

  const applySuggestions = useCallback((items: PlaceSuggestion[]) => {
    setSuggestions(items);
    setOpen(true);
    setActiveIndex(-1);
  }, []);

  const loadSuggestions = useCallback(
    async (input: string, bias?: LocationBias | null) => {
      const trimmed = input.trim();
      if (trimmed.length < MIN_CHARS) {
        setSuggestions([]);
        setOpen(false);
        setActiveIndex(-1);
        setLoading(false);
        setSearchAttempted(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setSearchAttempted(true);
      setOpen(true);

      const predictionRequest: google.maps.places.AutocompletionRequest = {
        input: trimmed,
        componentRestrictions: { country: 'us' },
      };

      if (bias) {
        predictionRequest.location = new google.maps.LatLng(bias.lat, bias.lng);
        predictionRequest.radius = BIAS_RADIUS_METERS;
      }

      if (isLoaded && ensureGoogleServices() && serviceRef.current) {
        serviceRef.current.getPlacePredictions(predictionRequest, (predictions, status) => {
          if (requestId !== requestIdRef.current) return;

          if (status === google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
            applySuggestions(predictionsToSuggestions(predictions));
            setLoading(false);
            return;
          }

          void fetchFromApi(trimmed, bias)
            .then((items) => {
              if (requestId !== requestIdRef.current) return;
              applySuggestions(items);
            })
            .finally(() => {
              if (requestId === requestIdRef.current) setLoading(false);
            });
        });
        return;
      }

      try {
        const items = await fetchFromApi(trimmed, bias);
        if (requestId !== requestIdRef.current) return;
        applySuggestions(items);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [applySuggestions, ensureGoogleServices, fetchFromApi, isLoaded]
  );

  const resolveSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<Address | null> => {
      if (isLoaded && ensureGoogleServices() && placesRef.current) {
        const fromGoogle = await new Promise<Address | null>((resolve) => {
          placesRef.current!.getDetails(
            { placeId: suggestion.placeId, fields: ['formatted_address', 'geometry', 'place_id'] },
            (place, status) => {
              const loc = place?.geometry?.location;
              if (status !== google.maps.places.PlacesServiceStatus.OK || !loc) {
                resolve(null);
                return;
              }
              resolve({
                formatted: place.formatted_address || suggestion.description,
                lat: loc.lat(),
                lng: loc.lng(),
                placeId: place.place_id,
              });
            }
          );
        });
        if (fromGoogle) return fromGoogle;
      }

      const res = await fetch(`${API_URL}/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        formatted: data.formatted,
        lat: data.lat,
        lng: data.lng,
        placeId: data.placeId,
      };
    },
    [ensureGoogleServices, isLoaded]
  );

  const pickSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      pickingRef.current = true;
      requestIdRef.current += 1;
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
      setLoading(false);
      onChange(suggestion.description);

      try {
        const address = await resolveSuggestion(suggestion);
        if (address) {
          onChange(address.formatted);
          onSelect(address);
          return;
        }
        onBlurFallback?.(suggestion.description);
      } finally {
        window.setTimeout(() => {
          pickingRef.current = false;
        }, 250);
      }
    },
    [onBlurFallback, onChange, onSelect, resolveSuggestion]
  );

  const queueSearch = useCallback(
    (text: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void loadSuggestions(text, locationBias);
      }, DEBOUNCE_MS);
    },
    [loadSuggestions, locationBias]
  );

  const handleInputChange = (text: string) => {
    onChange(text);
    queueSearch(text);
  };

  const handleFocus = () => {
    if (value.trim().length >= MIN_CHARS) {
      setOpen(true);
      if (suggestions.length === 0 && !loading) {
        queueSearch(value);
      }
    }
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      setOpen(false);
      if (pickingRef.current) return;
      if (value.trim() && onBlurFallback) {
        onBlurFallback(value.trim());
      }
    }, 180);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions.length > 0) {
      e.preventDefault();
      void pickSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const showPanel = open && value.trim().length >= MIN_CHARS;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />

      {showPanel && (
        <ul id={listId} className={styles.suggestions} role="listbox">
          {loading && suggestions.length === 0 && (
            <li className={styles.status} role="presentation">
              Searching nearby addresses…
            </li>
          )}

          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placeId} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`${styles.suggestion} ${index === activeIndex ? styles.suggestionActive : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pickSuggestion(suggestion)}
              >
                <span className={styles.pin} aria-hidden>📍</span>
                <span>
                  <span className={styles.main}>{suggestion.main}</span>
                  {suggestion.secondary && (
                    <span className={styles.secondary}>{suggestion.secondary}</span>
                  )}
                </span>
              </button>
            </li>
          ))}

          {!loading && searchAttempted && suggestions.length === 0 && (
            <li className={styles.status} role="presentation">
              No nearby matches — keep typing or press Tab to geocode on blur.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
