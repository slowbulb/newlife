import { getMapData } from "@/lib/queries";
import MapView from "@/components/MapView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getMapData();
  return <MapView initialNodes={data.nodes} initialEdges={data.edges} />;
}
