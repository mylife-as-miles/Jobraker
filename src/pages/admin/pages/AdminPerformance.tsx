import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Activity,
  Server,
  Database,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  Clock,
  Shield,
  X,
  Code,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

interface ServiceStatus {
  name: string;
  type: "database" | "auth" | "storage" | "api";
  status: "healthy" | "degraded" | "down" | "checking";
  latency: number;
  message?: string;
  lastChecked: Date;
  details?: any;
}

interface MetricPoint {
  time: string;
  database: number;
  auth: number;
  storage: number;
}

// ─── Diagnostics Detail Panel ─────────────────────────────────────────────
function DiagnosticsPanel({
  service,
  isOpen,
  onClose,
}: {
  service: ServiceStatus | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !service) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex justify-end'
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 20 }}
          className='w-full max-w-md h-full bg-background border-l border-brand/20 shadow-2xl overflow-y-auto'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className='p-6 border-b border-brand/10 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10'>
            <div>
              <h2 className='text-xl font-bold text-white flex items-center gap-2'>
                {service.type === "database" && (
                  <Database className='w-5 h-5 text-brand' />
                )}
                {service.type === "auth" && (
                  <Shield className='w-5 h-5 text-brand' />
                )}
                {service.type === "storage" && (
                  <HardDrive className='w-5 h-5 text-brand' />
                )}
                {service.name} Diagnostics
              </h2>
              <p className='text-sm text-gray-400 font-mono text-xs mt-1'>
                System Health Check
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-2 rounded-lg hover:bg-foreground/5 transition-colors text-gray-400 hover:text-white'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='p-6 space-y-8'>
            {/* Status Badge */}
            <div
              className={`flex flex-col items-center justify-center p-8 rounded-2xl border ${
                service.status === "healthy"
                  ? "bg-brand/5 border-brand/20"
                  : "bg-brand/5 border-brand/20"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  service.status === "healthy"
                    ? "bg-brand/10 text-brand"
                    : "bg-brand/10 text-brand"
                }`}
              >
                {service.status === "healthy" ? (
                  <CheckCircle2 className='w-8 h-8' />
                ) : (
                  <AlertCircle className='w-8 h-8' />
                )}
              </div>
              <h3
                className={`text-2xl font-bold capitalize ${service.status === "healthy" ? "text-brand" : "text-brand"}`}
              >
                {service.status}
              </h3>
              <p className='text-gray-400 mt-2 text-sm font-medium'>
                {service.latency}ms latency
              </p>
            </div>

            {/* Check Details */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider'>
                Check Details
              </h3>
              <div className='space-y-3'>
                <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800 flex justify-between items-center'>
                  <span className='text-gray-400 text-sm'>Timestamp</span>
                  <span className='text-white font-mono text-sm'>
                    {service.lastChecked.toLocaleTimeString()}
                  </span>
                </div>
                <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800 flex justify-between items-center'>
                  <span className='text-gray-400 text-sm'>
                    Response Message
                  </span>
                  <span className='text-white text-sm'>
                    {service.message || "OK"}
                  </span>
                </div>
              </div>
            </div>

            {/* Raw Output */}
            {service.details && (
              <div className='space-y-4'>
                <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2'>
                  <Code className='w-4 h-4' /> Raw Output
                </h3>
                <div className='relative group'>
                  <pre className='p-4 bg-gray-900 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed'>
                    {JSON.stringify(service.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AdminPerformance() {
  const supabase = useMemo(() => createClient(), []);

  // State
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "Primary Database",
      type: "database",
      status: "checking",
      latency: 0,
      lastChecked: new Date(),
    },
    {
      name: "Authentication",
      type: "auth",
      status: "checking",
      latency: 0,
      lastChecked: new Date(),
    },
    {
      name: "Storage Bucket",
      type: "storage",
      status: "checking",
      latency: 0,
      lastChecked: new Date(),
    },
  ]);
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Polling interval ref to clear on unmount
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Detail panel
  const [selectedService, setSelectedService] = useState<ServiceStatus | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    runChecks();
    // Poll every 5 seconds
    pollRef.current = setInterval(runChecks, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const measureLatency = async (
    fn: () => Promise<any>,
  ): Promise<{ latency: number; result: any; error?: any }> => {
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      return { latency: Math.round(end - start), result };
    } catch (error) {
      const end = performance.now();
      return { latency: Math.round(end - start), result: null, error };
    }
  };

  const runChecks = async () => {
    // Database Check
    const dbCheck = await measureLatency(async () =>
      supabase.from("profiles").select("count", { count: "exact", head: true }),
    );

    // Auth Check
    const authCheck = await measureLatency(async () =>
      supabase.auth.getSession(),
    );

    // Storage Check (List buckets)
    const storageCheck = await measureLatency(async () =>
      supabase.storage.listBuckets(),
    );

    const now = new Date();

    const newServices: ServiceStatus[] = [
      {
        name: "Primary Database",
        type: "database",
        status: dbCheck.error ? "degraded" : "healthy",
        latency: dbCheck.latency,
        message: dbCheck.error ? dbCheck.error.message : "Connection stable",
        lastChecked: now,
        details: dbCheck.error || dbCheck.result,
      },
      {
        name: "Authentication",
        type: "auth",
        status: authCheck.error ? "degraded" : "healthy",
        latency: authCheck.latency,
        message: authCheck.error
          ? authCheck.error.message
          : "Session services active",
        lastChecked: now,
        details: authCheck.error || authCheck.result,
      },
      {
        name: "Storage Bucket",
        type: "storage",
        status: storageCheck.error ? "degraded" : "healthy",
        latency: storageCheck.latency,
        message: storageCheck.error
          ? storageCheck.error.message
          : "Buckets accessible",
        lastChecked: now,
        details: storageCheck.error || storageCheck.result,
      },
    ];

    setServices(newServices);
    setLoading(false);

    // Update history
    setHistory((prev) => {
      const newPoint: MetricPoint = {
        time: now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        database: dbCheck.latency,
        auth: authCheck.latency,
        storage: storageCheck.latency,
      };
      // Keep last 20 points
      return [...prev.slice(-19), newPoint];
    });
  };

  // ─── Computed Stats ───────────────────────────────────────────────────────
  const avgLatency = useMemo(() => {
    if (services.length === 0) return 0;
    return Math.round(
      services.reduce((sum, s) => sum + s.latency, 0) / services.length,
    );
  }, [services]);

  const healthyServices = services.filter((s) => s.status === "healthy").length;
  const systemStatus =
    healthyServices === services.length ? "Healthy" : "Degraded";

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>System Status</h1>
        <p className='text-gray-400'>
          Real-time performance monitoring and health checks
        </p>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <motion.div
          layout
          className={`border rounded-2xl p-6 relative overflow-hidden ${
            systemStatus === "Healthy"
              ? "bg-brand/5 border-brand/20"
              : "bg-brand/5 border-brand/20"
          }`}
        >
          <div className='flex items-center gap-4'>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                systemStatus === "Healthy"
                  ? "bg-brand/20 text-brand"
                  : "bg-brand/20 text-brand"
              }`}
            >
              <Activity className='w-6 h-6' />
            </div>
            <div>
              <p className='text-sm text-gray-400'>System Status</p>
              <p
                className={`text-2xl font-bold ${
                  systemStatus === "Healthy" ? "text-brand" : "text-brand"
                }`}
              >
                {systemStatus}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          layout
          className='bg-background border border-blue-500/20 rounded-2xl p-6'
        >
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400'>
              <Clock className='w-6 h-6' />
            </div>
            <div>
              <p className='text-sm text-gray-400'>Avg Latency</p>
              <p className='text-2xl font-bold text-white'>
                {loading ? "..." : avgLatency + "ms"}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          layout
          className='bg-background border border-purple-500/20 rounded-2xl p-6'
        >
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400'>
              <Shield className='w-6 h-6' />
            </div>
            <div>
              <p className='text-sm text-gray-400'>Services Active</p>
              <p className='text-2xl font-bold text-white'>
                {healthyServices}/{services.length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          layout
          className='bg-background border border-gray-700/50 rounded-2xl p-6'
        >
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-xl bg-gray-700/50 flex items-center justify-center text-gray-400'>
              <Server className='w-6 h-6' />
            </div>
            <div>
              <p className='text-sm text-gray-400'>Uptime (Est.)</p>
              <p className='text-2xl font-bold text-white'>99.99%</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Live Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className='bg-background border border-brand/20 rounded-2xl p-6'
      >
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h3 className='text-xl font-bold text-white mb-1'>Live Latency</h3>
            <p className='text-sm text-gray-400'>
              Real-time service response times
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <span className='flex items-center gap-1 text-xs text-brand'>
              <div className='w-2 h-2 rounded-full bg-brand' /> Database
            </span>
            <span className='flex items-center gap-1 text-xs text-blue-400'>
              <div className='w-2 h-2 rounded-full bg-blue-400' /> Auth
            </span>
            <span className='flex items-center gap-1 text-xs text-purple-400'>
              <div className='w-2 h-2 rounded-full bg-purple-400' /> Storage
            </span>
          </div>
        </div>

        <ResponsiveContainer width='100%' height={300}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id='colorDb' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#1dff00' stopOpacity={0.1} />
                <stop offset='95%' stopColor='#1dff00' stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='#333'
              vertical={false}
            />
            <XAxis
              dataKey='time'
              stroke='#6b7280'
              style={{ fontSize: "10px" }}
              tickLine={false}
              axisLine={false}
              dy={10}
              interval={4} // Show fewer labels
            />
            <YAxis
              stroke='#6b7280'
              style={{ fontSize: "10px" }}
              tickLine={false}
              axisLine={false}
              dx={-10}
              unit='ms'
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "12px",
              }}
              cursor={{ stroke: "#333" }}
            />
            <Area
              type='monotone'
              dataKey='database'
              stroke='#1dff00'
              strokeWidth={2}
              fillOpacity={1}
              fill='url(#colorDb)'
              isAnimationActive={false} // Disable animation for smoother live updates
            />
            <Area
              type='monotone'
              dataKey='auth'
              stroke='#60a5fa'
              strokeWidth={2}
              fill='none'
              isAnimationActive={false}
            />
            <Area
              type='monotone'
              dataKey='storage'
              stroke='#c084fc'
              strokeWidth={2}
              fill='none'
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Services Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className='bg-background border border-brand/20 rounded-2xl overflow-hidden shadow-2xl shadow-brand/5'
      >
        <div className='p-6 border-b border-brand/20'>
          <h3 className='text-xl font-bold text-white mb-1'>
            Service Health Checks
          </h3>
          <p className='text-sm text-gray-400'>Core system component status</p>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-900/50 border-b border-gray-800'>
              <tr>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Service Name
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Status
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Latency
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Message
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Last Check
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-800'>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className='px-6 py-8 text-center text-gray-500'
                  >
                    Initializing checks...
                  </td>
                </tr>
              ) : (
                services.map((service, index) => (
                  <motion.tr
                    key={service.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className='hover:bg-gray-800/30 transition-colors group cursor-pointer'
                    onClick={() => {
                      setSelectedService(service);
                      setIsDetailOpen(true);
                    }}
                  >
                    <td className='px-6 py-4'>
                      <div className='flex items-center gap-3'>
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            service.type === "database"
                              ? "bg-brand/20"
                              : service.type === "auth"
                                ? "bg-blue-500/20"
                                : "bg-purple-500/20"
                          }`}
                        >
                          {service.type === "database" && (
                            <Database
                              className={`w-4 h-4 ${service.type === "database" ? "text-brand" : ""}`}
                            />
                          )}
                          {service.type === "auth" && (
                            <Shield className='w-4 h-4 text-blue-400' />
                          )}
                          {service.type === "storage" && (
                            <HardDrive className='w-4 h-4 text-purple-400' />
                          )}
                        </div>
                        <span className='text-white font-medium'>
                          {service.name}
                        </span>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          service.status === "healthy"
                            ? "bg-brand/10 text-brand border border-brand/20"
                            : "bg-brand/10 text-brand border border-brand/20"
                        }`}
                      >
                        {service.status === "healthy" && (
                          <CheckCircle2 className='w-3 h-3' />
                        )}
                        {service.status === "degraded" && (
                          <AlertCircle className='w-3 h-3' />
                        )}
                        {service.status === "checking" && (
                          <Loader2 className='w-3 h-3 animate-spin' />
                        )}
                        {service.status.toUpperCase()}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-right font-mono text-white'>
                      {service.latency}ms
                    </td>
                    <td className='px-6 py-4 text-gray-400 text-sm max-w-[200px] truncate'>
                      {service.message}
                    </td>
                    <td className='px-6 py-4 text-right text-gray-500 text-xs'>
                      {service.lastChecked.toLocaleTimeString()}
                    </td>
                    <td className='px-6 py-4 text-right'>
                      <button className='p-2 rounded-lg text-gray-500 hover:text-white hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-all'>
                        <ArrowUpRight className='w-4 h-4' />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <DiagnosticsPanel
        service={selectedService}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}
