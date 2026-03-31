export async function getPendingSellerRequest(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("seller_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function createSellerRequest(userId: string) {
  const { error } = await supabaseAdmin
    .from("seller_requests")
    .insert({
      user_id: userId,
      status: "pending",
    });

  if (error) throw error;
}
