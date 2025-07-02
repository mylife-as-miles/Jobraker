import { useState, useEffect } from 'react';

interface DataPoint {
  name: string;
  value: number;
  timestamp: number;
}

interface MetricData {
  applications: number;
  industries: number;
  interviews: number;
  matchScore: number;
}

export const useRealTimeData = () => {
  const [chartData, setChartData] = useState<DataPoint[]>([
    { name: 'Jul 28', value: 45, timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000 },
    { name: 'Jul 29', value: 52, timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000 },
    { name: 'Jul 30', value: 48, timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 },
    { name: 'Jul 31', value: 61, timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000 },
    { name: 'Aug 01', value: 67, timestamp: Date.now() },
  ]);

  const [metrics, setMetrics] = useState<MetricData>({
    applications: 58,
    industries: 7,
    interviews: 15,
    matchScore: 56,
  });

  const [barData, setBarData] = useState([
    { name: 'Jobs found', value: 104, color: '#3B82F6' },
    { name: 'Applications', value: 58, color: '#1dff00' },
    { name: 'Interviews', value: 15, color: '#F59E0B' },
  ]);

  const [donutData, setDonutData] = useState([
    { name: '1st Iteration', value: 16, color: '#ef4444' },
    { name: '2nd Iteration', value: 36, color: '#f59e0b' },
    { name: '3rd Iteration', value: 48, color: '#1dff00' },
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update chart data with new point
      setChartData(prev => {
        const newData = [...prev];
        const lastPoint = newData[newData.length - 1];
        const variation = (Math.random() - 0.5) * 10;
        const newValue = Math.max(20, Math.min(80, lastPoint.value + variation));
        
        // Add new point and remove oldest if we have more than 5 points
        const now = new Date();
        const newPoint = {
          name: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: Math.round(newValue),
          timestamp: now.getTime(),
        };
        
        newData.push(newPoint);
        if (newData.length > 5) {
          newData.shift();
        }
        
        return newData;
      });

      // Update metrics with small variations
      setMetrics(prev => ({
        applications: Math.max(50, Math.min(70, prev.applications + Math.round((Math.random() - 0.5) * 4))),
        industries: Math.max(5, Math.min(10, prev.industries + Math.round((Math.random() - 0.5) * 2))),
        interviews: Math.max(10, Math.min(25, prev.interviews + Math.round((Math.random() - 0.5) * 3))),
        matchScore: Math.max(45, Math.min(75, prev.matchScore + Math.round((Math.random() - 0.5) * 5))),
      }));

      // Update bar chart data
      setBarData(prev => prev.map(item => ({
        ...item,
        value: Math.max(item.value * 0.8, Math.min(item.value * 1.2, item.value + Math.round((Math.random() - 0.5) * 10)))
      })));

      // Update donut chart data
      setDonutData(prev => {
        const total = 100;
        const variations = prev.map(() => (Math.random() - 0.5) * 8);
        let newValues = prev.map((item, index) => Math.max(10, Math.min(50, item.value + variations[index])));
        
        // Normalize to ensure total is reasonable
        const currentTotal = newValues.reduce((sum, val) => sum + val, 0);
        newValues = newValues.map(val => Math.round((val / currentTotal) * total));
        
        return prev.map((item, index) => ({
          ...item,
          value: newValues[index]
        }));
      });
    }, 3000); // Update every 3 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    chartData,
    metrics,
    barData,
    donutData,
  };
};