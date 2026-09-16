import { AuditLog, Company, Order } from './types';

export interface DatabaseState {
  initialized: boolean;
  orders: Order[];
  companies: Company[];
  auditLogs: AuditLog[];
}

type StatePayload = Pick<DatabaseState, 'orders' | 'companies' | 'auditLogs'>;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || `Database request failed (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

export const databaseApi = {
  getState: () => request<DatabaseState>('/api/state'),
  initialize: (state: StatePayload) => request<DatabaseState>('/api/state/initialize', {
    method: 'POST',
    body: JSON.stringify(state),
  }),
  replaceState: (state: StatePayload) => request<DatabaseState>('/api/state', {
    method: 'PUT',
    body: JSON.stringify(state),
  }),
  createOrder: (order: Order) => request<DatabaseState>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),
  updateOrder: (order: Order) => {
    const orderId = String(order?.id || '').trim();
    if (!orderId) {
      return Promise.reject(new Error('An order ID is required to save this change.'));
    }

    return request<DatabaseState>(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'PUT',
      // Keep the route and payload on the same canonical ID. This also repairs
      // legacy records that were saved with accidental surrounding whitespace.
      body: JSON.stringify({ ...order, id: orderId }),
    });
  },
  deleteOrder: (orderId: string) => request<DatabaseState>(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
  }),
  createCompany: (company: Company) => request<DatabaseState>('/api/companies', {
    method: 'POST',
    body: JSON.stringify(company),
  }),
  deleteCompany: (companyId: string) => request<DatabaseState>(`/api/companies/${encodeURIComponent(companyId)}`, {
    method: 'DELETE',
  }),
  createAuditLog: (log: AuditLog) => request<AuditLog>('/api/audit-logs', {
    method: 'POST',
    body: JSON.stringify(log),
  }),
};
