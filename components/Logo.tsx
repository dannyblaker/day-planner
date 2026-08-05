/**
 * The mark: a crocodile head with its jaws open.
 *
 * Decorative by default — wherever it appears the app's name is next to it in
 * real text, so it is `aria-hidden` unless a `title` is passed. The colours are
 * fixed rather than themed: the same green reads on the swamp-dark background
 * and on the light one, and a logo that changed colour with the theme would
 * stop being the logo.
 *
 * The dark gape is not decoration either — it is what keeps the cream teeth
 * visible when the mark is drawn on a light background.
 */
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
      {/* the gape */}
      <path
        d="M8.5 16.2 C14 17.4 22 19.4 27.6 20.9
           C26.6 17.6 26.8 14.4 27.9 11.5
           C22 13.6 14 15 8.5 16.2 Z"
        fill="#17280f"
      />
      {/* skull mass at the jaw hinge */}
      <ellipse cx="7" cy="15.6" rx="4.6" ry="5.4" fill="#3f7233" />
      {/* lower jaw */}
      <path
        d="M5.4 17 C9.5 16.7 14.5 17.9 19.5 19.3
           C23.5 20.4 26.8 21.3 28.6 21.8
           C29.6 22.1 29.5 23.3 28.3 23.4
           C25.5 23.3 21 22.6 16 21.6
           C11 20.6 6.4 19.7 4.8 19.1 Z"
        fill="#4c8438"
      />
      <g fill="#f5f2e6">
        <path d="M13.6 17.85 l1.8 0.4 l-0.6 -2.3 Z" />
        <path d="M17.8 19 l1.8 0.45 l-0.6 -2.3 Z" />
        <path d="M21.9 20.15 l1.8 0.45 l-0.6 -2.3 Z" />
        <path d="M25.5 21.1 l1.8 0.45 l-0.6 -2.3 Z" />
      </g>
      {/* upper jaw */}
      <path
        d="M4.6 13.2 C5.6 10.8 8.2 10.2 10.4 11
           C11 8.7 14 8.9 14.5 11.2
           C19.5 11 25 9.8 29.3 8.1
           C30 8.7 29.9 9.9 29 10.5
           C24 12.6 17.5 14.4 11.5 15.2
           C8 15.7 5.2 15.2 4.6 13.2 Z"
        fill="#63a447"
      />
      {/* scutes: the ridge along the snout */}
      <g fill="#3f7233">
        <path d="M17.4 11.35 l1.5 -0.15 l-0.6 -1.5 Z" />
        <path d="M21.6 10.7 l1.5 -0.25 l-0.5 -1.5 Z" />
      </g>
      <g fill="#f5f2e6">
        <path d="M14.6 14.6 l1.8 -0.35 l-0.6 2.3 Z" />
        <path d="M18.8 13.75 l1.8 -0.4 l-0.6 2.3 Z" />
        <path d="M22.9 12.6 l1.8 -0.45 l-0.6 2.3 Z" />
        <path d="M26.4 11.5 l1.8 -0.5 l-0.6 2.3 Z" />
      </g>
      <ellipse cx="27.3" cy="9.4" rx="0.8" ry="0.6" fill="#2f5626" />
      {/* the eye: gold, with the slit pupil */}
      <circle cx="12.5" cy="11.3" r="1.8" fill="#f7c243" />
      <ellipse cx="12.5" cy="11.3" rx="0.55" ry="1.2" fill="#14210f" />
    </svg>
  );
}
