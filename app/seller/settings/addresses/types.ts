export type SellerAddressType =
  | "return"
  | "warehouse"
  | "pickup"
  | "support";

export type SellerAddress = {
  id: string;
  seller_id: string;

  type: SellerAddressType;

  recipient_name: string | null;
  phone: string | null;

  country: string;

  province: string | null;
  district: string | null;
  ward: string | null;

  address_line: string;
  postal_code: string | null;

  is_default: boolean;

  note: string | null;

  created_at: string;
  updated_at: string;
};
