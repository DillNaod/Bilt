// ─── Design Snapshot: Asset Extractor ────────────────────────────────────────

import type { AssetSnapshot } from "../types.js";

export function extractAssetSnapshot(
  relPath: string,
  content: string,
  legalAnd404: { hasTos: boolean; hasPrivacy: boolean; has404: boolean },
): AssetSnapshot {
  const imgMatches = content.matchAll(
    /<img[^>]*src=["']([^"']+)["'][^>]*>/gi,
  );
  const assetImages: AssetSnapshot["images"] = [];
  for (const match of imgMatches) {
    const src = match[1] || "";
    const fullTag = match[0];
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : undefined;
    const isStock = /unsplash|pexels|stock|placeholder/i.test(src);
    const isAiRobotOrBlob = /robot|ai-avatar|blob|sphere/i.test(src);
    const isScreenshot = /screenshot|dashboard|app-preview/i.test(src);

    assetImages.push({
      src,
      alt,
      isStock,
      isAiRobotOrBlob,
      isScreenshot,
    });
  }

  return {
    file: relPath,
    images: assetImages,
    hasTos: legalAnd404.hasTos,
    hasPrivacyPolicy: legalAnd404.hasPrivacy,
    has404Page: legalAnd404.has404,
  };
}
