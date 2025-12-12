import pageStyles from "@/components/elements/PageShared.module.scss";
import styles from "./page.module.css";

export default function SubmittedPage() {
  return (
    <section className={pageStyles.Content}>
      <div className={pageStyles.Section}>
        <h1 className={styles.pageHeading}>Submitted</h1>
        <p className={styles.pageDescription}>
          The form was submitted, but this is just an example so nothing will
          happen.
        </p>
      </div>
    </section>
  );
}
