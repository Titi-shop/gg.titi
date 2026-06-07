export async function GET() {
  const res = await fetch("https://provinces.open-api.vn/api/p/");
  const data = await res.json();
  return Response.json(data);
}
