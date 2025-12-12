// import { EmailForm } from "@/components/EmailForm";
import Link from "next/link";
import { EmailForm } from "./EmailForm";

export default function IndexPage() {
  return (
    <main className="page">
      <div className="section">
        <h1 className="heading-primary">Protected server action form</h1>
        <p className="typography-primary">
          This form is protected by Arcjet's{" "}
          <Link
            href="https://docs.arcjet.com/bot-protection/concepts"
            target="_blank"
            className="link"
          >
            bot protection
          </Link>
          ,{" "}
          <Link
            href="https://docs.arcjet.com/rate-limiting/concepts"
            target="_blank"
            className="link"
          >
            rate limiting
          </Link>
          , and{" "}
          <Link
            href="https://docs.arcjet.com/shield/concepts"
            target="_blank"
            className="link"
          >
            Shield WAF
          </Link>
          .
        </p>
      </div>

      <hr className="divider" />

      <EmailForm />
    </main>
  );
}
