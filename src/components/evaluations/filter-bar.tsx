'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function FilterBar(props: {
  regions: string[];
  districts: string[];
  communities: string[];
  socoExposureOptions: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all' || value === 'All') next.delete(name);
    else next.set(name, value);
    router.push(`?${next.toString()}`);
  }

  const region = params.get('region') ?? '';
  const district = params.get('district') ?? '';
  const community = params.get('community') ?? '';
  const gender = params.get('gender') ?? 'all';
  const exposure = params.get('soco_exposure') ?? 'All';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
      <select
        value={region}
        onChange={(e) => setParam('region', e.target.value)}
        className="rounded border border-border px-2 py-1"
      >
        <option value="">All regions</option>
        {props.regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <select
        value={district}
        onChange={(e) => setParam('district', e.target.value)}
        className="rounded border border-border px-2 py-1"
      >
        <option value="">All districts</option>
        {props.districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={community}
        onChange={(e) => setParam('community', e.target.value)}
        className="rounded border border-border px-2 py-1"
      >
        <option value="">All communities</option>
        {props.communities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        value={gender}
        onChange={(e) => setParam('gender', e.target.value)}
        className="rounded border border-border px-2 py-1"
      >
        <option value="all">All genders</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
      </select>
      <select
        value={exposure}
        onChange={(e) => setParam('soco_exposure', e.target.value)}
        className="rounded border border-border px-2 py-1"
      >
        {props.socoExposureOptions.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
