import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    // Electronics
    {
      id: 1,
      key: "electronics",
      icon: "📱",
    },
    {
      id: 2,
      key: "smartphones",
      icon: "📲",
    },
    {
      id: 3,
      key: "computers",
      icon: "💻",
    },
    {
      id: 4,
      key: "gaming",
      icon: "🎮",
    },
    {
      id: 5,
      key: "cameras",
      icon: "📷",
    },

    // Fashion
    {
      id: 6,
      key: "mens_fashion",
      icon: "👔",
    },
    {
      id: 7,
      key: "womens_fashion",
      icon: "👗",
    },
    {
      id: 8,
      key: "kids_fashion",
      icon: "🧒",
    },
    {
      id: 9,
      key: "shoes_bags",
      icon: "👟",
    },
    {
      id: 10,
      key: "watches_jewelry",
      icon: "⌚",
    },

    // Beauty
    {
      id: 11,
      key: "beauty",
      icon: "💄",
    },
    {
      id: 12,
      key: "perfume",
      icon: "🌸",
    },
    {
      id: 13,
      key: "skincare",
      icon: "🧴",
    },
    {
      id: 14,
      key: "makeup",
      icon: "💋",
    },

    // Food
    {
      id: 15,
      key: "food_beverages",
      icon: "🍔",
    },
    {
      id: 16,
      key: "groceries",
      icon: "🛒",
    },
    {
      id: 17,
      key: "snacks",
      icon: "🍪",
    },
    {
      id: 18,
      key: "coffee_tea",
      icon: "☕",
    },

    // Health
    {
      id: 19,
      key: "health_wellness",
      icon: "❤️",
    },
    {
      id: 20,
      key: "vitamins",
      icon: "💊",
    },

    // Sports
    {
      id: 21,
      key: "sports_outdoors",
      icon: "⚽",
    },

    // Home
    {
      id: 22,
      key: "home_kitchen",
      icon: "🏠",
    },
    {
      id: 23,
      key: "furniture",
      icon: "🛋️",
    },
    {
      id: 24,
      key: "home_decor",
      icon: "🖼️",
    },
    {
      id: 25,
      key: "appliances",
      icon: "🔌",
    },

    // Family
    {
      id: 26,
      key: "mother_baby",
      icon: "👶",
    },
    {
      id: 27,
      key: "toys_hobbies",
      icon: "🧸",
    },

    // Pets
    {
      id: 28,
      key: "pet_supplies",
      icon: "🐶",
    },

    // Automotive
    {
      id: 29,
      key: "automotive",
      icon: "🚗",
    },

    // Books & Office
    {
      id: 30,
      key: "books",
      icon: "📚",
    },
    {
      id: 31,
      key: "office_supplies",
      icon: "📝",
    },

    // Travel
    {
      id: 32,
      key: "travel_accessories",
      icon: "✈️",
    },

    // Luxury
    {
      id: 33,
      key: "luxury",
      icon: "💎",
    },

    // Digital
    {
      id: 34,
      key: "digital_products",
      icon: "🌐",
    },

    // Gifts
    {
      id: 35,
      key: "gift_ideas",
      icon: "🎁",
    },
  ]);
}
