export const dynamic = "force-dynamic";

import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Заявки · Ozelim",
  description: "Кабинет модераторов для обработки заявок",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full bg-green-50/30 font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
