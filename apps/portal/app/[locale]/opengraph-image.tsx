import { ImageResponse } from "next/og";
import { isAppLocale, defaultLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { SITE_NAME } from "@/lib/seo/metadata";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — simple AI tools for documents`;

// Satori doesn't understand oklch(), so the brand tokens are repeated here as hex.
const BRAND = "#c8252c";
const INK = "#1f1c1a";
const MUTED = "#6b6560";
const BRAND_DARK = "#8f1c20";
const BRAND_SOFT = "#fdf1f0";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : defaultLocale;
  const { t } = await getTranslation(locale, "landing");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#fdfcfb",
          borderTop: `16px solid ${BRAND}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Same platypus-in-a-red-hat mark as components/brand-logo.tsx. */}
          <svg width="72" height="72" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill={BRAND_SOFT} />
            <circle cx="16" cy="19" r="8.5" fill="#9a6848" />
            <circle cx="12.6" cy="17.4" r="1.15" fill="#2a2522" />
            <circle cx="19.4" cy="17.4" r="1.15" fill="#2a2522" />
            <ellipse cx="16" cy="23.2" rx="7.6" ry="3.3" fill="#3f3a36" />
            <g transform="rotate(-10 16 11)">
              <ellipse cx="16" cy="11.6" rx="8.2" ry="1.7" fill={BRAND_DARK} />
              <path
                d="M11.2 11.4V5.6a1.6 1.6 0 0 1 1.6-1.6h6.4a1.6 1.6 0 0 1 1.6 1.6v5.8Z"
                fill={BRAND}
              />
              <path d="M11.2 9.4h9.6v1.9h-9.6Z" fill={BRAND_DARK} />
              <path
                d="M16 5.2v3M14.5 6.7h3"
                stroke="white"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </g>
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, color: INK }}>
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {t("hero.title")}
          </div>
          <div style={{ fontSize: 40, color: BRAND, fontWeight: 600 }}>
            {t("hero.titleAccent")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {(t("hero.trust", { returnObjects: true }) as unknown as string[]).map(
            (item) => (
              <div
                key={item}
                style={{
                  fontSize: 26,
                  color: MUTED,
                  border: "2px solid #e8e4e0",
                  borderRadius: 999,
                  padding: "10px 24px",
                }}
              >
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    size,
  );
}
