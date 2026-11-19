"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
	getCountries,
	getCountryCallingCode,
	isValidPhoneNumber,
	parsePhoneNumberFromString,
	type CountryCode,
} from "libphonenumber-js/min";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface TimeSlotOption {
	valueTime: string;
	labelTimeKey: string;
}

export interface BookingTourOption {
	id: string;
	slug: string;
	title: string;
	timeSlots: TimeSlotOption[]; // plusieurs créneaux possibles
	priceType: "free" | "paid" | "pwyw";
	isPrivate: boolean;
}

interface BookingFormValues {
	tourSlug: string;
	date: string;
	timeSlot: string;
	participants: string;
	language: string;
	fullName: string;
	email: string;
	phoneCountry: string;
	phone: string;
	specialRequests: string;
	termsAccepted: boolean;
}

type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;
type BookingFormTranslator = ReturnType<typeof useTranslations>;

// const PARTICIPANT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

// const TIME_SLOT_OPTIONS = [
// 	{ value: "09:00", labelKey: "timeSlots.slot0900" },
// 	{ value: "11:00", labelKey: "timeSlots.slot1100" },
// 	{ value: "14:00", labelKey: "timeSlots.slot1400" },
// 	{ value: "17:00", labelKey: "timeSlots.slot1700" },
// ] as const;

const LANGUAGE_OPTIONS = [
	{ value: "en", labelKey: "languageOptions.en" },
	{ value: "fr", labelKey: "languageOptions.fr" },
	{ value: "es", labelKey: "languageOptions.es" },
] as const;

/** Countries shown first in the country-code selector. */
const PINNED_PHONE_COUNTRIES: CountryCode[] = [
	"FR",
	"GB",
	"US",
	"CZ",
	"ES",
	"CA",
	"BE",
	"CH",
	"DE",
	"IT",
	"NL",
	"CO",
];

interface PhoneCountryOption {
	value: CountryCode;
	name: string;
	callingCode: string;
}

/**
 * Picks the default phone country from the page language.
 */
function getDefaultPhoneCountry(language: "en" | "fr"): CountryCode {
	return language === "fr" ? "FR" : "GB";
}

/**
 * Builds the country-code options with localized country names.
 * Frequent countries come first, the rest is sorted alphabetically.
 */
function buildPhoneCountryOptions(locale: string): PhoneCountryOption[] {
	const regionNames = new Intl.DisplayNames([locale], { type: "region" });
	const options: PhoneCountryOption[] = getCountries().map((code) => ({
		value: code,
		name: regionNames.of(code) ?? code,
		callingCode: getCountryCallingCode(code),
	}));

	const pinned = PINNED_PHONE_COUNTRIES.map((code) =>
		options.find((option) => option.value === code),
	).filter((option): option is PhoneCountryOption => Boolean(option));

	const others = options
		.filter((option) => !PINNED_PHONE_COUNTRIES.includes(option.value))
		.sort((left, right) => left.name.localeCompare(right.name, locale));

	return [...pinned, ...others];
}

/**
 * Returns today's date in `YYYY-MM-DD` format based on the visitor's local timezone.
 * The value is used for both the date input minimum and past-date validation.
 */
function getTodayDateString(): string {
	const now = new Date();
	now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
	return now.toISOString().slice(0, 10);
}

/**
 * Builds the default form state used on initial render and after a successful submission.
 */
function createInitialBookingValues(
	defaultLanguage: "en" | "fr",
): BookingFormValues {
	return {
		tourSlug: "",
		date: "",
		timeSlot: "",
		participants: "",
		language: defaultLanguage,
		fullName: "",
		email: "",
		phoneCountry: getDefaultPhoneCountry(defaultLanguage),
		phone: "",
		specialRequests: "",
		termsAccepted: false,
	};
}

/**
 * Validates booking form values and returns a localized error object keyed by field name.
 * The validation includes required fields, email and phone format, and a strict past-date check.
 */
