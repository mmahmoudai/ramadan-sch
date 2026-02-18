import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#1e293b",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "60px",
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 20 }}>☪</div>
        <h1
          style={{
            fontSize: 64,
            fontWeight: "bold",
            margin: "0 0 20px 0",
            lineHeight: 1.2,
          }}
        >
          Ramadan Tracker
        </h1>
        <p
          style={{
            fontSize: 28,
            margin: 0,
            opacity: 0.9,
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Track your daily worship, habits, and challenges during Ramadan
        </p>
        <div style={{ marginTop: 40, fontSize: 20, opacity: 0.7 }}>
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
