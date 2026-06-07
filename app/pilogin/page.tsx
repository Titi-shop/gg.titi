"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function PiLoginPage() {
  const router = useRouter();
  const { loading, user } = useAuth();

  useEffect(() => {
  if (loading) return;

  if (user) {
    router.replace("/account");
  }
}, [loading, user, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
    </div>
  );
}
