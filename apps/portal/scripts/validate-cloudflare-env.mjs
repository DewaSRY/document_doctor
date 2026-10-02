const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (!siteUrl) {
  console.error("Set NEXT_PUBLIC_SITE_URL to the production HTTPS origin before deploying.");
  process.exit(1);
}

try {
  if (new URL(siteUrl).protocol !== "https:") {
    throw new Error("must use HTTPS");
  }
} catch (error) {
  console.error(`Invalid NEXT_PUBLIC_SITE_URL: ${error.message}`);
  process.exit(1);
}