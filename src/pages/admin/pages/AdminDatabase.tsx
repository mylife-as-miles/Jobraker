import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Table,
  Layers,
  Search,
  CheckCircle2,
  X,
  FileText,
  Code,
  Server,
  AlertCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentUserAdminSubRole } from "../../../lib/adminUtils";

// Defined list of core tables to monitor
const CORE_TABLES = [
  "profiles",
  "user_credits",
  "credit_transactions",
  "user_subscriptions",
  "subscription_plans",
  "jobs",
  "applications",
  "resumes",
  "parsed_resumes",
  "notifications",
];

interface TableStat {
  name: string;
  rows: number | null;
  size: string; // Mocked or estimated if not available
  updated: string; // Difficult to get real "last updated" per table easily without system stats
  loading: boolean;
  error?: string;
}

// ─── Database Detail Slide-Over Panel ─────────────────────────────────────
function DatabaseDetailPanel({
  tableName,
  isOpen,
  onClose,
}: {
  tableName: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [sampleRow, setSampleRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tableName) {
      fetchSampleRow(tableName);
    } else {
      setSampleRow(null);
      setError(null);
    }
  }, [isOpen, tableName]);

  const fetchSampleRow = async (table: string) => {
    try {
      setLoading(true);
      setError(null);
      // Fetch 1 row to inspect schema
      const { data, error } = await supabase.from(table).select("*").limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setSampleRow(data[0]);
      } else {
        setSampleRow({}); // Empty table
      }
    } catch (err: any) {
      console.error(`Error fetching sample for ${table}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !tableName) return null;

  const schemaKeys = sampleRow ? Object.keys(sampleRow) : [];

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
          className='w-full max-w-xl h-full bg-background border-l border-brand/20 shadow-2xl overflow-y-auto'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className='p-6 border-b border-brand/10 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10'>
            <div>
              <h2 className='text-xl font-bold text-white flex items-center gap-2'>
                <Table className='w-5 h-5 text-brand' />
                {tableName}
              </h2>
              <p className='text-sm text-gray-400 font-mono text-xs mt-1'>
                Schema Inspector
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
            {loading ? (
              <div className='flex justify-center p-12'>
                <Loader2 className='w-8 h-8 text-brand animate-spin' />
              </div>
            ) : error ? (
              <div className='p-4 bg-brand/10 border border-brand/20 rounded-xl text-brand flex items-center gap-3'>
                <AlertCircle className='w-5 h-5' />
                <div>
                  <p className='font-semibold'>Error fetching schema</p>
                  <p className='text-sm opacity-80'>{error}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Schema Overview */}
                <div className='space-y-4'>
                  <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2'>
                    <Code className='w-4 h-4' /> Column Definitions
                  </h3>
                  <div className='grid grid-cols-1 gap-2'>
                    {schemaKeys.length === 0 ? (
                      <p className='text-gray-500 italic'>
                        No columns found (table might be empty or permissions
                        denied)
                      </p>
                    ) : (
                      schemaKeys.map((key) => (
                        <div
                          key={key}
                          className='flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 hover:border-brand/30 transition-colors'
                        >
                          <div className='flex items-center gap-2'>
                            <div className='w-1.5 h-1.5 rounded-full bg-brand'></div>
                            <span className='text-sm text-gray-200 font-mono'>
                              {key}
                            </span>
                          </div>
                          <span className='text-xs text-gray-500 font-mono'>
                            {typeof sampleRow[key]}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Sample Data JSON */}
                <div className='space-y-4'>
                  <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2'>
                    <FileText className='w-4 h-4' /> Sample Row (JSON)
                  </h3>
                  <div className='relative group'>
                    <pre className='p-4 bg-gray-900 rounded-xl border border-gray-800 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed'>
                      {JSON.stringify(sampleRow, null, 2)}
                    </pre>
                    <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <span className='px-2 py-1 bg-gray-800 rounded text-[10px] text-gray-400'>
                        Read-only view
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AdminDatabase() {
  const supabase = useMemo(() => createClient(), []);

  const [callerSubRole, setCallerSubRole] = useState<'owner' | 'editor' | 'reader' | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [tableStats, setTableStats] = useState<TableStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"name" | "rows">("rows");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail panel state
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const checkRoleAndLoad = async () => {
      setCheckingRole(true);
      const subRole = await getCurrentUserAdminSubRole();
      setCallerSubRole(subRole);
      setCheckingRole(false);
      if (subRole === "owner") {
        fetchTableStats();
      }
    };
    checkRoleAndLoad();
  }, []);

  const fetchTableStats = async () => {
    setLoading(true);
    const stats: TableStat[] = [];

    // Fetch counts in parallel
    await Promise.all(
      CORE_TABLES.map(async (table) => {
        try {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });

          if (error) {
            console.warn(`Could not fetch count for ${table}:`, error);
            stats.push({
              name: table,
              rows: null,
              size: "Unknown",
              updated: "Unknown",
              loading: false,
              error: error.message,
            });
          } else {
            stats.push({
              name: table,
              rows: count,
              size: "Unknown",
              updated: "Unknown",
              loading: false,
            });
          }
        } catch (err) {
          console.warn(`Error processing ${table}:`, err);
          stats.push({
            name: table,
            rows: null,
            size: "Unknown",
            updated: "Unknown",
            loading: false,
            error: "Failed to fetch",
          });
        }
      }),
    );

    setTableStats(stats);
    setLoading(false);
  };

  // ─── Computed Data ──────────────────────────────────────────────────────────

  const totalTables = CORE_TABLES.length;
  const totalRows = tableStats.reduce((sum, t) => sum + (t.rows || 0), 0);
  const availableTables = tableStats.filter((t) => !t.error).length;

  const filteredTables = useMemo(() => {
    return tableStats
      .filter((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const aVal = sortField === "rows" ? a.rows || 0 : a.name;
        const bVal = sortField === "rows" ? b.rows || 0 : b.name;

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortOrder === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return sortOrder === "asc"
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      });
  }, [tableStats, searchTerm, sortField, sortOrder]);

  if (checkingRole) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  if (callerSubRole !== "owner") {
    return (
      <div className='flex items-center justify-center h-[60vh]'>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className='max-w-md w-full text-center space-y-6 p-8 rounded-3xl border border-brand/20 bg-gradient-to-br from-background via-[#111111] to-background shadow-2xl shadow-brand/5'
        >
          <div className='w-20 h-20 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center mx-auto'>
            <Shield className='w-10 h-10 text-brand' />
          </div>
          <div className='space-y-2'>
            <h2 className='text-2xl font-bold text-white'>Access Denied</h2>
            <p className='text-gray-400 text-sm leading-relaxed'>
              You do not have permission to view the database schema or query system. 
              This page is restricted to <span className="text-white font-semibold">Owner</span> admin accounts.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>
          Database Overview
        </h1>
        <p className='text-gray-400'>Monitor database tables and status</p>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <Table className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-brand bg-brand/10 px-2 py-1 rounded-full'>
                Core Tables
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {availableTables} / {totalTables}
            </p>
            <p className='text-sm text-gray-400'>Monitored Tables</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='bg-background border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-blue-500/20 text-blue-400'>
                <Layers className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full'>
                Total Volume
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {loading ? "..." : totalRows.toLocaleString()}
            </p>
            <p className='text-sm text-gray-400'>Total Rows</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='bg-background border border-violet-500/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-violet-500/5 group-hover:bg-violet-500/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-violet-500/20 text-violet-400'>
                <Server className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full'>
                System
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>Postgres</p>
            <p className='text-sm text-gray-400'>Database Engine</p>
          </div>
        </motion.div>
      </div>

      {/* Advanced Tables List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className='bg-background border border-brand/20 rounded-2xl overflow-hidden shadow-2xl shadow-brand/5'
      >
        <div className='p-6 border-b border-brand/20 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <h3 className='text-xl font-bold text-white mb-1'>Core Tables</h3>
            <p className='text-sm text-gray-400'>
              Real-time row counts and schema inspection
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search tables...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:border-brand focus:outline-none w-64 transition-all focus:ring-1 focus:ring-brand'
              />
            </div>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-900/50 border-b border-gray-800'>
              <tr>
                <th
                  className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors'
                  onClick={() => {
                    setSortField("name");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                >
                  Table Name
                </th>
                <th
                  className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors'
                  onClick={() => {
                    setSortField("rows");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                >
                  Row Count
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Status
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
                    colSpan={4}
                    className='px-6 py-12 text-center text-gray-500'
                  >
                    <div className='flex items-center justify-center gap-2'>
                      <Loader2 className='w-5 h-5 animate-spin' />
                      Scanning tables...
                    </div>
                  </td>
                </tr>
              ) : filteredTables.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className='px-6 py-12 text-center text-gray-500'
                  >
                    No tables found.
                  </td>
                </tr>
              ) : (
                filteredTables.map((table, index) => (
                  <motion.tr
                    key={table.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className='hover:bg-gray-800/30 transition-colors group cursor-pointer'
                    onClick={() => {
                      setSelectedTable(table.name);
                      setIsDetailOpen(true);
                    }}
                  >
                    <td className='px-6 py-4'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors'>
                          <Table className='w-4 h-4 text-brand' />
                        </div>
                        <span className='text-white font-mono text-sm'>
                          {table.name}
                        </span>
                      </div>
                    </td>
                    <td className='px-6 py-4 text-right'>
                      {table.rows !== null ? (
                        <span className='text-white font-mono font-bold'>
                          {table.rows.toLocaleString()}
                        </span>
                      ) : (
                        <span className='text-gray-600'>-</span>
                      )}
                    </td>
                    <td className='px-6 py-4'>
                      {table.error ? (
                        <div className='flex items-center gap-1.5 text-brand text-xs'>
                          <AlertCircle className='w-3 h-3' />
                          Error
                        </div>
                      ) : (
                        <div className='flex items-center gap-1.5 text-brand text-xs'>
                          <CheckCircle2 className='w-3 h-3' />
                          Active
                        </div>
                      )}
                    </td>
                    <td className='px-6 py-4 text-right'>
                      <button className='p-2 rounded-lg text-gray-500 hover:text-white hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-all'>
                        <Code className='w-4 h-4' />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <DatabaseDetailPanel
        tableName={selectedTable}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}
