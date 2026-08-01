import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: "#080414",
  width: "device-width",
  initialScale: 1,
  maximumScale: 10,
  userScalable: true,
  viewportFit: "cover",
};

export default function ChartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
