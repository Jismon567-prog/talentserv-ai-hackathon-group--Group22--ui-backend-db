import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Activity } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-indigo-700 via-blue-700 to-blue-600 p-12 text-white">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Activity className="h-6 w-6" />
          <span>OpenMRS AI Agent</span>
        </Link>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Get started in seconds.
          </h1>
          <p className="max-w-md text-blue-100">
            Create your account to generate test cases, synthetic patients,
            visits, and encounters from any healthcare user story.
          </p>
        </div>

        <div className="text-sm text-blue-200">
          OpenMRS-aware. Privacy-first. Audit-ready.
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Create your account
            </h2>
            <p className="text-sm text-muted-foreground">
              Start generating tests in under a minute.
            </p>
          </div>

          <div className="flex justify-center">
            <SignUp
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border border-border bg-background",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  footer: "hidden",
                },
              }}
              signInUrl="/sign-in"
              fallbackRedirectUrl="/dashboard"
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-blue-600 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
