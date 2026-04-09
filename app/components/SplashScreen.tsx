
"use client";

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex items-center justify-center transition-opacity duration-500">
      
      <div className="relative w-24 h-24 flex items-center justify-center">
        
        {/* vòng quay */}
        <div className="absolute inset-0 rounded-full border-4 border-orange-200 border-t-orange-500 border-r-pink-500 animate-spin"></div>

        {/* logo */}
        <img
          src="/logo.png"
          alt="logo"
          className="w-12 h-12 object-contain animate-pulse"
        />
      </div>

    </div>
  );
}
