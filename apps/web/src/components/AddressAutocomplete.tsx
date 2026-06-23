'use client';

import { useRef } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import type { Address } from '@taxi/shared';

const AUTOCOMPLETE_OPTIONS: google.maps.places.AutocompleteOptions = {
  componentRestrictions: { country: 'us' },
  fields: ['formatted_address', 'geometry', 'place_id'],
};

interface AddressAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (address: Address) => void;
  onBlurFallback?: (text: string) => void;
  placeholder: string;
  isLoaded: boolean;
  inputClassName?: string;
}

function placeToAddress(place: google.maps.places.PlaceResult): Address | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  return {
    formatted: place.formatted_address || '',
    lat: loc.lat(),
    lng: loc.lng(),
    placeId: place.place_id,
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onBlurFallback,
  placeholder,
  isLoaded,
  inputClassName,
}: AddressAutocompleteProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const selectedRef = useRef(false);

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;
    const address = placeToAddress(place);
    if (!address?.formatted) return;
    selectedRef.current = true;
    onChange(address.formatted);
    onSelect(address);
  };

  const handleBlur = () => {
    if (selectedRef.current) {
      selectedRef.current = false;
      return;
    }
    if (value.trim() && onBlurFallback) {
      onBlurFallback(value.trim());
    }
  };

  const input = (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        selectedRef.current = false;
        onChange(e.target.value);
      }}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={inputClassName}
      autoComplete="off"
    />
  );

  if (!isLoaded || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return input;
  }

  return (
    <Autocomplete
      onLoad={(instance) => {
        autocompleteRef.current = instance;
      }}
      onPlaceChanged={handlePlaceChanged}
      options={AUTOCOMPLETE_OPTIONS}
    >
      {input}
    </Autocomplete>
  );
}
