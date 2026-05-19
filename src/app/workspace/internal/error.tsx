'use client';
export default function Error({ error }: { error: Error }) {
  return <main className="p-6 text-sm text-red-600">Something went wrong: {error.message}</main>;
}
