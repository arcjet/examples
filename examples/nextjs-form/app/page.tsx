import type { Metadata } from "next";
import Link from "next/link";
import { EmailForm } from "@/components/EmailForm";

export const metadata: Metadata = {
  title: "Form protection example",
  description:
    "An example of Arcjet's form protection for Next.js which includes bot protection, rate limiting, and Shield WAF for attack protection.",
};

export default function IndexPage() {
  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">Protected form</h1>
        <p className="typography-primary">
          This form is protected by Arcjet{"'"}s{" "}
          <Link
            href="https://docs.arcjet.com/bot-protection/concepts"
            className="link"
          >
            bot protection
          </Link>
          ,{" "}
          <Link
            href="https://docs.arcjet.com/rate-limiting/concepts"
            className="link"
          >
            rate limiting
          </Link>
          , and{" "}
          <Link href="https://docs.arcjet.com/shield/concepts" className="link">
            Shield WAF
          </Link>
          .
        </p>
      </div>

      <hr className="divider" />

      <div className="section">
        <EmailForm />
      </div>
    </main>
  );
}
