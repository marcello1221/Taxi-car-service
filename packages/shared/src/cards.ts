import type { CardType } from './types';

export const ACCEPTED_CARD_TYPES: { id: CardType; label: string }[] = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'amex', label: 'American Express' },
  { id: 'debit', label: 'Debit Card' },
  { id: 'credit', label: 'Credit Card' },
];
