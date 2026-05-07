import Link from "next/link";

export default function RootPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold">DC&A Hub PMS</h1>
      <p className="mt-4">Project Management System for DC&A Hub.</p>
      <p className="mt-6">
        <Link className="underline" href="/login">Sign in</Link>
      </p>
    </main>
  );
}
