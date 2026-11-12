export default function AppStatus({ title, children, loading = false }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <section className="max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-8 text-center" role={loading ? 'status' : 'alert'}>
      <p className="text-indigo-600 font-semibold mb-3">Balance</p>
      <h1 className="text-xl font-semibold text-slate-900 mb-3">{title}</h1>
      <div className="text-slate-600 space-y-4">{children}</div>
      {loading && <div className="mx-auto mt-5 w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />}
    </section>
  </div>;
}
