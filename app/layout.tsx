import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Bodoni_Moda, Inter } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CampusNav",
  description: "Micro-navigation for your campus.",
};

// No-flash theme init: set data-theme before paint from storage or system pref.
const themeInit = `(function(){try{var t=localStorage.getItem("ds-theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      style={
        {
          "--font-display": `${bodoni.style.fontFamily}, Georgia, serif`,
          "--font-body": `${inter.style.fontFamily}, system-ui, sans-serif`,
          "--font-label": `${inter.style.fontFamily}, system-ui, sans-serif`,
        } as CSSProperties
      }
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="ds-root antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
