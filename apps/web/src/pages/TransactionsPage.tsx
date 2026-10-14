import { useState } from 'react';
import { type TransactionFilters, useCategories, useDeleteTransaction, useTransactions } from '../api/hooks';
import type { TxType } from '../api/types';
import { CsvImport } from '../components/CsvImport';
import { TransactionForm } from '../components/TransactionForm';
import { formatMoneyPrecise } from '../lib/format';

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1 });
  const { data, isLoading, isError, error, isPlaceholderData } = useTransactions(filters);
  const categories = useCategories();
  const remove = useDeleteTransaction();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const setFilter = (patch: Partial<TransactionFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <div className="stack">
      <h1>Transactions</h1>

      <div className="two-col">
        <TransactionForm />
        <CsvImport />
      </div>

      <section className="card">
        <div className="card-header">
          <h2>History {data && <span className="muted">({data.total})</span>}</h2>
          <div className="row">
            <select
              aria-label="Filter by type"
              value={filters.type ?? ''}
              onChange={(e) => setFilter({ type: (e.target.value || undefined) as TxType | undefined })}
            >
              <option value="">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
            <select
              aria-label="Filter by category"
              value={filters.category ?? ''}
              onChange={(e) => setFilter({ category: e.target.value || undefined })}
            >
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && <div className="placeholder">Loading…</div>}
        {isError && <p className="error">{error?.message}</p>}

        {data && (
          <>
            <div className="table-wrap" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="placeholder">
                        No transactions match the filters.
                      </td>
                    </tr>
                  )}
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{t.date}</td>
                      <td>
                        <span className="chip">{t.category}</span>
                      </td>
                      <td className="muted">{t.description ?? '—'}</td>
                      <td className={`num mono ${t.type === 'INCOME' ? 'tone-positive' : 'tone-negative'}`}>
                        {t.type === 'INCOME' ? '+' : '−'}
                        {formatMoneyPrecise(t.amountCents)}
                      </td>
                      <td className="num">
                        <button
                          className="btn btn-icon"
                          title="Delete"
                          aria-label={`Delete transaction ${t.description ?? t.category}`}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm('Delete this transaction?')) remove.mutate(t.id);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="btn btn-ghost"
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                ← Prev
              </button>
              <span>
                Page {filters.page} of {totalPages}
              </span>
              <button
                className="btn btn-ghost"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
