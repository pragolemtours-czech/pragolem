import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getFAQItems } from "@/lib/api/faq";
import { getGuides } from "@/lib/api/guides";
import { getAggregateRating, getReviews } from "@/lib/api/reviews";
import { getSiteConfig } from "@/lib/api/site-config";
import { getTours } from "@/lib/api/tours";
import { getSiteUrl } from "@/lib/env";
import { toLocaleCode } from "@/lib/helpers/page-helpers";
import { FAQSection } from "./faq-section";
import { FinalCtaSection } from "./final-cta-section";
import { GuidesSection } from "./guides-section";
import { HeroSection } from "./hero-section";
import { HowItWorksSection } from "./how-it-works-section";
import { ReviewsSection } from "./reviews-section";
import { ToursSection } from "./tours-section";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const localeCode = toLocaleCode(locale);

	const [t, siteConfig] = await Promise.all([
		getTranslations({ locale: localeCode, namespace: "HomePage.meta" }),
		getSiteConfig(),
	]);

	const siteUrl = getSiteUrl();
	const canonical = `${siteUrl}/${localeCode}`;

	return {
		title: t("title"),
		description: t("description"),
		alternates: {
			canonical,
			languages: {
				en: `${siteUrl}/en`,
				fr: `${siteUrl}/fr`,
				"x-default": `${siteUrl}/en`,
			},
		},
		openGraph: {
			title: t("title"),
			description: t("description"),
			url: canonical,
			siteName: siteConfig.attributes.siteName,
			locale: localeCode,
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title: t("title"),
			description: t("description"),
		},
	};
}

export default async function HomePage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const localeCode = toLocaleCode(locale);
	setRequestLocale(localeCode);

	const [t, tours, guides, reviews, faqItems, aggregateRating, siteConfig] =
		await Promise.all([
			getTranslations("HomePage"),
			getTours(localeCode),
			getGuides(localeCode),
			getReviews(localeCode),
			getFAQItems(localeCode),
			getAggregateRating(localeCode),
			getSiteConfig(),
		]);

	const languageMap: Record<string, string> = {
		en: t("tourCard.language.en"),
		fr: t("tourCard.language.fr"),
		es: t("tourCard.language.es"),
	};
	const guideNameBySlug = new Map(
		guides.map((guide) => [guide.slug, guide.attributes.name]),
	);
	const featuredReviews = [...reviews]
		.sort(
			(a, b) =>
				Number(b.attributes.isRealReview) - Number(a.attributes.isRealReview),
		)
		.slice(0, 3);
	const featuredFaqItems = faqItems.slice(0, 6);
	const howSteps = [
		{ title: t("how.step1.title"), body: t("how.step1.body") },
		{ title: t("how.step2.title"), body: t("how.step2.body") },
		{ title: t("how.step3.title"), body: t("how.step3.body") },
	];

	const siteUrl = getSiteUrl();
	const organizationId = `${siteUrl}/#organization`;

	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "TravelAgency",
				"@id": organizationId,
				name: siteConfig.attributes.siteName,
				url: `${siteUrl}/${localeCode}`,
				description: t("meta.description"),
				logo: `${siteUrl}/pragolem-logo.png`,
				telephone: siteConfig.attributes.contact.phone,
				email: siteConfig.attributes.contact.email,
				priceRange: "dès 20€",
				areaServed: { "@type": "City", name: "Prague" },
				sameAs: siteConfig.attributes.socialLinks.map((social) => social.url),
				contactPoint: {
					"@type": "ContactPoint",
					contactType: "customer service",
					email: siteConfig.attributes.contact.email,
					availableLanguage: ["French", "English"],
				},
				...(aggregateRating.reviewCount > 0 && {
					aggregateRating: {
						"@type": "AggregateRating",
						ratingValue: aggregateRating.ratingValue,
						reviewCount: aggregateRating.reviewCount,
					},
				}),
			},
			{
				"@type": "FAQPage",
				"@id": `${siteUrl}/${localeCode}#faq`,
				inLanguage: localeCode,
				about: { "@id": organizationId },
				mainEntity: featuredFaqItems.map((faq) => ({
					"@type": "Question",
					name: faq.attributes.question,
					acceptedAnswer: {
						"@type": "Answer",
						text: faq.attributes.answer,
					},
				})),
			},
		],
	};

	return (
		<>
			<JsonLd data={jsonLd} />
			<main
				id="main-content"
				className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 sm:px-6 sm:py-12"
			>
				<HeroSection
					t={t}
					aggregateRating={aggregateRating}
					tourCount={tours.length}
				/>
				<ToursSection
					t={t}
					tours={tours}
					languageMap={languageMap}
					guideNameBySlug={guideNameBySlug}
					locale={localeCode}
				/>
				<HowItWorksSection t={t} steps={howSteps} />
				<GuidesSection t={t} guides={guides} />
				<ReviewsSection
					t={t}
					reviews={featuredReviews}
					aggregateRating={aggregateRating}
				/>
				<FAQSection t={t} faqItems={featuredFaqItems} />
				<FinalCtaSection t={t} />
			</main>
		</>
	);
}
