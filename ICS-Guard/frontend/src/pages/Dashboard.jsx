import React, { useEffect, useState } from 'react';
import authApi from '@/api/auth';
import { Activity, ShieldAlert, Zap } from 'lucide-react';

const Dashboard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authApi.getProfile();
        if (response && response.data) {
          setUser(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
    };
    fetchProfile();
  }, []);

  return (
    <div className="space-y-6">
    </div>
  );
};

export default Dashboard;
