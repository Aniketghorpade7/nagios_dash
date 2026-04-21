import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const App = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Change localhost to your server IP if developing locally but pulling from the server
        const response = await axios.get('http://localhost:9090/api/v1/query?query=nagios_host_status');
        const result = response.data.data.result;
        
        // Format the Prometheus JSON for Recharts
        const formattedData = result.map(item => ({
          host: item.metric.host || 'Unknown',
          status: parseInt(item.value[1], 10) // 0 = UP, 1 = DOWN
        }));
        
        setData(formattedData);
      } catch (error) {
        console.error('Error fetching data', error);
      }
    };

    fetchData();
    // Poll every 15 seconds to keep the dashboard live
    const intervalId = setInterval(fetchData, 15000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Live Nagios Host Status</h2>
      <div style={{ height: 400, width: '100%', marginTop: '20px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="host" />
            <YAxis ticks={[0, 1]} domain={[0, 1]} />
            <Tooltip />
            <Bar dataKey="status" fill="#ff4d4d" name="Status (0=UP, 1=DOWN)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default App;