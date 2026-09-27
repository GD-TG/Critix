import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnNodesChange,
} from "@xyflow/react";
import {
  Badge,
  Button,
  Group,
  SegmentedControl,
  Text,
} from "@mantine/core";
import {
  LayoutGrid,
  Target,
} from "lucide-react";
import type { Dependency, Person, Priority, Project, Result, Task } from "./types";
import { formatMinutes } from "./shared";

const priorityColors: Record<Priority, string> = {
  low: "gray",
  medium: "blue",
  high: "orange",
  urgent: "red",
};

const priorityLabels: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const statusColors: Record<string, string> = {
  todo: "gray",
  in_progress: "blue",
  done: "teal",
  blocked: "red",
};

const statusLabels: Record<string, string> = {
  todo: "Запланировано",
  in_progress: "В работе",
  done: "Завершено",
  blocked: "Заблокировано",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string | null | undefined, zone: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: zone });
}

export interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  timezone: string;
  assignee?: Person;
  analysisRow?: {
    start: string;
    finish: string;
    critical: boolean;
    slack_minutes: number | null;
  };
  isAffected?: boolean;
  onEdit: (task: Task) => void;
}

// Custom ReactFlow Task Node with Handles and Rich Metadata
export function CustomTaskNode({ data }: NodeProps<Node<TaskNodeData>>) {
  const { task, assignee, analysisRow, isAffected, onEdit } = data;
  const isCritical = analysisRow?.critical;

  return (
    <div
      onClick={() => onEdit(task)}
      style={{
        width: 280,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--surface, #ffffff)",
        border: isCritical
          ? "2px solid #e57470"
          : isAffected
          ? "2px solid #ee9564"
          : "1px solid var(--line, #e2e8f0)",
        boxShadow: isCritical
          ? "0 4px 20px rgba(229, 116, 112, 0.25)"
          : "0 4px 14px rgba(0, 0, 0, 0.06)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        color: "var(--ink, #1c2330)",
        position: "relative",
      }}
    >
      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: isCritical ? "#e57470" : "var(--brand)",
          border: "2px solid #ffffff",
        }}
      />

      {/* Node Header: Badges */}
      <Group justify="space-between" mb={6}>
        <Badge size="xs" color={priorityColors[task.priority || "medium"]}>
          {priorityLabels[task.priority || "medium"]}
        </Badge>
        <Badge size="xs" color={statusColors[task.status]} variant="light">
          {statusLabels[task.status]}
        </Badge>
      </Group>

      {/* Task Name & Critical Pill */}
      <div style={{ marginBottom: 8 }}>
        <Text size="sm" fw={700} lineClamp={2} title={task.name}>
          {task.name}
        </Text>
        {isCritical && (
          <Badge size="xs" color="red" variant="filled" mt={3} leftSection={<Target size={10} />}>
            Критический путь
          </Badge>
        )}
      </div>

      {/* Assignee & Duration */}
      <Group justify="space-between" align="center" mb={6}>
        <Group gap={6}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
            }}
          >
            {assignee ? getInitials(assignee.name) : "—"}
          </div>
          <div>
            <Text size="xs" fw={600} lineClamp={1}>
              {assignee?.name || "Не назначен"}
            </Text>
            {assignee?.role && (
              <Text size="10px" c="dimmed" lineClamp={1}>
                {assignee.role}
              </Text>
            )}
          </div>
        </Group>
        <Text size="xs" fw={600} c="dimmed">
          {formatMinutes(task.duration_minutes)}
        </Text>
      </Group>

      {/* Date & Slack Footer */}
      <div
        style={{
          borderTop: "1px solid var(--line, #e2e8f0)",
          paddingTop: 6,
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--muted, #8994a4)",
        }}
      >
        <span>
          {analysisRow ? `${formatDate(analysisRow.start, data.timezone)} → ${formatDate(analysisRow.finish, data.timezone)}` : "—"}
        </span>
        <span style={{ fontWeight: 600, color: isCritical ? "#e57470" : "inherit" }}>
          {isCritical
            ? "Резерв 0 ч"
            : analysisRow?.slack_minutes !== null && analysisRow?.slack_minutes !== undefined
            ? `Резерв ${formatMinutes(analysisRow.slack_minutes)}`
            : "—"}
        </span>
      </div>

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: isCritical ? "#e57470" : "var(--brand)",
          border: "2px solid #ffffff",
        }}
      />
    </div>
  );
}

