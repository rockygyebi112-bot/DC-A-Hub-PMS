import { redirect } from "next/navigation";
import { SectionCard } from "@/components/admin/ui/section-card";
import { PageHeader } from "@/components/admin/ui/page-header";
import { AvatarForm } from "@/components/account/avatar-form";
import { NameForm } from "@/components/account/name-form";
import { EmailForm } from "@/components/account/email-form";
import { PasswordForm } from "@/components/account/password-form";
import { getMyAccount } from "@/lib/account/queries";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  staff: "Staff",
  client: "Client",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function AccountPage() {
  const account = await getMyAccount();
  if (!account) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account"
        subtitle="Manage your profile, sign-in details and photo."
      />

      <SectionCard
        title="Photo"
        description="A picture helps your team recognise you across the app."
      >
        <AvatarForm
          name={account.fullName}
          email={account.email}
          avatarUrl={account.avatarUrl}
        />
      </SectionCard>

      <SectionCard
        title="Profile"
        description="This is how your name appears to others."
      >
        <NameForm initial={account.fullName} />
        <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Role
            </dt>
            <dd className="mt-1 font-medium">
              {ROLE_LABEL[account.role] ?? account.role}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Member since
            </dt>
            <dd className="mt-1 font-medium">{formatDate(account.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Last sign-in
            </dt>
            <dd className="mt-1 font-medium">{formatDate(account.lastSignInAt)}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Email"
        description="Used for sign-in and account notifications."
      >
        <EmailForm
          currentEmail={account.email}
          pendingEmail={account.pendingEmail}
        />
      </SectionCard>

      <SectionCard
        title="Password"
        description="Choose a strong password you don't use anywhere else."
      >
        <PasswordForm />
      </SectionCard>
    </div>
  );
}
