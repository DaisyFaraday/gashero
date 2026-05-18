import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="69c0b55d3beb94a927e63d55" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
