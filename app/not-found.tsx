export default function NotFound() {
  return (
    <div style={{
      padding: "60px 20px",
      textAlign: "center",
      background: "#0d0d0d",
      color: "#fff",
      minHeight: "100vh"
    }}>
      <h1 style={{ fontSize: "48px", fontWeight: "bold", marginBottom: "10px" }}>
        404 – Không tìm thấy trang
      </h1>

      <p style={{ fontSize: "18px", color: "#bbb", marginBottom: "30px" }}>
        Trang bạn tìm kiếm không tồn tại hoặc đã được di chuyển.
      </p>

      <a
        href="/"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          backgroundColor: "#f97316",
          color: "#fff",
          fontSize: "16px",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        ← Về trang chủ
      </a>
    </div>
  );
}
