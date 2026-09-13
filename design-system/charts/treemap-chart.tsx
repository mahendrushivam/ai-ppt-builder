import { ResponsiveContainer, Treemap } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { colorAt } from "./utils";

/** The parts of a tile that are needed to draw it. */
type Tile = { x: number; y: number; width: number; height: number; depth: number; index: number; name: string };

/** Tiles sized by value: each category is a tile sized by the first series' value. */
export function TreemapChart({ data, colors }: ChartProps) {
  const tiles = data.categories.map((category, index) => ({ name: category, value: data.series[0]?.values[index] ?? 0 }));

  return (
    <ChartFrame>
      {/* Treemap has no `responsive` option, so a container measures the space for it. */}
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={tiles}
          dataKey="value"
          nameKey="name"
          isAnimationActive={false}
          content={(tile: Tile) => <TreemapTile tile={tile} colors={colors} />}
        />
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function TreemapTile({ tile, colors }: { tile: Tile; colors: readonly string[] }) {
  // The root node spans the whole chart; only its children are drawn as tiles.
  if (tile.depth === 0) return <g />;

  const hasRoomForLabel = tile.width > 48 && tile.height > 20;
  return (
    <g>
      <rect
        x={tile.x}
        y={tile.y}
        width={tile.width}
        height={tile.height}
        fill={colorAt(colors, tile.index)}
        strokeWidth={2}
        className="stroke-(--chart-on-color) [stroke-opacity:0.4]"
      />
      {hasRoomForLabel && (
        <text x={tile.x + 6} y={tile.y + 16} className="fill-(--chart-on-color) [font-size:var(--chart-font-size)]">
          {tile.name}
        </text>
      )}
    </g>
  );
}
