"use client";

import BannerCarousel from "../components/BannerCarousel";

export default function AdsPage() {
  return (
    <main className="bg-gray-50 min-h-screen w-full">
      {/* Tiêu đề */}
      <h1 className="text-xl font-semibold text-center text-red-600 py-4">
        🎉 Ưu đãi đặc biệt hôm nay 🎉
      </h1>

      {/* Banner chạy tự động */}
      <div className="w-full">
        <BannerCarousel />
      </div>

      {/* Danh sách ưu đãi */}
      <section className="mt-6 space-y-3 text-center px-3">
        <h2 className="text-lg font-semibold text-gray-800">
          🔥 Chương trình nổi bật
        </h2>

        <ul className="space-y-2 text-sm text-gray-700">
          <li>🎁 Mua 1 tặng 1 – Áp dụng đến 10/11</li>
          <li>🚚 Miễn phí vận chuyển toàn quốc</li>
          <li>💰 Hoàn 5% Pi cho đơn hàng từ 0.05 Pi</li>
          <li>🎊 Voucher giảm thêm 10% cho thành viên mới</li>
        </ul>
      </section>
    </main>
  );
}
