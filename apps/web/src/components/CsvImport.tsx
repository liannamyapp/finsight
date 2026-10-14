import { type ChangeEvent, useEffect, useState } from 'react';
import { useImportJob, useRefreshAfterImport, useStartImport } from '../api/hooks';

const SAMPLE_CSV = `date,amount,type,category,description
2026-09-02,12500.00,INCOME,Subscriptions,"Client A, annual plan"
2026-09-05,1840.50,EXPENSE,Cloud,GCP invoice
2026-09-10,3200,EXPENSE,Marketing,LinkedIn campaign
2026-09-15,4800,INCOME,Consulting,Onboarding project
`;

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'finsight-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImport() {
  const [jobId, setJobId] = useState<string | null>(null);
  const start = useStartImport();
  const job = useImportJob(jobId);
  const refresh = useRefreshAfterImport();
  const status = job.data?.status;

  useEffect(() => {
    if (status === 'DONE') void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const created = await start.mutateAsync(await file.text()).catch(() => null);
    if (created) setJobId(created.id);
  };

  const inProgress = start.isPending || status === 'PENDING' || status === 'PROCESSING';
  const progress = job.data?.totalRows ? Math.round((job.data.importedRows / job.data.totalRows) * 100) : 0;

  return (
    <section className="card">
      <h2>Import CSV</h2>
      <p className="muted">
        Columns: <code>date, amount, type, category, description</code>. Large files are processed in the background.
      </p>
      <div className="row">
        <label className={`btn btn-primary ${inProgress ? 'disabled' : ''}`}>
          Choose file
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={inProgress} hidden />
        </label>
        <button type="button" className="btn btn-ghost" onClick={downloadSample}>
          Download sample
        </button>
      </div>

      {start.isError && <p className="error">{start.error?.message}</p>}

      {job.data && (
        <div className="import-status" data-testid="import-status">
          <div>
            Status: <strong>{job.data.status}</strong>
            {job.data.totalRows > 0 && ` · ${job.data.importedRows} imported (${progress}%)`}
          </div>
          {inProgress && (
            <div className="progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}
          {job.data.errors && job.data.errors.length > 0 && (
            <details>
              <summary>{job.data.errors.length} row(s) skipped</summary>
              <ul className="error-list">
                {job.data.errors.map((err) => (
                  <li key={`${err.line}-${err.message}`}>
                    Line {err.line}: {err.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
