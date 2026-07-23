import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Uploads a file under `<userId>/<timestamp>-<filename>` so storage RLS
 * (which checks the first path segment against auth.uid()) allows it, and
 * returns the public URL to store on the row (posts.photo_url, etc.).
 */
export async function uploadToBucket(
  supabase: SupabaseClient,
  bucket: string,
  userId: string,
  file: File | Blob,
  filenameHint = "upload"
): Promise<string | null> {
  const ext = "name" in file && file.name ? file.name.split(".").pop() : "bin";
  const path = `${userId}/${Date.now()}-${filenameHint}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) {
    console.error(`Upload to ${bucket} failed:`, error);
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
