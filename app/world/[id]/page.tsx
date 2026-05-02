import { WorldPageClient } from "./WorldPageClient";

type WorldPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorldPage({ params }: WorldPageProps) {
  const { id } = await params;

  return <WorldPageClient worldId={id} />;
}
