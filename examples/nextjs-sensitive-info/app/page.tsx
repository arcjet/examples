export default function Home() {
  return (
    <main>
      <h1>Arcjet sensitive information detection</h1>
      <p>
        This example exposes three route handlers that each detect sensitive
        information in the request body. Detection runs on-device — try them
        with <code>curl</code>. Set <code>ARCJET_ENV=development</code> locally
        so Arcjet doesn&apos;t require a public client IP.
      </p>

      <section>
        <h2>
          <code>POST /api/arcjet</code> — custom detection + Shield
        </h2>
        <p>
          Uses the <code>sensitiveInfo</code> rule with a custom{" "}
          <code>detect</code> function (<code>CONTAINS_DASH</code>) and Arcjet
          Shield. Blocks email addresses and any token containing a dash.
        </p>
        <pre>
          {`curl http://localhost:3000/api/arcjet \\
  -H "Content-Type: text/plain" \\
  -X POST --data "here's a string that contains-a-dash"`}
        </pre>
      </section>

      <section>
        <h2>
          <code>POST /api/arcjet-rampart</code> — on-device Rampart NER backend
        </h2>
        <p>
          Swaps the default WebAssembly engine for the{" "}
          <code>@arcjet/sensitive-info-rampart</code> backend, an on-device NER
          model that also detects names, addresses, and government/financial
          identifiers. Everything still runs locally.
        </p>
        <pre>
          {`curl http://localhost:3000/api/arcjet-rampart \\
  -H "Content-Type: text/plain" \\
  -X POST --data "Hi, my name is Alex Rivera and my SSN is 472-81-0094"`}
        </pre>
      </section>

      <section>
        <h2>
          <code>POST /api/arcjet-guard</code> — Arcjet Guard
        </h2>
        <p>
          Uses <code>@arcjet/guard</code> (<code>launchArcjet</code> /{" "}
          <code>localDetectSensitiveInfo</code>) with the same Rampart backend.
          Detection runs locally; only a SHA-256 hash of the text is sent to
          Arcjet. The response lists the detected entity types.
        </p>
        <pre>
          {`curl http://localhost:3000/api/arcjet-guard \\
  -H "Content-Type: text/plain" \\
  -X POST --data "Hi, my name is Alex Rivera and my SSN is 472-81-0094"`}
        </pre>
      </section>
    </main>
  );
}
