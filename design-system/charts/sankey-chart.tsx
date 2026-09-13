import { ResponsiveContainer, Sankey } from "recharts";
import { ChartFrame } from "./chart-frame";
import type { ChartProps } from "./types";
import { colorAt } from "./utils";

/** The parts of a node that are needed to draw it and its label. */
type FlowNode = { x: number; y: number; width: number; height: number; index: number; payload: { name?: unknown } };

/** Room beside the nodes for source labels on the left and target labels on the right. */
const LABEL_SPACE = 88;

/** Flows: each series is a source on the left, each category a target on the right, values are the flows. */
export function SankeyChart({ data, colors }: ChartProps) {
  const nodes = [
    ...data.series.map((series) => ({ name: series.name })),
    ...data.categories.map((category) => ({ name: category })),
  ];
  const links = data.series.flatMap((series, seriesIndex) =>
    series.values.flatMap((value, categoryIndex) =>
      value > 0 ? [{ source: seriesIndex, target: data.series.length + categoryIndex, value }] : [],
    ),
  );

  if (links.length === 0) {
    return (
      <ChartFrame>
        <p className="flex h-full items-center justify-center text-(--chart-muted) [font-size:var(--chart-font-size)]">
          No flows to show.
        </p>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame>
      {/* Sankey has no `responsive` option, so a container measures the space for it. */}
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={{ nodes, links }}
          nodeWidth={10}
          nodePadding={12}
          margin={{ top: 8, right: LABEL_SPACE, bottom: 8, left: LABEL_SPACE }}
          link={{ stroke: colorAt(colors, 0), strokeOpacity: 0.25 }}
          node={(node: FlowNode) => <SankeyNode node={node} colors={colors} sourceCount={data.series.length} />}
        />
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function SankeyNode({ node, colors, sourceCount }: { node: FlowNode; colors: readonly string[]; sourceCount: number }) {
  const isSource = node.index < sourceCount;
  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        fill={isSource ? colorAt(colors, node.index) : undefined}
        className={isSource ? undefined : "fill-(--chart-muted)"}
      />
      <text
        x={isSource ? node.x - 6 : node.x + node.width + 6}
        y={node.y + node.height / 2}
        textAnchor={isSource ? "end" : "start"}
        dominantBaseline="middle"
        className="fill-(--chart-text) [font-size:var(--chart-font-size)]"
      >
        {String(node.payload.name ?? "")}
      </text>
    </g>
  );
}
