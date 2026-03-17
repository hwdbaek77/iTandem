import Link from "next/link";

/**
 * StatusCard – shows a matched or unmatched state for a dashboard item.
 *
 * Props:
 *   icon        – single character or emoji shown in the accent circle
 *   title       – card heading (e.g. "Tandem Partner")
 *   matched     – truthy value means user has a match/spot
 *   matchedText – description when matched (e.g. "Sarah K. · B15, Taper Lot")
 *   actionLabel – button text when matched (e.g. "Message")
 *   actionHref  – link target when matched (e.g. "/chat")
 *   promptText  – description when unmatched (e.g. "You don't have a tandem partner yet")
 *   promptLabel – CTA text when unmatched (e.g. "Find Tandem Match")
 *   promptHref  – link target when unmatched (e.g. "/parking")
 */
export default function StatusCard({
  icon,
  title,
  matched,
  matchedText,
  actionLabel,
  actionHref,
  promptText,
  promptLabel,
  promptHref,
}) {
  return (
    <div className="rounded-3xl bg-card p-5">
      <div className="flex items-center gap-4">
        {/* Accent icon badge */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold">
          {icon}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">
            {matched ? matchedText : promptText}
          </p>
        </div>

        {/* Action button */}
        {matched ? (
          <Link
            href={actionHref}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {actionLabel}
          </Link>
        ) : (
          <Link
            href={promptHref}
            className="shrink-0 rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
          >
            {promptLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
