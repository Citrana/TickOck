// Root layout — minimal passthrough. The [locale] layout provides <html> and <body>.
export default function RootLayout({children}: {children: React.ReactNode}) {
  return children as React.ReactElement;
}
