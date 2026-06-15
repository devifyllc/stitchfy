/**
 * Shared TypeScript types for the site-template components.
 * These are populated at generation time from the website blueprint.
 */

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface ServiceItem {
  name: string;
  description?: string;
  price?: string;
  icon?: string;
}

export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface GalleryImage {
  src: string;
  alt: string;
  category?: string;
}

export interface HoursEntry {
  days: string;
  hours: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  mapUrl?: string;
}

export interface HeroContent {
  headline: string;
  subheadline: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  backgroundImage?: string;
}

export interface SiteConfig {
  businessName: string;
  tagline?: string;
  navigation: NavItem[];
  contact: ContactInfo;
  social: Record<string, string>;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
  };
}
