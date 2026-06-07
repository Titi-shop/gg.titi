export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("districtCode");

  const res = await fetch(
    `https://provinces.open-api.vn/api/d/${code}?depth=2`
  );

  const data = await res.json();
  return Response.json(data.wards || []);
}
