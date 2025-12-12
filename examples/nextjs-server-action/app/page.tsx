import { EmailForm } from "@/components/EmailForm";
import Divider from "@/components/elements/Divider";
import type { Metadata } from "next";
import Link from "next/link";

import sharedStyles from "@/components/elements/PageShared.module.scss";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Server action form protection example",
  description:
    "An example of Arcjet's form protection for Next.js which includes bot protection, rate limiting, and Shield WAF for attack protection.",
};

export default function IndexPage() {
  return (
    <section className={sharedStyles.Content}>
      <div className={sharedStyles.Section}>
        <h1 className={styles.title}>Protected server action form</h1>
        <p className={styles.description}>
          This form is protected by Arcjet's{" "}
          <Link
            href="https://docs.arcjet.com/bot-protection/concepts"
            className={styles.link}
          >
            bot protection
          </Link>
          ,{" "}
          <Link
            href="https://docs.arcjet.com/rate-limiting/concepts"
            className={styles.link}
          >
            rate limiting
          </Link>
          , and{" "}
          <Link
            href="https://docs.arcjet.com/shield/concepts"
            className={styles.link}
          >
            Shield WAF
          </Link>
          .
        </p>
      </div>

      <Divider />

      <div className={sharedStyles.Section}>
        <div className={styles.formContainer}>
          <EmailForm />
        </div>
      </div>
    </section>
  );
}
