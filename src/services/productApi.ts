// @ts-nocheck
// src/services/productApi.ts
// Placeholder for productApi – adjust as needed
export const productApi = {
  index: (params?: any) => Promise.resolve({ data: { data: [] } }),
  store: (data: any) => Promise.resolve({ data: {} }),
  update: (id: string, data: any) => Promise.resolve({ data: {} }),
  destroy: (id: string) => Promise.resolve({ data: {} }),
  restore: (id: string) => Promise.resolve({ data: {} }),
  forceDelete: (id: string) => Promise.resolve({ data: {} }),
  changeStatus: (id: string, status: string) => Promise.resolve({ data: {} }),
  getPurchaseInfo: (params: any) => Promise.resolve({ data: { data: [] } })
};

export const categoryApi = {
  dropdown: () => Promise.resolve({ data: [] })
};

export const shopApi = {
  dropdown: () => Promise.resolve({ data: [] })
};

export const companyApi = {
  dropdown: () => Promise.resolve({ data: [] })
};
