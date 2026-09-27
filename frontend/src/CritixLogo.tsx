import React from "react";

export function CritixLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="8" fill="var(--brand, #d20a2e)" />
      <path
        d="M21 11.5C19.8 10 17.8 9 15.5 9C11.36 9 8 12.13 8 16C8 19.87 11.36 23 15.5 23C17.8 23 19.8 22 21 20.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="21" cy="11.5" r="2" fill="white" />
      <circle cx="21" cy="20.5" r="2" fill="white" />
    </svg>
  );
}
