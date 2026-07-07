"use client";

import { signIn } from "next-auth/react";

const ERROR_MESSAGES: Record<string, string> = {
  NoAccess: "You do not have access to Clock-In. Ask an admin to grant the tool card.",
  NotInvited: "Your @meavo.com account is not registered in the gateway.",
  DomainNotAllowed: "Only @meavo.com Google accounts can sign in.",
};

export default function LoginPage({
  errorKey = "",
}: {
  errorKey?: string;
}) {
  const errorMessage = ERROR_MESSAGES[errorKey];

  return (
    <div className="flex min-h-screen items-center justify-center bg-meavo-bg px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-meavo-beige-600 bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-meavo-ink">Meavo Clock-In</h1>
          <p className="mt-1 text-sm text-meavo-grey">
            Sign in with your Meavo Google account.
          </p>
        </div>
        {errorMessage ? (
          <p className="rounded-lg bg-meavo-pink px-3 py-2 text-sm text-red-800">
            {errorMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="btn-primary w-full"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
