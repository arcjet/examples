import Divider from "@/components/elements/Divider";
import type { Metadata } from "next";
import Link from "next/link";

import sharedStyles from "@/components/elements/PageShared.module.scss";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Bot protection example",
  description: "An example of Arcjet's bot protection for Next.js.",
};

export default async function IndexPage() {
  return (
    <section className={sharedStyles.Content}>
      <div className={sharedStyles.Section}>
        <h1 className={styles.title}>Arcjet bot protection example</h1>
        <p className={styles.description}>
          This page is protected by{" "}
          <Link
            href="https://docs.arcjet.com/bot-protection/concepts"
            className={styles.link}
          >
            Arcjet&apos;s bot protection
          </Link>
          .
        </p>
      </div>

      <Divider />

      <div className={sharedStyles.Section}>
        <h2 className={styles.sectionHeading}>Try it</h2>
        <p className={styles.secondaryText}>
          Make a request pretending to be Googlebot:
        </p>
        <pre className={styles.codeExample}>
          curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1;
          +http://www.google.com/bot.html)" http://localhost:3000
        </pre>
        <p className={styles.secondaryText}>
          Your IP will be blocked for 60 seconds.
        </p>
      </div>
    </section>
  );
}