function validateBookingValues(
	values: BookingFormValues,
	todayDateString: string,
	t: BookingFormTranslator,
): BookingFormErrors {
	const errors: BookingFormErrors = {};
	const normalizedName = values.fullName.trim();
	const normalizedEmail = values.email.trim();
	const normalizedPhone = values.phone.trim();

	if (!values.tourSlug) {
		errors.tourSlug = t("validation.requiredTour");
	}

	if (!values.date) {
		errors.date = t("validation.requiredDate");
	} else if (values.date < todayDateString) {
		errors.date = t("validation.pastDate");
	}

	if (!values.timeSlot) {
		errors.timeSlot = t("validation.requiredTimeSlot");
	}

	if (!values.participants) {
		errors.participants = t("validation.requiredParticipants");
	}

	if (!values.language) {
		errors.language = t("validation.requiredLanguage");
	}

	if (!normalizedName) {
		errors.fullName = t("validation.requiredFullName");
	} else if (normalizedName.length < 2) {
		errors.fullName = t("validation.fullNameTooShort");
	}

	if (!normalizedEmail) {
		errors.email = t("validation.requiredEmail");
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
		errors.email = t("validation.invalidEmail");
	}

	if (!normalizedPhone) {
		errors.phone = t("validation.requiredPhone");
	} else if (
		!isValidPhoneNumber(normalizedPhone, values.phoneCountry as CountryCode)
	) {
		errors.phone = t("validation.invalidPhone");
	}

	if (!values.termsAccepted) {
		errors.termsAccepted = t("validation.termsRequired");
	}

	return errors;
}

/**
 * Renders the localized booking form and handles client-side validation/submission.
 * On successful submission it logs the payload and shows a success toast.
 */
