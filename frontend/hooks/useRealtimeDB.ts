import { useState, useEffect, useCallback } from 'react';
import { getDB } from '../services/db.ts';

export const useRealtimeDB = () => {
  const [data, setData] = useState(getDB());

  const handleUpdate = useCallback(() => {
    setData(getDB());
  }, []);

  useEffect(() => {
    window.addEventListener('edusync-db-update', handleUpdate);
    handleUpdate(); // Force sync on mount just in case
    return () => {
      window.removeEventListener('edusync-db-update', handleUpdate);
    };
  }, [handleUpdate]);

  return data;
};
