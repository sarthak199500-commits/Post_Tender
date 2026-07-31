import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

/**
 * Catch-all for unmatched URLs. Without this, React Router matched nothing and rendered
 * an empty tree, so any stale link or typo produced a blank white page with no way back.
 */
export const NotFound = () => {
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);

  const home =
    user?.role === 'Admin' || user?.role === 'PMU' ? '/admin/dashboard'
      : user?.role === 'Vendor' ? '/vendor/dashboard'
        : user?.role === 'Inspector' ? '/inspector/dashboard'
          : user?.role === 'Department' ? '/department/dashboard'
            : user?.role === 'Finance' ? '/finance/dashboard'
              : '/login';

  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
      <div className="text-6xl font-black text-slate-200 tracking-tight mb-2">404</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Page not found</h1>
      <p className="text-slate-600 max-w-md mb-8">
        Nothing is mapped to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-semibold text-slate-700">{location.pathname}</code>.
        The link may be out of date.
      </p>
      <Link
        to={home}
        className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-card font-bold transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
};