const nodeTypes = {
  taskNode: CustomTaskNode,
};

interface ProjectGraphProps {
  project: Project;
  result?: Result | null;
  affectedTaskIds?: Set<string>;
  colorScheme: "dark" | "light";
  onEditTask: (task: Task) => void;
  onAddDependency: (dep: Dependency) => void;
  onEditDependency?: (index: number) => void;
}

export function ProjectGraph({
  project,
  result,
  affectedTaskIds = new Set(),
  colorScheme,
  onEditTask,
  onAddDependency,
  onEditDependency,
}: ProjectGraphProps) {
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);

  // Compute topological layout for nodes
  const calculateLayout = useCallback((): Node<TaskNodeData>[] => {
    const tasks = project.tasks || [];
    const deps = project.dependencies || [];
    const rows = new Map((result?.analysis.tasks || []).map((r) => [r.id, r]));

    // Calculate in-degree and adjacency
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    for (const t of tasks) {
      incoming.set(t.id, []);
      outgoing.set(t.id, []);
    }
    for (const d of deps) {
      if (outgoing.has(d.predecessor_id)) outgoing.get(d.predecessor_id)!.push(d.successor_id);
      if (incoming.has(d.successor_id)) incoming.get(d.successor_id)!.push(d.predecessor_id);
    }

    // Rank / Level computation via longest path from roots
    const levels = new Map<string, number>();
    const computeLevel = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0;
      if (levels.has(taskId)) return levels.get(taskId)!;
      visited.add(taskId);
      const preds = incoming.get(taskId) || [];
      if (preds.length === 0) {
        levels.set(taskId, 0);
        return 0;
      }
      let maxPredLevel = 0;
      for (const p of preds) {
        maxPredLevel = Math.max(maxPredLevel, computeLevel(p, new Set(visited)) + 1);
      }
      levels.set(taskId, maxPredLevel);
      return maxPredLevel;
    };

    for (const t of tasks) {
      computeLevel(t.id);
    }

    // Group tasks by level
    const levelBuckets = new Map<number, Task[]>();
    for (const t of tasks) {
      const lvl = levels.get(t.id) || 0;
      if (!levelBuckets.has(lvl)) levelBuckets.set(lvl, []);
      levelBuckets.get(lvl)!.push(t);
    }

    // Generate Nodes with calculated positions
    const initialNodes: Node<TaskNodeData>[] = [];
    for (const [lvl, lvlTasks] of levelBuckets.entries()) {
      lvlTasks.forEach((task, idx) => {
        const assignee = project.assignees.find((a) => a.id === task.assignee_id);
        const analysisRow = rows.get(task.id);
        const isAffected = affectedTaskIds.has(task.id);

        initialNodes.push({
          id: task.id,
          type: "taskNode",
          position: {
            x: lvl * 360 + 40,
            y: idx * 210 + 40,
          },
          draggable: true,
          data: {
            task,
            assignee,
            analysisRow,
            timezone: project.timezone,
            isAffected,
            onEdit: onEditTask,
          },
        });
      });
    }

    return initialNodes;
  }, [project.tasks, project.dependencies, project.assignees, project.timezone, result, affectedTaskIds, onEditTask]);

  const [nodes, setNodes] = useState<Node<TaskNodeData>[]>([]);

  // Update nodes when project data changes
  useEffect(() => {
    setNodes(calculateLayout());
  }, [calculateLayout]);

  const onNodesChange: OnNodesChange<Node<TaskNodeData>> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  // Generate Edges
  const edges: Edge[] = useMemo(() => {
    const rows = new Map((result?.analysis.tasks || []).map((r) => [r.id, r]));
    return (project.dependencies || []).map((d, i) => {
      const predRow = rows.get(d.predecessor_id);
      const succRow = rows.get(d.successor_id);
      const isCriticalEdge = (result?.analysis.critical_dependencies || []).some((c) =>
        c.predecessor_id === d.predecessor_id && c.successor_id === d.successor_id &&
        c.kind === d.kind && c.lag_minutes === d.lag_minutes && c.lag_mode === d.lag_mode);
      const isAffected = affectedTaskIds.has(d.successor_id);

      return {
        id: `e-${d.predecessor_id}-${d.successor_id}-${i}`,
        source: d.predecessor_id,
        target: d.successor_id,
        type: "smoothstep",
        animated: isCriticalEdge,
        label: `${d.kind}${d.lag_minutes ? ` (${d.lag_minutes > 0 ? "+" : ""}${d.lag_minutes / 60}ч ${d.lag_mode === "working" ? "раб." : "кал."})` : ""}`,
        labelStyle: {
          fontSize: 10,
          fontWeight: 700,
          fill: isCriticalEdge ? "#e57470" : "var(--brand)",
        },
        labelBgStyle: {
          fill: colorScheme === "dark" ? "#1a2230" : "#ffffff",
          fillOpacity: 0.9,
          stroke: isCriticalEdge ? "#e57470" : "#cbd5e1",
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCriticalEdge ? "#e57470" : isAffected ? "#ee9564" : "var(--brand)",
        },
        style: {
          stroke: isCriticalEdge ? "#e57470" : isAffected ? "#ee9564" : "var(--brand)",
          strokeWidth: isCriticalEdge ? 2.5 : 1.5,
        },
      };
    });
  }, [project.dependencies, result, affectedTaskIds, colorScheme]);

  // Handle connecting new edge via drag and drop
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      onAddDependency({
        predecessor_id: params.source,
        successor_id: params.target,
        kind: "FS",
        lag_minutes: 0,
        lag_mode: "working",
      });
    },
    [onAddDependency],
  );

  const displayedNodes = useMemo(() => {
    if (!filterCriticalOnly) return nodes;
    return nodes.filter((n) => n.data.analysisRow?.critical);
  }, [nodes, filterCriticalOnly]);

  return (
    <div style={{ width: "100%", height: 680, position: "relative", borderRadius: 12, overflow: "hidden" }}>
      {/* Graph Toolbar */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 10,
          display: "flex",
          gap: 10,
          alignItems: "center",
          background: "var(--surface, #ffffff)",
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--line, #e2e8f0)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <Button
          size="xs"
          variant="light"
          leftSection={<LayoutGrid size={14} />}
          onClick={() => setNodes(calculateLayout())}
        >
          Авто-выравнивание
        </Button>

        <SegmentedControl
          size="xs"
          value={filterCriticalOnly ? "critical" : "all"}
          onChange={(v) => setFilterCriticalOnly(v === "critical")}
          data={[
            { label: "Все задачи", value: "all" },
            { label: "Критический путь", value: "critical" },
          ]}
        />
      </div>

      <ReactFlow<Node<TaskNodeData>>
        nodes={displayedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onEdgeClick={(_, edge) => {
          const parts = edge.id.split("-");
          const index = parseInt(parts[parts.length - 1], 10);
          if (onEditDependency && !isNaN(index)) {
            onEditDependency(index);
          }
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={true}
        nodesConnectable={true}
        snapToGrid={true}
        snapGrid={[20, 20]}
      >
        <Background
          color={colorScheme === "dark" ? "#334155" : "#cbd5e1"}
          gap={20}
          size={1.5}
        />
        <Controls />
        <MiniMap<Node<TaskNodeData>>
          nodeColor={(node) => {
            const d = node.data;
            if (d?.analysisRow?.critical) return "#e57470";
            if (d?.isAffected) return "#ee9564";
            return "var(--brand)";
          }}
          style={{
            background: "var(--surface, #ffffff)",
            borderRadius: 8,
            border: "1px solid var(--line, #e2e8f0)",
          }}
        />
      </ReactFlow>
    </div>
  );
}
