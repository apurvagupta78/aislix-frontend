/** Colorful brand / action icons for share & download buttons. */

type IconProps = { className?: string };

export function WhatsAppBrandIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.96.52 3.87 1.5 5.55L2 22l4.8-1.56a10.1 10.1 0 0 0 5.24 1.42h.01c5.46 0 9.9-4.4 9.9-9.83C21.95 6.4 17.5 2 12.04 2Z"
      />
      <path
        fill="#fff"
        d="M17.3 14.55c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.96.93-.96 2.28s.98 2.64 1.12 2.82c.14.18 1.93 2.95 4.67 4.14.65.28 1.16.45 1.56.57.65.2 1.25.18 1.72.11.52-.08 1.6-.65 1.83-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z"
      />
    </svg>
  );
}

export function SlackBrandIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E01E5A" d="M6.5 15.5a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Z" />
      <path fill="#36C5F0" d="M8.5 6.5a2 2 0 1 1 2-2v2h-2Zm0 1a2 2 0 1 1 0 4h-5a2 2 0 1 1 0-4h5Z" />
      <path fill="#2EB67D" d="M17.5 8.5a2 2 0 1 1 2 2h-2v-2Zm-1 0a2 2 0 1 1-4 0v-5a2 2 0 1 1 4 0v5Z" />
      <path fill="#ECB22E" d="M15.5 17.5a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z" />
    </svg>
  );
}

export function EmailBrandIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 12.8 2.5 6.2A2.5 2.5 0 0 1 4.5 4.5h15A2.5 2.5 0 0 1 21.5 6.2L12 12.8Z"
      />
      <path fill="#4285F4" d="M2 7.1V17.5A2.5 2.5 0 0 0 4.5 20H12V12.2L2 7.1Z" />
      <path fill="#34A853" d="M22 7.1 12 12.2V20h7.5a2.5 2.5 0 0 0 2.5-2.5V7.1Z" />
      <path fill="#FBBC05" d="M2 7.1 12 12.8 22 7.1" opacity=".35" />
    </svg>
  );
}

export function PdfBrandIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E53935" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <path fill="#FFCDD2" d="M14 2v6h6" />
      <path
        fill="#fff"
        d="M8.1 17.2c.7-2.1 1.5-3.9 2.4-5.4.8-1.4 1.8-2.5 3-3.3.2-.1.4 0 .5.2.3.9.4 1.9.2 2.9-.2 1.3-.8 2.5-1.7 3.5-.9 1-2 1.7-3.3 2-.4.1-.8-.2-1.1-.9Zm2.2-1.3c.6-.3 1.1-.8 1.5-1.4.4-.6.7-1.3.8-2-.7.5-1.3 1.2-1.7 2-.3.6-.6 1.2-.6 1.4Zm4.6-4.6c-.5.4-1.1.7-1.7.9.1-.6.1-1.2 0-1.7.7.2 1.3.4 1.7.8Z"
      />
    </svg>
  );
}

export function TeamBrandIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" fill="#7DB7D6" />
      <circle cx="16.5" cy="9" r="2.6" fill="#9B86D9" />
      <path
        fill="#79E2A8"
        d="M3.5 18.5c0-2.8 2.4-5 5.5-5s5.5 2.2 5.5 5v.8H3.5v-.8Z"
      />
      <path
        fill="#8EC9E8"
        d="M12.8 18.5c.4-1.8 1.7-3.3 3.7-3.8 2 .4 3.5 2 3.5 3.8v.8h-7.2v-.8Z"
      />
    </svg>
  );
}

export function CopyBrandIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" fill="#9B86D9" />
      <rect x="4" y="4" width="11" height="11" rx="2" fill="#7DB7D6" />
      <rect x="5.2" y="5.2" width="8.6" height="8.6" rx="1.2" fill="#EAF6FD" />
    </svg>
  );
}
