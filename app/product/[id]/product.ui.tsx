import { formatPi } from "@/lib/pi";

export function ProductInfo({ product }: any) {
  return (
    <div className="bg-white p-4 flex justify-between">
      <h2 className="text-lg font-medium">
        {product.name}
      </h2>

      <div className="text-right">
        <p className="text-xl font-bold text-orange-600">
          π {formatPi(product.finalPrice)}
        </p>

        {product.isSale && (
          <p className="text-sm text-gray-400 line-through">
            π {formatPi(product.price)}
          </p>
        )}
      </div>
    </div>
  );
}
