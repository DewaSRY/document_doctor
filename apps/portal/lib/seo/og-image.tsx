import { ImageResponse } from "next/og";
import { SITE_NAME } from "./metadata";

const size = { width: 1200, height: 630 };

export function renderOgImage({
  title,
  accent,
  chips,
}: {
  title: string;
  accent?: string;
  chips: string[];
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "#17211d",
          background: "linear-gradient(135deg, #f4f7f2 0%, #ffffff 58%, #e6f1e9 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, fontWeight: 700 }}>
          <div
            style={{
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              color: "white",
              background: "#28734b",
            }}
          >
            D
          </div>
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1020 }}>
          <div style={{ fontSize: 68, lineHeight: 1.08, fontWeight: 700 }}>{title}</div>
          {accent ? (
            <div style={{ fontSize: 68, lineHeight: 1.08, fontWeight: 700, color: "#28734b" }}>
              {accent}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {chips.map((chip, index) => (
            <div
              key={`${chip}-${index}`}
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid #c9d8ce",
                background: "rgba(255, 255, 255, 0.78)",
                color: "#345442",
                fontSize: 21,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}