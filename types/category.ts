export interface Category {
  id: number;
  key: string;
  name?: string;
  icon?: string | null;
  cover?: string | null;

  product_count?: number;

  is_featured?: boolean;
  sort_order?: number;
}
