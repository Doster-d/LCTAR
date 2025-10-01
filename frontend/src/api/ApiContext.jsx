import React, { createContext, useContext, useEffect, useMemo } from 'react';
import {
  configureApi,
  normalizeBaseUrl,
  startSession,
  sendViewEvent,
  submitEmail,
  getSessionProgress,
  getPromoBySession,
  getPromoByUser,
  getPromoByEmail,
  getStats,
  getHealth,
} from './api';

const DEFAULT_BASE_URL = 'https://lctar2.duckdns.org/api';

/**
 * Контекст для API функций
 */
const ApiContext = createContext({
  // Базовый URL API
  apiBaseUrl: DEFAULT_BASE_URL,

  // API функции
  startSession,
  sendViewEvent,
  submitEmail,
  getSessionProgress,
  getPromoBySession,
  getPromoByUser,
  getPromoByEmail,
  getStats,
  getHealth,
});

/**
 * Провайдер контекста API
 */
export const ApiProvider = ({ baseUrl, children }) => {
  const effectiveBaseUrl = useMemo(() => {
    const normalizeCandidate = (value) => {
      if (typeof value !== 'string') {
        return '';
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return '';
      }
      return normalizeBaseUrl(trimmed);
    };

    const envRaw = typeof process !== 'undefined'
      ? process.env?.REACT_APP_API_URL ?? process.env?.API_URL ?? ''
      : '';

    const normalizedProp = normalizeCandidate(baseUrl);
    const normalizedEnv = normalizeCandidate(envRaw);

    return normalizedProp || normalizedEnv || normalizeBaseUrl(DEFAULT_BASE_URL);
  }, [baseUrl]);

  useEffect(() => {
    configureApi({ baseUrl: effectiveBaseUrl });
  }, [effectiveBaseUrl]);

  const value = useMemo(() => ({
    apiBaseUrl: effectiveBaseUrl,
    startSession,
    sendViewEvent,
    submitEmail,
    getSessionProgress,
    getPromoBySession,
    getPromoByUser,
    getPromoByEmail,
    getStats,
    getHealth,
  }), [effectiveBaseUrl]);

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

/**
 * Хук для использования API контекста
 */
export const useApiContext = () => {
  const context = useContext(ApiContext);

  if (!context) {
    throw new Error('useApiContext должен использоваться внутри ApiProvider');
  }

  return context;
};