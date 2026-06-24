'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Address } from '@taxi/shared';
import styles from './AddressAutocomplete.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://taxi-car-service-api.vercel.app';
const MIN_CHARS = 3;

export interface PlaceSuggestion {
  placeId: string;
  main: string;
  secondary: string;
  description: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: Address) => void;
  onBlurFallback?: (text: string) => void;
  placeholder: string;
  isLoaded: boolean;
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

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlurFallback,
  placeholder,
  isLoaded,
  inputClassName,
  id,
}: AddressAutocompleteProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const skipFetchRef = useRef(false);

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    serviceRef.current = new google.maps.places.AutocompleteService();
    placesRef.current = new google.maps.places.PlacesService(document.createElement('div'));
  }, [isLoaded]);

  const fetchFromApi = useCallback(async (input: string) => {
    const res = await fetch(`${API_URL}/api/places/autocomplete?input=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    return (await res.json()) as PlaceSuggestion[];
  }, []);

  const loadSuggestions = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (trimmed.length < MIN_CHARS) {
        setSuggestions([]);
        setOpen(false);
        setActiveIndex(-1);
        return;
      }

      setLoading(true);

      if (serviceRef.current) {
        serviceRef.current.getPlacePredictions(
          {
            input: trimmed,
            componentRestrictions: { country: 'us' },
            types: ['geocode'],
          },
          (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
              setSuggestions(predictionsToSuggestions(predictions));
              setOpen(true);
              setActiveIndex(-1);
              setLoading(false);
              return;
            }
            void fetchFromApi(trimmed)
              .then((items) => {
                setSuggestions(items);
                setOpen(items.length > 0);
                setActiveIndex(-1);
              })
              .finally(() => setLoading(false));
          }
        );
        return;
      }

      void fetchFromApi(trimmed)
        .then((items) => {
          setSuggestions(items);
          setOpen(items.length > 0);
          setActiveIndex(-1);
        })
        .finally(() => setLoading(false));
    },
    [fetchFromApi]
  );

  const resolveSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<Address | null> => {
      if (placesRef.current) {
        return new Promise((resolve) => {
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
    []
  );

  const pickSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      skipFetchRef.current = true;
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
      onChange(suggestion.description);

      const address = await resolveSuggestion(suggestion);
      if (address) {
        onChange(address.formatted);
        onSelect(address);
        return;
      }
      onBlurFallback?.(suggestion.description);
    },
    [onBlurFallback, onChange, onSelect, resolveSuggestion]
  );

  const handleInputChange = (text: string) => {
    skipFetchRef.current = false;
    onChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSuggestions(text), 280);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      setOpen(false);
      if (value.trim() && onBlurFallback) {
        onBlurFallback(value.trim());
      }
    }, 180);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
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

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => value.trim().length >= MIN_CHARS && suggestions.length > 0 && setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <ul id={listId} className={styles.suggestions} role="listbox">
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
        </ul>
      )}

      {loading && value.trim().length >= MIN_CHARS && !open && (
        <div className={styles.hint}>Finding addresses…</div>
      )}
    </div>
  );
}
