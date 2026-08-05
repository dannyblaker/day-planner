/**
 * The mark: a task, and the work that starts when it is done.
 *
 * One crocodile seen from above — a task, in the same right angles
 * `components/CrocShape.tsx` uses on the canvas — with dependency edges leaving
 * its snout and ending on three nodes. That is where they leave from in the app
 * too: the ○ port is at the crocodile's nose, and an arrow drawn from it says
 * "this one waits on me". Three of them says what the name says, which is that
 * finishing one task can release several at once.
 *
 * Decorative by default: wherever it appears the app's name is beside it in real
 * text, so it is `aria-hidden` unless a `title` is passed. The colours are fixed
 * rather than themed — they read on the swamp-dark background and on the light
 * one, and a logo that changed colour with the theme would stop being the logo.
 *
 * The box is 3:2, because a crocodile with a fan in front of it is a wide
 * arrangement and squeezing it into a square only makes the animal thinner. The
 * call sites size it to match. `app/icon.svg` squares it up by dropping to two
 * nodes and pulling them in, a favicon having no width to spare.
 */

/** Tail tip at the origin, nose at x = 28, midline y = 0. */
const CROC =
  "M0 -0.6 L4 -0.6 L4 -1.5 L8 -1.5 L8 -2.5 L12 -2.5 L12 -3.6 " +
  "L21 -3.6 L21 -3 L24 -3 L24 -2.2 L26.5 -2.2 L26.5 -1.4 L28 -1.4 " +
  "L28 1.4 L26.5 1.4 L26.5 2.2 L24 2.2 L24 3 L21 3 L21 3.6 " +
  "L12 3.6 L12 2.5 L8 2.5 L8 1.5 L4 1.5 L4 0.6 L0 0.6 Z";

/**
 * One limb: the hip at the origin, up and then a foot turned along the body.
 * Drawn once and mirrored into four corners, as the canvas crocodile does it.
 */
const LIMB = "M0 0 L0 -1.9 L2.7 -1.9 L2.7 -0.9 L1.1 -0.9 L1.1 0 Z";
const HIPS = [
  "translate(17.6 -3.6)",
  "translate(12.4 -3.6) scale(-1 1)",
  "translate(17.6 3.6) scale(1 -1)",
  "translate(12.4 3.6) scale(-1 -1)",
];

const EDGE = "#2f8d7d";
/** where each node sits; the middle one sits further out, so the fan is a fan */
const NODES: [number, number][] = [
  [43.6, 7],
  [44.8, 16],
  [43.6, 25],
];

export default function Logo({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}

      {/* the edges, dotted: a round cap on a near-zero dash is a round dot, and
          dots stay legible scaled down, where a dash pattern smears */}
      <g
        stroke={EDGE}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="0.1 3.2"
      >
        {NODES.map(([x, y]) => (
          <path key={y} d={`M29.6 16 C34 16 ${x - 5} ${y} ${x - 2.5} ${y}`} />
        ))}
      </g>
      {NODES.map(([x, y]) => (
        <circle key={y} cx={x} cy={y} r="2" fill={EDGE} />
      ))}

      <g transform="translate(1 16)">
        <g fill="#3f7233">
          {HIPS.map((t) => (
            <path key={t} d={LIMB} transform={t} />
          ))}
        </g>
        <path d={CROC} fill="#4c8438" />
        <circle cx="22.4" cy="-1.9" r="0.9" fill="#f7c243" />
        <circle cx="22.4" cy="1.9" r="0.9" fill="#f7c243" />
      </g>
    </svg>
  );
}
