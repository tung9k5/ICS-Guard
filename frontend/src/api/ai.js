import http from '@/http/clients/api';

export const aiApi = {
  chat: (data) => http.post('/ai/chat', data, { hideLoading: true }),
};
