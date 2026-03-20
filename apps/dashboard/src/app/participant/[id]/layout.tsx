export const metadata = {
  title: "Pretive - Session",
  description: "Live session participant view",
};

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg, #F5F0EB)" }}
    >
      {children}
    </div>
  );
}
