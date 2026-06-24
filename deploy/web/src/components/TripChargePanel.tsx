'use client';

import { formatUSD } from '@taxi/shared';
import styles from './TripChargePanel.module.css';

type TripFare = {
  baseFare: number;
  mileageCharge: number;
  timeCharge: number;
  subtotal?: number;
  tolls?: Array<{ id: string; name: string; amount: number }>;
  tollTotal?: number;
  companyNetFee?: number;
  cityTax?: number;
  blackCarFund?: number;
  nycSurcharge?: number;
  total: number;
  pickupBorough?: string;
  dropoffBorough?: string;
};

interface TripChargePanelProps {
  fare: TripFare | null;
  loading?: boolean;
  variant?: 'summary' | 'receipt';
}

function labelBorough(value?: string): string {
  if (!value || value === 'other') return 'Outside NYC';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TripChargePanel({
  fare,
  loading = false,
  variant = 'summary',
}: TripChargePanelProps) {
  if (loading) {
    return (
      <div className={styles.chargePanel}>
        <h4>{variant === 'receipt' ? 'Trip receipt' : 'Trip total'}</h4>
        <p className={styles.placeholder}>Calculating your route and fare…</p>
      </div>
    );
  }

  if (!fare) {
    return (
      <div className={styles.chargePanel}>
        <h4>Trip total</h4>
        <p className={styles.placeholder}>Set pickup and dropoff to see your route and total fare.</p>
      </div>
    );
  }

  if (variant === 'summary') {
    return (
      <div className={styles.chargePanel}>
        <h4>Trip total</h4>
        <div className={styles.totalOnly}>
          <span>Total</span>
          <strong>{formatUSD(fare.total)}</strong>
        </div>
        <p className={styles.receiptNote}>
          Itemized charges will be sent as a receipt at the end of your trip.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.chargePanel}>
      <h4>Trip receipt</h4>

      <div className={styles.sectionLabel}>Base charges</div>
      <div className={styles.row}>
        <span>Base fare</span>
        <strong>{formatUSD(fare.baseFare)}</strong>
      </div>
      <div className={styles.row}>
        <span>Mileage</span>
        <strong>{formatUSD(fare.mileageCharge)}</strong>
      </div>
      <div className={styles.row}>
        <span>Time</span>
        <strong>{formatUSD(fare.timeCharge)}</strong>
      </div>
      {fare.subtotal != null && (
        <div className={styles.row}>
          <span>Ride subtotal</span>
          <strong>{formatUSD(fare.subtotal)}</strong>
        </div>
      )}

      <div className={styles.sectionLabel}>NYC fees</div>
      <div className={styles.row}>
        <span>Company net (15%)</span>
        <strong>{formatUSD(fare.companyNetFee ?? 0)}</strong>
      </div>
      <div className={styles.row}>
        <span>City tax (8.875%)</span>
        <strong>{formatUSD(fare.cityTax ?? 0)}</strong>
      </div>
      <div className={styles.row}>
        <span>Black car fund (1.50%)</span>
        <strong>{formatUSD(fare.blackCarFund ?? 0)}</strong>
      </div>
      <div className={styles.row}>
        <span>NYC surcharge (0.50%)</span>
        <strong>{formatUSD(fare.nycSurcharge ?? 0)}</strong>
      </div>

      {(fare.tolls?.length ?? 0) > 0 && (
        <>
          <div className={styles.sectionLabel}>Tolls & crossings</div>
          {fare.tolls?.map((toll) => (
            <div key={toll.id} className={styles.row}>
              <span>{toll.name}</span>
              <strong>{formatUSD(toll.amount)}</strong>
            </div>
          ))}
        </>
      )}

      <div className={styles.totalRow}>
        <span>Total paid</span>
        <span>{formatUSD(fare.total)}</span>
      </div>

      {(fare.pickupBorough || fare.dropoffBorough) && (
        <p className={styles.boroughs}>
          Route: {labelBorough(fare.pickupBorough)} → {labelBorough(fare.dropoffBorough)}
        </p>
      )}
    </div>
  );
}
