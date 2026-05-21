'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  const region = params.get('region') || 'all';
  const district = params.get('district') || 'all';
  const community = params.get('community') || 'all';
  const gender = params.get('gender') ?? 'all';
  const exposure = params.get('soco_exposure') ?? 'All';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
      <Select value={region} onValueChange={(v) => setParam('region', v ?? 'all')}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All regions</SelectItem>
          {props.regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={district} onValueChange={(v) => setParam('district', v ?? 'all')}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All districts</SelectItem>
          {props.districts.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={community} onValueChange={(v) => setParam('community', v ?? 'all')}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All communities</SelectItem>
          {props.communities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={gender} onValueChange={(v) => setParam('gender', v ?? 'all')}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All genders</SelectItem>
          <SelectItem value="female">Female</SelectItem>
          <SelectItem value="male">Male</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={exposure}
        onValueChange={(v) => setParam('soco_exposure', v ?? 'All')}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.socoExposureOptions.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
