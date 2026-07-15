"use client";

import { useState } from "react";

// Password field with a show/hide toggle (§8 password-toggle).
export function PasswordInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`${className} pr-16`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-1.5 top-1/2 flex min-h-9 -translate-y-1/2 items-center rounded px-2 text-xs font-medium text-muted hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
