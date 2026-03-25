// src/hooks/useMemoryMonitor.js
import { useState, useEffect, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/tauri"

export const useMemoryMonitor = (interval = 5000) => {
  const [memoryInfo, setMemoryInfo] = useState({
    totalMemory: 0,
    usedMemory: 0,
    processMemory: 0,
    percentage: 0,
    warning: false
  });

  const checkMemory = useCallback(async () => {
    try {
      const [total, used, process] = await Promise.all([
        invoke('get_system_memory'),
        invoke('get_memory_usage'),
        invoke('get_process_memory')
      ]);

      const percentage = (used / total) * 100;
      const warning = percentage > 85;

      setMemoryInfo({
        totalMemory: total,
        usedMemory: used,
        processMemory: process,
        percentage: percentage.toFixed(2),
        warning
      });

      if (warning) {
        console.warn('High memory usage detected:', percentage.toFixed(2) + '%');
      }
    } catch (error) {
      console.error('Failed to check memory:', error);
    }
  }, []);

  useEffect(() => {
    checkMemory();
    const intervalId = setInterval(checkMemory, interval);
    return () => clearInterval(intervalId);
  }, [checkMemory, interval]);

  return { memoryInfo, checkMemory };
};

export const validateFileSize = async (fileSize) => {
  try {
    const result = await invoke('validate_file_size', { fileSize });
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error?.message || String(error) };
  }
};

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};