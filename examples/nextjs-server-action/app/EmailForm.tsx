"use client";

import { useActionState } from "react";
import { submitForm } from "./actions";

const INITIAL_STATE = { message: "" };

export function EmailForm() {
  const [state, action, pending] = useActionState(submitForm, INITIAL_STATE);

  return (
    <form action={action} className="form">
      <div className="form-field">
        <label className="form-label">
          Email
          <input
            name="email"
            type="email"
            placeholder="totoro@example.com"
            className="form-input"
          />
        </label>
        <span className="form-description">
          Just a test form - you won&apos;t receive any emails.
        </span>
        {state.message && (
          <span className="form-error" aria-live="polite">
            {state.message}
          </span>
        )}
      </div>
      <div className="form-button">
        <button type="submit" className="button-primary" disabled={pending}>
          Sign up
        </button>
      </div>
    </form>
  );
}
