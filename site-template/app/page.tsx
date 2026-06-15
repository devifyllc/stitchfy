/**
 * Home page — site-template placeholder.
 *
 * This file is overwritten during generation by scripts/build-site.ts,
 * which injects real data from output/blueprint/website-blueprint.v1.json.
 * Edit this only to update the template structure, not the data.
 */

import { AccessibilitySkipLink } from "../components/AccessibilitySkipLink";
import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { ServicesGrid } from "../components/ServicesGrid";
import { TestimonialsSection } from "../components/TestimonialsSection";
import { BookingCTA } from "../components/BookingCTA";
import { HoursBlock } from "../components/HoursBlock";
import { Footer } from "../components/Footer";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Book Online", href: "/book" },
];

const contact = {
  phone: "(555) 000-0000",
  email: "hello@yourbusiness.com",
  address: "123 Main Street, City, ST 00000",
};

const heroContent = {
  headline: "Welcome to Your Business",
  subheadline: "Your tagline goes here — clear, warm, and inviting.",
  primaryCta: { label: "Book Now", href: "/book" },
  secondaryCta: { label: "Our Services", href: "/services" },
};

const services = [
  { name: "Service One", description: "Short description of this service." },
  { name: "Service Two", description: "Short description of this service." },
  { name: "Service Three", description: "Short description of this service." },
];

const testimonials = [
  { quote: "Client testimonial placeholder.", author: "Client Name" },
  { quote: "Client testimonial placeholder.", author: "Client Name" },
  { quote: "Client testimonial placeholder.", author: "Client Name" },
];

const hours = [
  { days: "Monday–Friday", hours: "9:00 AM – 5:00 PM" },
  { days: "Saturday", hours: "10:00 AM – 4:00 PM" },
  { days: "Sunday", hours: "Closed" },
];

export default function HomePage() {
  return (
    <>
      <AccessibilitySkipLink />
      <Header
        businessName="Your Business Name"
        navigation={navigation}
        showPhone
        phone="(555) 000-0000"
        showCTA
        ctaLabel="Book Now"
        ctaHref="/book"
      />
      <main id="main-content">
        <Hero content={heroContent} />
        <ServicesGrid services={services} />
        <TestimonialsSection testimonials={testimonials} />
        <BookingCTA
          headline="Ready to Book?"
          subheadline="Reserve your spot online in seconds."
          cta={{ label: "Book Now", href: "/book" }}
        />
        <HoursBlock hours={hours} />
      </main>
      <Footer
        businessName="Your Business Name"
        navigation={navigation}
        contact={contact}
        hours={hours}
      />
    </>
  );
}
