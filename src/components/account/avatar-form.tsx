"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { removeMyAvatar, uploadMyAvatar } from "@/lib/account/actions";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function AvatarForm({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Avatar must be 5 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await uploadMyAvatar(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Photo updated");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function onRemove() {
    startRemove(async () => {
      const res = await removeMyAvatar();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Photo removed");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <UserAvatar
        name={name}
        email={email}
        avatarUrl={avatarUrl}
        size="lg"
        className="size-20 text-xl"
      />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uploading || removing}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {uploading ? "Uploading..." : avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              disabled={uploading || removing}
              onClick={onRemove}
            >
              {removing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              {removing ? "Removing..." : "Remove"}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP or GIF. Max 5 MB.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}
