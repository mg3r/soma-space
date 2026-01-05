import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "soma space",
  description: "a movement gathering rooted in presence and free expression. connect. accept. discover.",
  keywords: ["movement", "dance", "wellness", "community", "soma space"],
  authors: [{ name: "soma space" }],
  openGraph: {
    title: "soma space",
    description: "a movement gathering rooted in presence and free expression. connect. accept. discover.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "soma space",
    description: "a movement gathering rooted in presence and free expression. connect. accept. discover.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
