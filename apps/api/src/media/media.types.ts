/**
 * URLs ya resueltas para un `MediaAsset`, una por propósito
 * (`MediaVariantPurpose`). `null` en cualquiera de los tres campos significa
 * "esa variante todavía no terminó de procesarse" (o nunca se generó porque
 * no aplica, ej. un asset sin recorte AR) — nunca se fabrica una URL de
 * relleno.
 */
export interface ResolvedMediaAsset {
  readonly thumbnailUrl: string | null;
  readonly detailUrl: string | null;
  readonly arCutoutUrl: string | null;
  readonly model3dUrl: string | null;
}
