'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  formatUSD,
  STAFF_ROLE_LABELS,
  STAFF_ROLES_CREATABLE_BY_OWNER,
  hasPermission,
  type StaffMember,
  type StaffRole,
  type BusinessReport,
  type ReportPeriod,
} from '@taxi/shared';
import styles from '../app/page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://taxi-car-service-api.vercel.app';
const SESSION_KEY = 'taxi_owner_session';

type Tab = 'dashboard' | 'staff' | 'expenses' | 'drivers';

async function apiFetch(path: string, staffId: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-staff-id': staffId,
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function OwnerPortal() {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [report, setReport] = useState<BusinessReport | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [drivers, setDrivers] = useState<Array<{ driverId: string; name: string; email: string; createdAt: string; vehicleCategory: string; rating: number }>>([]);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'admin' as StaffRole, password: '' });
  const [expenseForm, setExpenseForm] = useState({ category: 'Operations', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setStaff(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const persistStaff = (s: StaffMember | null) => {
    setStaff(s);
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  };

  const login = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/owner/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      persistStaff(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadReport = useCallback(async () => {
    if (!staff) return;
    try {
      const data = await apiFetch(`/api/owner/reports/${period}`, staff.id);
      setReport(data);
    } catch (err) {
      setError(String(err));
    }
  }, [staff, period]);

  const loadStaff = useCallback(async () => {
    if (!staff || !hasPermission(staff.role, 'manage_staff')) return;
    try {
      const data = await apiFetch('/api/owner/staff', staff.id);
      setStaffList(data);
    } catch (err) {
      setError(String(err));
    }
  }, [staff]);

  const loadDrivers = useCallback(async () => {
    if (!staff || !hasPermission(staff.role, 'view_drivers')) return;
    try {
      const data = await apiFetch('/api/owner/drivers', staff.id);
      setDrivers(data);
    } catch (err) {
      setError(String(err));
    }
  }, [staff]);

  useEffect(() => {
    if (!staff) return;
    if (tab === 'dashboard') loadReport();
    if (tab === 'staff') loadStaff();
    if (tab === 'drivers') loadDrivers();
    if (tab === 'expenses') loadReport();
  }, [staff, tab, period, loadReport, loadStaff, loadDrivers]);

  const addStaff = async () => {
    if (!staff) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/owner/staff', staff.id, { method: 'POST', body: JSON.stringify(newStaff) });
      setNewStaff({ name: '', email: '', role: 'admin', password: '' });
      loadStaff();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const deactivateStaff = async (id: string) => {
    if (!staff) return;
    try {
      await apiFetch(`/api/owner/staff/${id}`, staff.id, { method: 'DELETE' });
      loadStaff();
    } catch (err) {
      setError(String(err));
    }
  };

  const submitExpense = async () => {
    if (!staff) return;
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/owner/expenses', staff.id, {
        method: 'POST',
        body: JSON.stringify({
          ...expenseForm,
          amount: parseFloat(expenseForm.amount),
        }),
      });
      setExpenseForm({ category: 'Operations', description: '', amount: '', date: new Date().toISOString().slice(0, 10) });
      loadReport();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!staff) {
    return (
      <div className={styles.page}>
        <div className={styles.loginCard}>
          <h2>Owner Platform</h2>
          <p>Sign in to manage staff, view reports, and track company performance.</p>
          <div className={styles.field}>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@taxi.demo" />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btnPrimary} onClick={login} disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Default: owner@taxi.demo / Owner123!
          </p>
        </div>
      </div>
    );
  }

  const canManageStaff = hasPermission(staff.role, 'manage_staff');
  const canViewReports = hasPermission(staff.role, 'view_reports');
  const canManageExpenses = hasPermission(staff.role, 'manage_expenses');
  const canViewDrivers = hasPermission(staff.role, 'view_drivers');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <h1>Taxi Car Service</h1>
          <p>Owner Platform</p>
        </div>
        <div className={styles.headerRight}>
          <span>{staff.name}</span>
          <span className={styles.roleBadge}>{STAFF_ROLE_LABELS[staff.role]}</span>
          <button type="button" className={styles.signOut} onClick={() => persistStaff(null)}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>
        <nav className={styles.tabs}>
          {canViewReports && (
            <button type="button" className={tab === 'dashboard' ? styles.tabActive : styles.tab} onClick={() => setTab('dashboard')}>
              Dashboard
            </button>
          )}
          {canManageStaff && (
            <button type="button" className={tab === 'staff' ? styles.tabActive : styles.tab} onClick={() => setTab('staff')}>
              Staff
            </button>
          )}
          {canManageExpenses && (
            <button type="button" className={tab === 'expenses' ? styles.tabActive : styles.tab} onClick={() => setTab('expenses')}>
              Expenses
            </button>
          )}
          {canViewDrivers && (
            <button type="button" className={tab === 'drivers' ? styles.tabActive : styles.tab} onClick={() => setTab('drivers')}>
              Drivers
            </button>
          )}
        </nav>

        {error && <p className={styles.error}>{error}</p>}

        {tab === 'dashboard' && canViewReports && (
          <>
            <div className={styles.periodToggle}>
              <button type="button" className={period === 'weekly' ? styles.tabActive : styles.tab} onClick={() => setPeriod('weekly')}>Weekly</button>
              <button type="button" className={period === 'monthly' ? styles.tabActive : styles.tab} onClick={() => setPeriod('monthly')}>Monthly</button>
            </div>

            {report && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  {new Date(report.startDate).toLocaleDateString()} — {new Date(report.endDate).toLocaleDateString()}
                </p>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Rider Revenue</div>
                    <div className={`${styles.statValue} ${styles.teal}`}>{formatUSD(report.summary.revenue)}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Driver Net (56.22%)</div>
                    <div className={styles.statValue}>{formatUSD(report.summary.driverPayouts)}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Company Net Fee (15%)</div>
                    <div className={`${styles.statValue} ${styles.gold}`}>{formatUSD(report.summary.fees.companyNetFee)}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Company Net − Expenses</div>
                    <div className={`${styles.statValue} ${styles.gold}`}>{formatUSD(report.summary.platformNet)}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Operating Expenses</div>
                    <div className={styles.statValue}>{formatUSD(report.summary.expenses)}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Completed Rides</div>
                    <div className={styles.statValue}>{report.summary.completedRides}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>New Drivers</div>
                    <div className={`${styles.statValue} ${styles.purple}`}>{report.summary.newDrivers}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Total Drivers</div>
                    <div className={styles.statValue}>{report.summary.totalDrivers}</div>
                  </div>
                </div>

                <div className={styles.section}>
                  <h3>Fee breakdown (from rider payments)</h3>
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>City Tax (8.78%)</div>
                      <div className={styles.statValue}>{formatUSD(report.summary.fees.cityTax)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>Black Car Fund (1.5%)</div>
                      <div className={styles.statValue}>{formatUSD(report.summary.fees.blackCarFund)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>NYC Surcharge (0.5%)</div>
                      <div className={styles.statValue}>{formatUSD(report.summary.fees.nycSurcharge)}</div>
                    </div>
                    <div className={styles.statCard}>
                      <div className={styles.statLabel}>Gov Fee (18%)</div>
                      <div className={styles.statValue}>{formatUSD(report.summary.fees.govFee)}</div>
                    </div>
                  </div>
                </div>

                <div className={styles.section}>
                  <h3>Net per driver</h3>
                  {report.driverBreakdown.length === 0 ? (
                    <p className={styles.empty}>No completed rides in this period.</p>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Rides</th>
                          <th>Rider Revenue</th>
                          <th>Driver Net</th>
                          <th>Company Net (15%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.driverBreakdown.map((d) => (
                          <tr key={d.driverId}>
                            <td>{d.driverName}</td>
                            <td>{d.ridesCompleted}</td>
                            <td>{formatUSD(d.revenue)}</td>
                            <td>{formatUSD(d.driverPayout)}</td>
                            <td style={{ color: '#f59e0b', fontWeight: 700 }}>{formatUSD(d.platformNet)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'staff' && canManageStaff && (
          <>
            <div className={styles.section}>
              <h3>Add staff member</h3>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Name</label>
                  <input value={newStaff.name} onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Email</label>
                  <input value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Role</label>
                  <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as StaffRole })}>
                    {STAFF_ROLES_CREATABLE_BY_OWNER.map((r) => (
                      <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Password</label>
                  <input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} />
                </div>
              </div>
              <button type="button" className={styles.btnPrimary} onClick={addStaff} disabled={loading}>Add staff</button>
            </div>

            <div className={styles.section}>
              <h3>Team ({staffList.length})</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{STAFF_ROLE_LABELS[s.role]}</td>
                      <td>{s.isActive ? 'Active' : 'Inactive'}</td>
                      <td>
                        {s.role !== 'owner' && s.isActive && (
                          <button type="button" className={styles.btnDanger} onClick={() => deactivateStaff(s.id)}>Deactivate</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'expenses' && canManageExpenses && (
          <>
            <div className={styles.section}>
              <h3>Record expense</h3>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Category</label>
                  <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    <option>Operations</option>
                    <option>Marketing</option>
                    <option>Insurance</option>
                    <option>Maintenance</option>
                    <option>Payroll</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Amount ($)</label>
                  <input value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label>Date</label>
                <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
              </div>
              <button type="button" className={styles.btnPrimary} onClick={submitExpense} disabled={loading}>Save expense</button>
            </div>

            {report && report.expenses.length > 0 && (
              <div className={styles.section}>
                <h3>Recent expenses ({period})</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{e.date}</td>
                        <td>{e.category}</td>
                        <td>{e.description}</td>
                        <td>{formatUSD(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'drivers' && canViewDrivers && (
          <div className={styles.section}>
            <h3>All drivers ({drivers.length})</h3>
            {drivers.length === 0 ? (
              <p className={styles.empty}>No drivers registered yet.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Vehicle</th>
                    <th>Rating</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.driverId}>
                      <td>{d.name}</td>
                      <td>{d.email}</td>
                      <td>{d.vehicleCategory}</td>
                      <td>{d.rating}</td>
                      <td>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
