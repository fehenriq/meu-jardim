import type { ComparisonPhoto, HeightMeasurement } from "./insights-types"

export function normalizeHeightMeasurements(rows: Array<{ id: string; observed_at: string; height_cm: number | string | null }>) {
  return rows.flatMap((row) => {
    const height = typeof row.height_cm === "number" ? row.height_cm : Number(row.height_cm)
    return row.height_cm !== null && Number.isFinite(height) && height >= 0 ? [{ id: row.id, observed_at: row.observed_at, height_cm: height }] : []
  }).sort((left, right) => left.observed_at.localeCompare(right.observed_at) || left.id.localeCompare(right.id))
}

export function createHeightChartPoints(measurements: HeightMeasurement[], width = 700, height = 260) {
  if (measurements.length < 2) return []
  const paddingX = 48
  const paddingY = 30
  const values = measurements.map((item) => item.height_cm)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum
  return measurements.map((measurement, index) => ({
    ...measurement,
    x: paddingX + (index * (width - paddingX * 2)) / (measurements.length - 1),
    y: span === 0 ? height / 2 : paddingY + ((maximum - measurement.height_cm) * (height - paddingY * 2)) / span,
  }))
}

export function toggleComparisonPhoto(selectedIds: string[], photoId: string, availableIds: string[]) {
  if (!availableIds.includes(photoId)) return selectedIds
  if (selectedIds.includes(photoId)) return selectedIds.filter((id) => id !== photoId)
  return selectedIds.length < 2 ? [...selectedIds, photoId] : [selectedIds[1], photoId]
}

export function comparisonPhotoDate(photo: ComparisonPhoto) {
  return photo.taken_at ?? photo.observed_at ?? photo.created_at
}
