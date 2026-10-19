// Matches AttachmentService.MaxBytes and AllowedTypes in src/BugTracker.Application/Tickets/AttachmentService.cs.
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.docx', '.xlsx', '.txt', '.csv']
export const MAX_FILE_LABEL = 'Up to 25 MB per file · PNG, JPG, GIF, PDF, DOCX, XLSX, TXT, CSV'

/** Why a file can't be attached, or null if it's fine. The server checks again. */
export function checkFile(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `${file.name} isn’t a supported file type.`
  if (file.size > MAX_FILE_BYTES) return `${file.name} is larger than 25 MB.`
  if (file.size === 0) return `${file.name} is empty.`
  return null
}
