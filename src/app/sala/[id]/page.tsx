import GameApp from "@/components/game-app";
export default async function Room({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GameApp roomId={id} />;
}
