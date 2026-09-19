/**
 * Liquid Glass SVG Filters
 * 
 * Provides advanced glass effects through SVG filters.
 * Include this component once in your layout to enable glass-container and glass-button classes.
 * 
 * @example
 * // In your root layout:
 * import { GlassFilters } from '@/components/glass-filters'
 * 
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <GlassFilters />
 *     </>
 *   )
 * }
 * 
 * // In your components:
 * <div className="glass-container">
 *   <button className="glass-button">Click me</button>
 * </div>
 */
export function GlassFilters() {
  return (
    <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
      <defs>
        <filter id="container-glass" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
          <feColorMatrix
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 18 -8
            "
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>

        <filter id="btn-glass" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          <feColorMatrix
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 20 -10
            "
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>

        <filter id="glass-glow" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          <feColorMatrix
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 15 -7
            "
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>

        <filter id="glass-intense" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
          <feColorMatrix
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 22 -12
            "
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

