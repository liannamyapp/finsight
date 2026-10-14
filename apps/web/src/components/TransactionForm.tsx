import { type FormEvent, useState } from 'react';
import { useCategories, useCreateTransaction } from '../api/hooks';
import type { TxType } from '../api/types';
import { today } from '../lib/format';

const initial = { date: today(), amount: '', type: 'EXPENSE' as TxType, category: '', description: '' };

export function TransactionForm() {
  const [form, setForm] = useState(initial);
  const create = useCreateTransaction();
  const categories = useCategories();

  const update = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        date: form.date,
        amount: Number(form.amount),
        type: form.type,
        category: form.category.trim(),
        description: form.description.trim() || undefined,
      },
      { onSuccess: () => setForm({ ...initial, date: form.date, type: form.type }) },
    );
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">Add transaction</h2>
      <label>
        Date
        <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} required />
      </label>
      <label>
        Type
        <select value={form.type} onChange={(e) => update('type', e.target.value as TxType)}>
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
      </label>
      <label>
        Amount, USD
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={(e) => update('amount', e.target.value)}
          placeholder="0.00"
          required
        />
      </label>
      <label>
        Category
        <input
          list="category-options"
          value={form.category}
          onChange={(e) => update('category', e.target.value)}
          placeholder="e.g. Cloud"
          maxLength={50}
          required
        />
        <datalist id="category-options">
          {categories.data?.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <label className="span-all">
        Description
        <input
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Optional"
          maxLength={200}
        />
      </label>
      {create.isError && <p className="error span-all">{create.error?.message}</p>}
      <button className="btn btn-primary span-all" disabled={create.isPending}>
        {create.isPending ? 'Saving…' : 'Add transaction'}
      </button>
    </form>
  );
}
