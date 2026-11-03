import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { AuthScreen } from "@/components/AuthScreen";
import { ProfileForm } from "@/components/ProfileForm";
import { onboardingProfileAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const user = await requireUser();
  if (user.profile?.onboardingDone && user.profile.assessmentDone) redirect("/dashboard");
  return (
    <AuthScreen title="Tell us about you" subtitle="Step 1 of 2 · so your mentor gets you">
      <ProfileForm
        action={onboardingProfileAction}
        allowSkip
        submitText="Continue"
        values={{
          name: user.name ?? "",
          age: user.age,
          profession: user.profile?.occupation ?? "",
          goal: user.profile?.goals ?? "",
          about: user.profile?.about ?? "",
        }}
      />
    </AuthScreen>
  );
}
