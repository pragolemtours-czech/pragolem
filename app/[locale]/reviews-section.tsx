import type { Review } from "@/lib/types/review";
import GoogleReviews from "./reviews/google-reeviews";

interface ReviewsSectionProps {
	t: (key: string, values?: Record<string, string | number | Date>) => string;
	reviews: Review[];
	aggregateRating: { ratingValue: number; reviewCount: number };
}

/**
 * Renders the reviews section with featured review cards, an aggregate
 * rating badge, and a link to the full reviews page.
 */
export function ReviewsSection({ t }: ReviewsSectionProps) {
	return (
		<section className="space-y-5">
			<GoogleReviews t={t} />
		</section>
	);
}
