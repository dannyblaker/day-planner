/**
 * The mark: one node, forking into two crocodiles that run at once.
 *
 * The name is the picture. A prerequisite finishes and everything that was
 * waiting on it surfaces together, so the mark is the smallest possible instance
 * of the board itself — a node, two arrows, two tasks that can start at the same
 * moment. The crocodiles are seen from above and built out of right angles, the
 * same drawing language `components/CrocShape.tsx` uses for a task, so the thing
 * in the top bar is the thing on the canvas.
 *
 * Decorative by default: wherever it appears the app's name is beside it in real
 * text, so it is `aria-hidden` unless a `title` is passed. The colours are fixed
 * rather than themed — they read on the swamp-dark background and on the light
 * one, and a logo that changed colour with the theme would stop being the logo.
 *
 * At 24px an animal is about seven pixels tall, which is not enough for teeth or
 * an outline; what has to survive that far down is the fork and two tapering
 * bodies. `app/icon.svg` drops the legs and the eyes for the same reason, and
 * `public/logo.svg` is the same drawing with room to be looked at.
 */

/** Tail tip at the origin, nose at x = 28, midline y = 0. */
const CROC =
  "M0 -0.6 L4 -0.6 L4 -1.5 L8 -1.5 L8 -2.5 L12 -2.5 L12 -3.6 " +
  "L21 -3.6 L21 -3 L24 -3 L24 -2.2 L26.5 -2.2 L26.5 -1.4 L28 -1.4 " +
  "L28 1.4 L26.5 1.4 L26.5 2.2 L24 2.2 L24 3 L21 3 L21 3.6 " +
  "L12 3.6 L12 2.5 L8 2.5 L8 1.5 L4 1.5 L4 0.6 L0 0.6 Z";

/** Four stubs at the corners of the body, which is all a leg can be this small. */
const LEGS =
  "M13.5 -3.6 h2 v-1.5 h-2 Z M18 -3.6 h2 v-1.5 h-2 Z " +
  "M13.5 3.6 h2 v1.5 h-2 Z M18 3.6 h2 v1.5 h-2 Z";

const EDGE = "#2f8d7d";

function Croc({ at }: { at: string }) {
  return (
    <g transform={at}>
      <path d={LEGS} fill="#3f7233" />
      <path d={CROC} fill="#4c8438" />
      <circle cx="22.4" cy="-1.9" r="0.85" fill="#f7c243" />
      <circle cx="22.4" cy="1.9" r="0.85" fill="#f7c243" />
    </g>
  );
}

export default function Logo({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}

      {/* the two arrows, curved the way the canvas curves an edge */}
      <g stroke={EDGE} strokeWidth="2.2" fill="none" strokeLinecap="round">
        <path d="M4.6 16 C7.8 16 7.2 10.8 9.4 10.5" />
        <path d="M4.6 16 C7.8 16 7.2 21.2 9.4 21.5" />
      </g>
      {/* the node they leave from */}
      <circle cx="4.2" cy="16" r="3.3" fill={EDGE} />

      <Croc at="translate(9.4 10.5) rotate(-15) scale(0.78)" />
      <Croc at="translate(9.4 21.5) rotate(15) scale(0.78)" />
    </svg>
  );
}
