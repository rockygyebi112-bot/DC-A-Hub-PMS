"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StickyFormBar } from "@/components/admin/ui/sticky-form-bar";
import { createClientOrg, updateClientOrg } from "@/lib/admin/actions/clients";
import { clientFormSchema, type ClientFormInput } from "@/lib/admin/schemas";
import { createClient as createSupabaseBrowser } from "@/lib/supabase/client";

type Props = {
  mode: "create" | "edit";
  initial?: ClientFormInput & { id?: string };
};

export function ClientForm({ mode, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      contact_email: initial?.contact_email ?? "",
      logo_url: initial?.logo_url ?? "",
    },
  });

  async function onLogoFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be 2 MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const sb = createSupabaseBrowser();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `clients/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await sb.storage
        .from("client-logos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data } = sb.storage.from("client-logos").getPublicUrl(path);
      form.setValue("logo_url", data.publicUrl, { shouldDirty: true });
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(values: ClientFormInput) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClientOrg(values)
          : await updateClientOrg(initial!.id!, values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Client created" : "Client updated");
      form.reset(values);
      if (mode === "create" && "data" in result && result.data) {
        router.push(`/admin/clients/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <SectionCard
          title="Basics"
          description="Used throughout the admin console and future client portal."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. SOCO Foundation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                        {field.value ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={field.value}
                            alt="Client logo"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No logo</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onLogoFileChange}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploading || pending}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploading
                            ? "Uploading..."
                            : field.value
                              ? "Replace"
                              : "Upload logo"}
                        </Button>
                        {field.value && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={uploading || pending}
                            onClick={() =>
                              form.setValue("logo_url", "", { shouldDirty: true })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <input type="hidden" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCard>

        <StickyFormBar visible={form.formState.isDirty || pending}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create client" : "Save changes"}
          </Button>
        </StickyFormBar>
      </form>
    </Form>
  );
}
