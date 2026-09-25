import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlatSync",
  description: "Friends, one flat: shortlist listings against everyone's constraints.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">{children}</div>
      </body>
    </html>
  );
}