export function BookingForm({
	tourOptions,
	defaultLanguage,
}: {
	tourOptions: BookingTourOption[];
	defaultLanguage: "en" | "fr";
}) {
	const t = useTranslations("BookingPage.form");
	const locale = useLocale();
	const phoneCountryOptions = useMemo(
		() => buildPhoneCountryOptions(locale),
		[locale],
	);
	const todayDateString = useMemo(() => getTodayDateString(), []);
	const [values, setValues] = useState<BookingFormValues>(() =>
		createInitialBookingValues(defaultLanguage),
	);
	const [errors, setErrors] = useState<BookingFormErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	/**
	 * Updates one field value and clears any existing validation message for that field.
	 */
	const updateField = <K extends keyof BookingFormValues>(
		field: K,
		value: BookingFormValues[K],
	) => {
		setValues((previousValues) => ({ ...previousValues, [field]: value }));
		setErrors((previousErrors) => {
			if (!previousErrors[field]) {
				return previousErrors;
			}

			const nextErrors = { ...previousErrors };
			delete nextErrors[field];
			return nextErrors;
		});
	};

	const selectedTour = tourOptions.find(
		(tour) => tour.slug === values.tourSlug,
	);
	/**
	 * Validates the form, submits the booking to the API route, and shows a toast
	 * based on the result. On success, the form resets to its initial state.
	 */

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nextErrors = validateBookingValues(values, todayDateString, t);

		if (Object.keys(nextErrors).length > 0) {
			setErrors(nextErrors);
			return;
		}

		setIsSubmitting(true);

		const parsedPhone = parsePhoneNumberFromString(
			values.phone.trim(),
			values.phoneCountry as CountryCode,
		);

		const payload = {
			tourSlug: values.tourSlug,
			date: values.date,
			timeSlot: values.timeSlot,
			participants: Number(values.participants),
			language: values.language,
			fullName: values.fullName.trim(),
			email: values.email.trim(),
			phone: parsedPhone?.number ?? values.phone.trim(),
			specialRequests: values.specialRequests.trim() || null,
			termsAccepted: values.termsAccepted,
			submittedAt: new Date().toISOString(),
		};

		try {
			const response = await fetch("/api/booking", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				throw new Error(
					`Booking request failed with status ${response.status}`,
				);
			}

			toast.success(t("successToast"));
			setValues(createInitialBookingValues(defaultLanguage));
			setErrors({});
		} catch (error) {
			console.error("[BookingForm] Submission failed:", error);
			toast.error(t("errorToast"));
		} finally {
			setIsSubmitting(false);
		}
	};
	console.log("tourOptions:", tourOptions);
	console.log(
		"slugs:",
		tourOptions.map((t) => t.slug),
	);
	return (
		<form onSubmit={handleSubmit} noValidate className="space-y-5">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="booking-tour">{t("tourLabel")}</FieldLabel>
					<Select
						value={values.tourSlug}
						onValueChange={(value) => {
							const newlySelectedTour = tourOptions.find(
								(tour) => tour.slug === value,
							);
							const defaultTimeSlot =
								newlySelectedTour?.timeSlots[0]?.valueTime ?? "";

							setValues((previousValues) => ({
								...previousValues,
								tourSlug: value,
								timeSlot: defaultTimeSlot,
							}));
						}}
					>
						<SelectTrigger
							id="booking-tour"
							aria-invalid={Boolean(errors.tourSlug)}
						>
							<SelectValue placeholder={t("tourPlaceholder")} />
						</SelectTrigger>
						<SelectContent>
							{tourOptions.map((tour) => (
								<SelectItem key={tour.slug} value={tour.slug}>
									{tour.title} · {t(`tourPriceType.${tour.priceType}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<FieldError>{errors.tourSlug}</FieldError>
				</Field>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="booking-date">{t("dateLabel")}</FieldLabel>
						<Input
							id="booking-date"
							name="date"
							type="date"
							min={todayDateString}
							value={values.date}
							onChange={(event) => updateField("date", event.target.value)}
							aria-invalid={Boolean(errors.date)}
						/>
						<FieldError>{errors.date}</FieldError>
					</Field>

					<Field>
						<FieldLabel htmlFor="booking-time-slot">
							{t("timeSlotLabel")}
						</FieldLabel>

						{selectedTour && selectedTour.timeSlots.length > 1 ? (
							// Plusieurs créneaux → select interactif
							<Select
								value={values.timeSlot}
								onValueChange={(value) => updateField("timeSlot", value)}
							>
								<SelectTrigger
									id="booking-time-slot"
									aria-invalid={Boolean(errors.timeSlot)}
								>
									<SelectValue placeholder={t("timeSlotPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									{selectedTour.timeSlots.map((slot) => (
										<SelectItem key={slot.valueTime} value={slot.valueTime}>
											{t(slot.labelTimeKey)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							// 0 ou 1 créneau → affichage fixe, non modifiable
							<Input
								id="booking-time-slot"
								value={
									selectedTour?.timeSlots[0]
										? t(selectedTour.timeSlots[0].labelTimeKey)
										: ""
								}
								placeholder={t("timeSlotPlaceholder")}
								readOnly
								disabled
							/>
						)}
						{selectedTour?.isPrivate && (
							<FieldDescription>{t("privateTourNotice")}</FieldDescription>
						)}
						<FieldError>{errors.timeSlot}</FieldError>
					</Field>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="booking-participants">
							{t("participantsLabel")}
						</FieldLabel>
						<Input
							id="booking-participants"
							name="participants"
							type="number"
							min="1"
							placeholder={t("participantsPlaceholder")}
							value={values.participants}
							onChange={(event) =>
								updateField("participants", event.target.value)
							}
							aria-invalid={Boolean(errors.participants)}
						/>
						{Number(values.participants) > 6 && (
							<FieldDescription>
								{t.rich("participantsPrivateNote", {
									contactLink: (chunks) => (
										<Link
											href="/contact"
											className="underline underline-offset-4"
										>
											{chunks}
										</Link>
									),
								})}
							</FieldDescription>
						)}
						<FieldError>{errors.participants}</FieldError>
					</Field>

					<Field>
						<FieldLabel htmlFor="booking-language">
							{t("languageLabel")}
						</FieldLabel>
						<Select
							value={values.language}
							onValueChange={(value) => updateField("language", value)}
						>
							<SelectTrigger
								id="booking-language"
								aria-invalid={Boolean(errors.language)}
							>
								<SelectValue placeholder={t("languagePlaceholder")} />
							</SelectTrigger>
							<SelectContent>
								{LANGUAGE_OPTIONS.map((language) => (
									<SelectItem key={language.value} value={language.value}>
										{t(language.labelKey)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldError>{errors.language}</FieldError>
					</Field>
				</div>

				<Field>
					<FieldLabel htmlFor="booking-full-name">
						{t("fullNameLabel")}
					</FieldLabel>
					<Input
						id="booking-full-name"
						name="fullName"
						autoComplete="name"
						placeholder={t("fullNamePlaceholder")}
						value={values.fullName}
						onChange={(event) => updateField("fullName", event.target.value)}
						aria-invalid={Boolean(errors.fullName)}
					/>
					<FieldError>{errors.fullName}</FieldError>
				</Field>

				<div className="grid gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="booking-email">{t("emailLabel")}</FieldLabel>
						<Input
							id="booking-email"
							name="email"
							type="email"
							autoComplete="email"
							placeholder={t("emailPlaceholder")}
							value={values.email}
							onChange={(event) => updateField("email", event.target.value)}
							aria-invalid={Boolean(errors.email)}
						/>
						<FieldError>{errors.email}</FieldError>
					</Field>

					<Field>
						<FieldLabel htmlFor="booking-phone">{t("phoneLabel")}</FieldLabel>
						<div className="flex gap-2">
							<Select
								value={values.phoneCountry}
								onValueChange={(value) => {
									updateField("phoneCountry", value);
									setErrors((previousErrors) => {
										if (!previousErrors.phone) {
											return previousErrors;
										}
										const nextErrors = { ...previousErrors };
										delete nextErrors.phone;
										return nextErrors;
									});
								}}
							>
								<SelectTrigger
									id="booking-phone-country"
									className="w-28 shrink-0"
									aria-label={t("phoneCountryLabel")}
								>
									<SelectValue>
										{values.phoneCountry} +
										{getCountryCallingCode(values.phoneCountry as CountryCode)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{phoneCountryOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.name} (+{option.callingCode})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Input
								id="booking-phone"
								name="phone"
								type="tel"
								inputMode="tel"
								autoComplete="tel"
								placeholder={t("phonePlaceholder")}
								value={values.phone}
								onChange={(event) => updateField("phone", event.target.value)}
								aria-invalid={Boolean(errors.phone)}
							/>
						</div>
						<FieldError>{errors.phone}</FieldError>
					</Field>
				</div>

				<Field>
					<FieldLabel htmlFor="booking-special-requests">
						{t("specialRequestsLabel")}
					</FieldLabel>
					<Textarea
						id="booking-special-requests"
						name="specialRequests"
						rows={4}
						placeholder={t("specialRequestsPlaceholder")}
						value={values.specialRequests}
						onChange={(event) =>
							updateField("specialRequests", event.target.value)
						}
					/>
				</Field>

				<Field>
					<div className="flex items-start gap-2.5">
						<Checkbox
							id="booking-terms"
							checked={values.termsAccepted}
							onCheckedChange={(checked) =>
								updateField("termsAccepted", checked === true)
							}
							aria-invalid={Boolean(errors.termsAccepted)}
						/>
						<div className="space-y-1">
							<FieldLabel htmlFor="booking-terms">{t("termsLabel")}</FieldLabel>
							<FieldError>{errors.termsAccepted}</FieldError>
						</div>
					</div>
				</Field>
			</FieldGroup>

			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? t("submitPending") : t("submit")}
			</Button>
		</form>
	);
}
