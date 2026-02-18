import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "#1e293b",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "60px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "80px", marginBottom: "20px" }}>☪</div>
        <h1 style={{ fontSize: "64px", fontWeight: "bold", margin: "0 0 20px 0", lineHeight: "1.2" }}>
          Ramadan Tracker
        </h1>
        <p style={{ fontSize: "28px", margin: "0", opacity: 0.9, maxWidth: "800px", lineHeight: "1.4" }}>
          Track your daily worship, habits, and challenges during Ramadan
        </p>
        <div style={{ marginTop: "40px", fontSize: "20px", opacity: 0.7 }}>
          ramadantracker.club
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
