import api from './api';
import { Order } from '../types';

export const orderService = {
  getAllOrders: async (): Promise<Order[]> => {
    const response = await api.get('/orders');
    return response.data;
  },
  createOrder: async (order: Partial<Order>): Promise<Order> => {
    const response = await api.post('/orders', order);
    return response.data;
  },
  updateOrderStatus: async (id: string, status: number): Promise<Order> => {
    const response = await api.patch(`/orders/${id}/status`, { status });
    return response.data;
  },
};