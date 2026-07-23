import type { SupabaseClient } from "@supabase/supabase-js";

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};

/**
 * Uploads a file under `<userId>/<timestamp>-<filename>` so storage RLS
 * (which checks the first path segment against auth.uid()) allows it, and
 * returns the public URL to store on the row (posts.photo_url, etc.).
 *
 * `contentType` should be passed explicitly for Blobs (e.g. voice note
 * recordings) since they have no filename/extension of their own — without
 * it, storage serves a generic content-type and some browsers (notably iOS
 * Safari) refuse to play the audio back.
 */
export async function uploadToBucket(
  supabase: SupabaseClient,
  bucket: string,
  userId: string,
  file: File | Blob,
  filenameHint = "upload",
  contentType?: string
): Promise<string | null> {
  const mime = contentType || (file as File).type || "";
  const ext =
    EXT_BY_MIME[mime.split(";")[0]] ||
    ("name" in file && file.name ? file.name.split(".").pop() : null) ||
    "bin";
  const path = `${userId}/${Date.now()}-${filenameHint}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: mime || undefined });
  if (error) {
    console.error(`Upload to ${bucket} failed:`, error);
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
