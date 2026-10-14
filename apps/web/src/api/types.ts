export type TxType = 'INCOME' | 'EXPENSE';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Transaction {
  id: string;
  date: string;
  amountCents: number;
  type: TxType;
  category: string;
  description: string | null;
}

export interface NewTransaction {
  date: string;
  amount: number;
  type: TxType;
  category: string;
  description?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MonthlyPoint {
  month: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export interface CategoryPoint {
  category: string;
  amountCents: number;
  sharePct: number;
}

export interface Summary {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  marginPct: number | null;
  momIncomeChangePct: number | null;
  monthly: MonthlyPoint[];
  expenseByCategory: CategoryPoint[];
  topExpenseCategory: string | null;
}

export interface Insight {
  level: 'info' | 'warning' | 'positive';
  title: string;
  text: string;
}

export interface InsightsResponse {
  source: 'llm' | 'rules';
  insights: Insight[];
}

export type ImportStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface ImportJob {
  id: string;
  status: ImportStatus;
  totalRows: number;
  importedRows: number;
  errors: { line: number; message: string }[] | null;
  createdAt: string;
  finishedAt: string | null;
}
