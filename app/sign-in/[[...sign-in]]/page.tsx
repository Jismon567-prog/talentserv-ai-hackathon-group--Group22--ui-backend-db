import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Activity } from "lucide-react";

import { ProjectAudioPlayer } from "@/components/ProjectAudioPlayer";
import { LOGIN_OVERVIEW_AUDIO_SRC } from "@/lib/login-narration";

export default function SignInPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-12 text-white">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Activity className="h-6 w-6" />
          <span>OpenMRS AI Agent</span>
        </Link>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Healthcare test automation,
            <br />
            powered by AI.
          </h1>
          <p className="max-w-md text-blue-100">
            Turn user stories into functional, negative, validation, security,
            privacy, and audit test cases — with synthetic OpenMRS data and
            Playwright skeletons ready to run.
          </p>
          <ProjectAudioPlayer
            src={LOGIN_OVERVIEW_AUDIO_SRC}
            title="OpenMRS AI Agent project overview"
            variant="light"
          />
        </div>

        <div className="text-sm text-blue-200">
          100% synthetic patient data. Never uses PHI.
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center text-center lg:hidden">
            <div className="flex items-center gap-2 font-semibold">
              <Activity className="h-6 w-6 text-blue-600" />
              <span>OpenMRS AI Agent</span>
            </div>
          </div>

          <div className="space-y-1 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your dashboard.
            </p>
          </div>

          <div className="lg:hidden">
            <ProjectAudioPlayer
              src={LOGIN_OVERVIEW_AUDIO_SRC}
              title="OpenMRS AI Agent project overview"
            />
          </div>

          <div className="flex justify-center">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border border-border bg-background",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  footer: "hidden",
                },
              }}
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-blue-600 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
