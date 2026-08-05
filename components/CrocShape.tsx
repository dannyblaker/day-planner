import { FLOW, TaskStatus } from "@/lib/types";

const { NODE_W, NODE_H } = FLOW;

/**
 * The crocodile is drawn once, at this size, and every coordinate below is in it.
 * The node it fills is whatever FLOW says, so the drawing is a viewBox stretched
 * to fit rather than a set of numbers to retype: change how big a task is and the
 * animal, its label and its done button all follow.
 */
const ART = { W: 240, H: 82 };
const sx = NODE_W / ART.W;
const sy = NODE_H / ART.H;

/**
 * Where the text goes: the flat of the crocodile's back, between the tail and
 * the neck. The card is a silhouette rather than a plain rectangle, so the usable
 * area is smaller than the box and has to be published rather than guessed —
 * FlowCanvas positions the label with it.
 */
export const BACK = {
  left: 34 * sx,
  right: 72 * sx,
  top: 20 * sy,
  bottom: 20 * sy,
};

/** …and where the done button sits: the bottom corner of that same back. */
export const DONE_AT = { right: 76 * sx, bottom: 22 * sy };

/**
 * A crocodile built out of right angles, drawn so the torso *is* the card.
 *
 * The steps are the design, not a simplification of one. Curves need length to
 * read — a tapering tail and a rounded skull are only recognisable if you give
 * them room, and that room costs more than half the tasks on screen. Blocks
 * don't need it: a stepped tail says "tapering" in three rectangles, a square
 * skull behind a square snout says "crocodile" as clearly as a curved one, and
 * the whole animal fits a card barely bigger than a plain rectangle.
 *
 * So corners stay sharp (see `stroke-linejoin` in globals.css) and every
 * coordinate is a whole unit of the art box, mirrored about the midline at
 * y = 41.
 *
 * The head is a wedge continuous with the body, and that is deliberate. Drawn the
 * obvious way — a pinch at the neck, then a squarer skull, then a narrow snout out
 * the front of it — the silhouette invites a reading that has nothing to do with
 * crocodiles and cannot be unseen once anyone has seen it. Which is a fair
 * warning about any narrow protrusion off a wider mass, and no loss here: a
 * crocodile's head from above never looked like that anyway. It is widest at the
 * jaw hinge, as wide there as the body, and narrows the whole way to the nose. So
 * the front end steps down three times and never back up, and the eyes ride on
 * the widest step.
 */
const OUTLINE = `M 2 36 L 12 36 L 12 32 L 22 32 L 22 27 L 30 27 L 30 12
  L 174 12 L 174 18 L 194 18 L 194 24 L 212 24 L 212 29 L 233 29
  L 233 53 L 212 53 L 212 58 L 194 58 L 194 64 L 174 64 L 174 70
  L 30 70 L 30 55 L 22 55 L 22 50 L 12 50 L 12 46 L 2 46 Z`;

/**
 * The priority accent: the tail, dipped. Inset a pixel and unstroked, so it
 * colours the steps without drawing a second outline over the first.
 */
const TAIL_PATCH = `M 4 37 L 13 37 L 13 33 L 23 33 L 23 28 L 30 28
  L 30 54 L 23 54 L 23 49 L 13 49 L 13 45 L 4 45 Z`;

/**
 * One leg: an L, upper limb and then a foot turned outwards along the body.
 *
 * The obvious blocky leg — a stub with toe notches bitten out of the end — turns
 * out to read as a battlement, and four of them make the card a castle wall. The
 * bend is what says leg, so the foot steps sideways instead, forwards on the
 * front pair and backwards on the back pair, which is roughly what a crocodile's
 * feet do from above.
 *
 * Drawn pointing up from its hip at the origin, then mirrored into the other
 * three corners — no rotation, so every edge stays on the pixel grid.
 */
const LIMB = `M -5 2 L -5 -10 L 9 -10 L 9 -6 L 5 -6 L 5 2 Z`;

const HIPS = [
  "translate(144 12)",
  "translate(62 12) scale(-1 1)",
  "translate(144 70) scale(1 -1)",
  "translate(62 70) scale(-1 -1)",
];

/**
 * The mouth, along the snout. Shut it is a line; on a task you can start it is a
 * square wave, which at this size is the whole of "teeth" — the jaws are 25px
 * long, and anything drawn along their two edges instead of down the middle comes
 * out as fringe.
 */
const MOUTH_SHUT = "M 214 41 h17";
const MOUTH_TOOTHED = "M 214 39 h4 v4 h4 v-4 h4 v4 h4 v-4 h1";

/**
 * The jaw hinge: where the head stops being the body. Without it the taper reads
 * as a card with a pointy end and the eyes look like they are on the shoulders.
 * One line does that job at none of the cost of a bulge in the outline.
 */
const JAW_HINGE = "M 174 12 L 174 70";

/**
 * A crocodile seen from above, at the size of one task.
 *
 * Fill and outline come from the status the parent publishes as `--node-fill`
 * and `--node-accent` (see globals.css), so the shape is coloured by the graph
 * and follows the theme for free.
 *
 * It draws nothing interactive: the node div behind it stays the hit target, so
 * panning, selecting and dropping an arrow all work across the whole box rather
 * than only where the crocodile happens to be.
 */
export default function CrocShape({
  status,
  done,
}: {
  status: TaskStatus;
  done: boolean;
}) {
  return (
    <svg
      className="croc-shape"
      width={NODE_W}
      height={NODE_H}
      viewBox={`0 0 ${ART.W} ${ART.H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* legs, then the body over their hips, then the tail's colour */}
      {HIPS.map((t) => (
        <path key={t} d={LIMB} transform={t} />
      ))}
      <path d={OUTLINE} />
      <path d={TAIL_PATCH} fill="currentColor" stroke="none" />
      <path
        d={JAW_HINGE}
        fill="none"
        strokeWidth="1.2"
        strokeDasharray="none"
      />
      <path
        d={status === "in-progress" ? MOUTH_TOOTHED : MOUTH_SHUT}
        fill="none"
        strokeWidth="1.2"
        strokeDasharray="none"
      />
      {/* nostrils, at the tip where they belong */}
      <g fill="none" strokeWidth="2.4" strokeDasharray="none">
        <path d="M 226 37 h2" />
        <path d="M 226 45 h2" />
      </g>
      {/*
       * The eyes say the other half of what the colour already says: a finished
       * crocodile shuts them, and everything still on the board is watching.
       */}
      {done ? (
        <g fill="none" strokeWidth="2" strokeDasharray="none">
          <path d="M 178 27 h10" />
          <path d="M 178 55 h10" />
        </g>
      ) : (
        <g strokeWidth="1" strokeDasharray="none">
          <rect x="178" y="23" width="9" height="8" fill="#f7c243" />
          <rect x="178" y="51" width="9" height="8" fill="#f7c243" />
          <rect
            x="181.5"
            y="25"
            width="2"
            height="4"
            fill="#14210f"
            stroke="none"
          />
          <rect
            x="181.5"
            y="53"
            width="2"
            height="4"
            fill="#14210f"
            stroke="none"
          />
        </g>
      )}
    </svg>
  );
}
