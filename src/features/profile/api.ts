import { supabase } from "@/lib/supabase"
import { validateAvatar } from "./schema"

export async function updateProfile(displayName: string) {
  const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", (await supabase.auth.getUser()).data.user?.id)
  if (error) throw error
}

export async function uploadAvatar(userId: string, file: File) {
  const validation = validateAvatar(file)
  if (!validation.valid || !validation.extension) throw new Error(validation.valid ? "Avatar inválido." : validation.message)
  const path = `${userId}/${crypto.randomUUID()}.${validation.extension}`
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false })
  if (uploadError) throw uploadError
  const { error: profileError } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId)
  if (profileError) throw profileError
  return path
}

export async function signAvatar(path: string | null) {
  if (!path) return null
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path, 10 * 60)
  return error ? null : data.signedUrl
}

export async function updateGarden(gardenId: string, name: string, timezone: string) {
  const { error } = await supabase.from("gardens").update({ name: name.trim(), timezone: timezone.trim() }).eq("id", gardenId)
  if (error) throw error
}
