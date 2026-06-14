export const fmtRWF = (n) => Number(n || 0).toLocaleString() + ' RWF';

export const fmtDate = (s) => {
  if (!s || s === '—') return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-RW', {
    timeZone: 'Africa/Kigali',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
};

export const showAlert = (setter, msg, type = 'error') => {
  setter({ show: true, message: msg, type });
  setTimeout(() => setter({ show: false, message: '', type }), 6000);
};

export const setLoading = (setter, loading, text) => {
  setter({ loading, text });
};
