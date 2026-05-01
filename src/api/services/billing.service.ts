import * as http from './http';

export const billingService = {
  getWallet: () => {
    return http.get('/api/billing/wallet');
  },
  getTransactions: () => {
    return http.get('/api/billing/transactions');
  },
  createDeposit: (amount: number) => {
    return http.post('/api/billing/deposit', { amount });
  },
  getActiveGifts: () => {
    return http.get('/api/billing/gifts');
  },
  getAllGifts: () => {
    return http.get('/api/billing/admin/gifts');
  },
  createGift: (data: any) => {
    return http.post('/api/billing/admin/gifts', data);
  },
  donate: (receiverId: string, giftId: string, roomId: string) => {
    return http.post('/api/billing/donate', { receiverId, giftId, roomId });
  },
  getTopDonors: (hostUserId: string) => {
    return http.get(`/api/billing/top-donors/${hostUserId}`);
  },
};
