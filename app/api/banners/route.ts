import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const banners = [
    { id: 1, image: "/banners/quảng cáo 1.jpg", link: "/category/pet", title: "" },
    { id: 2, image: "/banners/quảng cáo 2.jpg", link: "/category/electronics", title: "" },
    { id: 3, image: "/banners/quảng cáo 3.jpg", link: "/category/fashion", title: "" },
  ];

  return NextResponse.json(banners);
}
