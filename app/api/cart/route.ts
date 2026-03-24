export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromBearer();

    console.log("USER:", user);

    if (!user) {
      return NextResponse.json([]);
    }

    const rows = await query(
      `
      select *
      from cart_items
      where buyer_id = $1
      order by created_at desc
      `,
      [user.pi_uid]
    );

    console.log("ROWS:", rows);

    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ CART GET ERROR:", err);
    return NextResponse.json([], { status: 500 });
  }
}
