import "./globals.css";

export const metadata = {
  title: "PMP Sales Pricing Console",
  description: "Look up and update website pricing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
