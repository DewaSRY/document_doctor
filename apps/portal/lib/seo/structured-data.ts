import type { AppLocale } from "@/i18n/settings";
import { SITE_NAME, SITE_URL } from "@/lib/seo/metadata";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

type Breadcrumb = { name: string; url: string };
type FaqItem = { question: string; answer: string };

export function graph(nodes: readonly unknown[]) {
	return {
		"@context": "https://schema.org",
		"@graph": nodes,
	};
}

export function siteNodes(locale: AppLocale) {
	return [
		{
			"@type": "Organization",
			"@id": ORGANIZATION_ID,
			name: SITE_NAME,
			url: SITE_URL,
		},
		{
			"@type": "WebSite",
			"@id": WEBSITE_ID,
			name: SITE_NAME,
			url: SITE_URL,
			inLanguage: locale,
			publisher: { "@id": ORGANIZATION_ID },
		},
	];
}

export function breadcrumbNode(items: readonly Breadcrumb[]) {
	return {
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

export function faqNode(locale: AppLocale, items: readonly FaqItem[]) {
	return {
		"@type": "FAQPage",
		inLanguage: locale,
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};
}
