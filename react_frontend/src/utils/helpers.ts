export const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super admin",
  admin: "Admin",
  manager: "Manager",
  accountant: "Mhasibu",
  deliverylist: "Msafirishaji",
  customer: "Mteja",
  supplier: "Msambazaji",
};

export const STATUS_STEPS = ["Imepokewa", "Inaandaliwa sokoni", "Ipo njiani", "Imefika"];

export const DELIVERY_FEE = 2000;

export function fmt(n: number): string {
  return "TZS " + Math.round(n).toLocaleString("en-US");
}