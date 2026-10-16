type JsonLdProps = {
	data: Record<string, unknown>;
};

// Échappe "<" pour qu'un texte du CMS ne puisse pas fermer la balise <script>
const safeJson = (data: unknown) =>
	JSON.stringify(data).replace(/</g, "\\u003c");

export function JsonLd({ data }: JsonLdProps) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJson(data) }}
		/>
	);
}
