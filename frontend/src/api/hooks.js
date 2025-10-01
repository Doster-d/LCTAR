import {
  useApi,
  useApiCall,
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

/**
 * Хук для запуска сессии
 */
export const useStartSession = () => {
  return useApi(startSession);
};

/**
 * Хук для отправки события просмотра
 */
export const useSendViewEvent = () => {
  return useApiCall(sendViewEvent);
};

/**
 * Хук для отправки email
 */
export const useSubmitEmail = () => {
  return useApiCall(submitEmail);
};

/**
 * Хук для получения прогресса сессии
 */
export const useSessionProgress = () => {
  return useApi(getSessionProgress);
};

/**
 * Хук для получения промо по сессии
 */
export const usePromoBySession = () => {
  return useApi(getPromoBySession);
};

/**
 * Хук для получения промо по пользователю
 */
export const usePromoByUser = () => {
  return useApi(getPromoByUser);
};

/**
 * Хук для получения промо по email
 */
export const usePromoByEmail = () => {
  return useApi(getPromoByEmail);
};

/**
 * Хук для получения статистики
 */
export const useStats = () => {
  return useApi(getStats);
};

/**
 * Хук для проверки здоровья сервиса
 */
export const useHealth = () => {
  return useApi(getHealth);
};