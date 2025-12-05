"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { CardGlass } from "@/components/ui/card";

export default function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(false);

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        <CardGlass className="py-8">
          {showSignIn ? (
            <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
          )}
        </CardGlass>
      </div>
    </div>
  );
}
