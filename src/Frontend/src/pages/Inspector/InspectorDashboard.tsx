import { fetchInspectorDashboard } from '../../api/dashboardService';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../../store';
import axiosInstance from '../../api/axiosInstance';

const InspectorDashboard: React.FC = () => {
    const { user, token } = useSelector((state: RootState) => state.auth);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        assignedWorkOrders: 0,
        pendingReviews: 0,
        upcomingVisits: 0
    });
    const [upcomingVisitsList, setUpcomingVisitsList] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);


    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const data = await fetchInspectorDashboard();
                setStats({
                    assignedWorkOrders: data.kpis.pendingVisits,
                    pendingReviews: data.kpis.completedVisits,
                    upcomingVisits: data.kpis.upcomingWeek
                });
                setUpcomingVisitsList(data.upcomingSchedule);
                setRecentActivity(data.recentVisits);
            } catch (error) {
                console.error("Error fetching inspector dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchDashboardData();
        }
    }, [token]);

    if (loading) {
        return <div className="p-8 flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>;
    }

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <header className="mb-10">
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Inspector Dashboard</h1>
                <p className="text-slate-600 mt-2 text-lg">Welcome back, <span className="text-blue-700 font-bold">{user?.name}</span>. Here's your oversight overview.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <StatCard title="Assigned Work Orders" value={stats.assignedWorkOrders} icon="📋" color="blue" link="/inspector/work-orders" />
                <StatCard title="Pending Reviews" value={stats.pendingReviews} icon="📈" color="orange" link="/inspector/progress-review" />
                <StatCard title="Upcoming Visits" value={stats.upcomingVisits} icon="🗓️" color="emerald" link="/inspector/visits" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span>🗓️</span> Upcoming Inspection Visits
                    </h2>
                    <div className="space-y-4">
                        {upcomingVisitsList.length > 0 ? upcomingVisitsList.map((visit, index) => (
                            <VisitItem 
                                key={index}
                                date={new Date(visit.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} 
                                time={new Date(visit.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                location={visit.location} 
                                status={visit.status} 
                            />
                        )) : (
                            <p className="text-slate-600 text-sm italic">No upcoming visits scheduled.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <span>🔔</span> Recent Activity
                    </h2>
                    <div className="space-y-4">
                        {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
                            <ActivityItem 
                                key={index}
                                text={`${activity.entityName}: ${activity.changesInfo}`} 
                                time={new Date(activity.timestamp).toLocaleDateString()} 
                            />
                        )) : (
                            <p className="text-slate-600 text-sm italic">No recent activity found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color, link }: any) => (
    <Link to={link} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all hover:-translate-y-1 block">
        <div className="flex justify-between items-start mb-4">
            <span className="text-4xl">{icon}</span>
            <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded bg-${color}-50 text-${color}-700`}>Overview</span>
        </div>
        <div className="text-4xl font-black text-slate-900 mb-1">{value}</div>
        <div className="text-slate-600 font-bold text-sm">{title}</div>
    </Link>
);

const VisitItem = ({ date, time, location, status }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center gap-4">
            <div className="bg-white px-3 py-2 rounded-lg text-center shadow-sm border border-slate-100">
                <div className="text-[10px] font-black text-blue-700 uppercase leading-none">{date.split(' ')[1]}</div>
                <div className="text-lg font-black text-slate-800 leading-none">{date.split(' ')[0]}</div>
            </div>
            <div>
                <div className="font-bold text-slate-800">{location}</div>
                <div className="text-xs text-slate-600">{time}</div>
            </div>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
            status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
        }`}>{status}</span>
    </div>
);

const ActivityItem = ({ text, time }: any) => (
    <div className="flex gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors">
        <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
        <div>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">{text}</p>
            <span className="text-[10px] text-slate-600 font-bold">{time}</span>
        </div>
    </div>
);

export default InspectorDashboard;

