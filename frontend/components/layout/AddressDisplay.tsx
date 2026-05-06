"use client";

import { useRitualName } from "@/hooks/useRitualName";
import { shortenAddress } from "@/lib/names";

interface AddressDisplayProps {
  address: string | undefined | null;
  /** Show full address in tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Link to profile page (default: false) */
  linkToProfile?: boolean;
  /** CSS class override */
  className?: string;
  /** If true, always shows shortened address even if name exists */
  forceShort?: boolean;
  /** Show a subtle badge if user has a name */
  showBadge?: boolean;
}

/**
 * AddressDisplay — drop-in replacement for raw address strings
 * 
 * Before: 0x82fa...91bc
 * After:  alex.ritual  (or 0x82fa...91bc if no name)
 * 
 * Usage:
 *   <AddressDisplay address={owner} />
 *   <AddressDisplay address={owner} linkToProfile />
 *   <AddressDisplay address={owner} showBadge />
 */
export default function AddressDisplay({
  address,
  showTooltip = true,
  linkToProfile = false,
  className = "",
  forceShort = false,
  showBadge = false,
}: AddressDisplayProps) {
  const { display, name, loading } = useRitualName(address);

  if (!address) {
    return <span className={className} style={{ color: "rgba(200,247,197,0.35)" }}>—</span>;
  }

  const label = forceShort ? shortenAddress(address) : display;
  const hasName = !!name && !forceShort;

  const inner = (
    <span
      title={showTooltip ? address : undefined}
      className={className}
      style={{
        color: hasName ? "var(--mint)" : "rgba(200,247,197,0.6)",
        fontWeight: hasName ? 600 : 400,
        transition: "color 0.2s",
        cursor: showTooltip ? "help" : "inherit",
      }}
    >
      {loading && !name ? (
        // Show shortened address while loading
        <span style={{ opacity: 0.5 }}>{shortenAddress(address)}</span>
      ) : (
        <>
          {label}
          {showBadge && hasName && (
            <span
              style={{
                marginLeft: "0.35rem",
                fontSize: "0.6rem",
                padding: "0.1rem 0.35rem",
                borderRadius: "1rem",
                background: "rgba(200,247,197,0.08)",
                border: "1px solid rgba(200,247,197,0.15)",
                color: "rgba(200,247,197,0.5)",
                verticalAlign: "middle",
                letterSpacing: "0.04em",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              .ritual
            </span>
          )}
        </>
      )}
    </span>
  );

  if (linkToProfile && address) {
    return (
      <a
        href={`/profile/${address}`}
        style={{
          textDecoration: "none",
          color: "inherit",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.opacity = "0.8";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
        }}
      >
        {inner}
      </a>
    );
  }

  return inner;
}
