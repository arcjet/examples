"use client";

import { submitForm } from "@/app/actions";
import { Button } from "@/components/ui/button";
import styles from "@/components/ui/form.module.css";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useActionState } from "react";

const initialState = {
  message: "",
};

export function EmailForm() {
  const [state, formAction, pending] = useActionState(submitForm, initialState);

  return (
    <form action={formAction}>
      <Label htmlFor="email">Email</Label>
      <Input
        type="text"
        id="email"
        name="email"
        defaultValue={"test@arcjet.com"}
        required
      />
      <p className={cn(styles.formMessage)} aria-live="polite">
        {state?.message}
      </p>
      <br />
      <Button disabled={pending}>Sign up</Button>
    </form>
  );
}
