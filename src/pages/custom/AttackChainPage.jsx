import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Link2,
  Monitor,
  Pencil,
  Server,
  StickyNote,
  Trash2,
  Unlink,
} from 'lucide-react';
import { persistGet, persistSet } from '../../lib/persistentStorage';
import {
  titleColorOptions,
  titleFontOptions,
  getTitleColorClass,
  getTitleFontClass,
} from '../../lib/pageStyleOptions';

const defaultMeta = {
  title: 'Attack Chain',
  titleColor: 'cyan',
  titleFont: 'font-title-space',
  description: 'Map hosts, pivots, and notes for your operation.',
  descriptionFont: 'font-mono',
};

const defaultCanvas = {
  nodes: [],
  connections: [],
};

const WORKSPACE_MIN_WIDTH = 2400;
const WORKSPACE_MIN_HEIGHT = 1600;
const WORKSPACE_PADDING = 320;

const paletteItems = [
  { type: 'windows', label: 'Windows Host', icon: Monitor, accent: 'from-blue-500/25 to-cyan-500/15', border: 'border-blue-500/30', text: 'text-blue-300' },
  { type: 'linux', label: 'Linux Host', icon: Server, accent: 'from-emerald-500/25 to-teal-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  { type: 'note', label: 'Attack Note', icon: StickyNote, accent: 'from-amber-500/25 to-orange-500/15', border: 'border-amber-500/30', text: 'text-amber-300' },
];

const nodeStyles = {
  windows: {
    border: 'border-blue-500/35',
    ring: 'ring-blue-400/30',
    chip: 'bg-blue-500/12 text-blue-200 border-blue-500/25',
    title: 'text-blue-100',
    body: 'text-slate-300',
    icon: Monitor,
    width: 240,
    height: 128,
  },
  linux: {
    border: 'border-emerald-500/35',
    ring: 'ring-emerald-400/30',
    chip: 'bg-emerald-500/12 text-emerald-200 border-emerald-500/25',
    title: 'text-emerald-100',
    body: 'text-slate-300',
    icon: Server,
    width: 240,
    height: 128,
  },
  note: {
    border: 'border-amber-500/35',
    ring: 'ring-amber-400/30',
    chip: 'bg-amber-500/12 text-amber-200 border-amber-500/25',
    title: 'text-amber-100',
    body: 'text-slate-300',
    icon: StickyNote,
    width: 260,
    height: 170,
  },
};

function localLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeNode(type, x, y) {
  const size = nodeStyles[type] || nodeStyles.windows;
  const titleMap = {
    windows: 'Windows Host',
    linux: 'Linux Host',
    note: 'Attack Note',
  };

  const detailsMap = {
    windows: 'Hostname, access path, creds, foothold details',
    linux: 'Service path, shell, privilege path, loot',
    note: 'Write operator notes, commands, or movement rationale',
  };

  return {
    id: `chain-node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    x,
    y,
    width: size.width,
    height: size.height,
    title: titleMap[type],
    details: detailsMap[type],
    notes: '',
  };
}

function makeConnection(fromId, toId) {
  return {
    id: `chain-link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromId,
    toId,
    label: 'Initial access',
    notes: '',
  };
}

export default function AttackChainPage({ pageKey }) {
  const [meta, setMetaRaw] = useState(() => localLoad(`library_meta_${pageKey}`, defaultMeta));
  const [canvasState, setCanvasStateRaw] = useState(() => localLoad(`library_attackchain_${pageKey}`, defaultCanvas));
  const [editingMeta, setEditingMeta] = useState(false);
  const [draftMeta, setDraftMeta] = useState(meta);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [pendingConnectionFrom, setPendingConnectionFrom] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [resizingNode, setResizingNode] = useState(null);
  const [panningCanvas, setPanningCanvas] = useState(null);
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    persistGet(`library_meta_${pageKey}`).then((value) => {
      if (value) {
        setMetaRaw(value);
        setDraftMeta(value);
      }
    });
    persistGet(`library_attackchain_${pageKey}`).then((value) => {
      if (value) setCanvasStateRaw(value);
    });
  }, [pageKey]);

  const updateMeta = (value) => {
    setMetaRaw(value);
    persistSet(`library_meta_${pageKey}`, value);
  };

  const updateCanvasState = (value) => {
    setCanvasStateRaw(value);
    persistSet(`library_attackchain_${pageKey}`, value);
  };

  const nodes = canvasState.nodes || [];
  const connections = canvasState.connections || [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId) || null;
  const titleColorClass = getTitleColorClass(meta.titleColor);
  const titleFontClass = getTitleFontClass(meta.titleFont);

  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  const workspaceSize = useMemo(() => {
    const maxRight = nodes.reduce((max, node) => Math.max(max, node.x + (node.width || (nodeStyles[node.type] || nodeStyles.windows).width)), 0);
    const maxBottom = nodes.reduce((max, node) => Math.max(max, node.y + (node.height || (nodeStyles[node.type] || nodeStyles.windows).height)), 0);

    return {
      width: Math.max(WORKSPACE_MIN_WIDTH, maxRight + WORKSPACE_PADDING),
      height: Math.max(WORKSPACE_MIN_HEIGHT, maxBottom + WORKSPACE_PADDING),
    };
  }, [nodes]);

  const canvasConnections = useMemo(() => {
    return connections
      .map((connection) => {
        const from = nodeMap[connection.fromId];
        const to = nodeMap[connection.toId];
        if (!from || !to) return null;

        const fromSize = {
          width: from.width || (nodeStyles[from.type] || nodeStyles.windows).width,
          height: from.height || (nodeStyles[from.type] || nodeStyles.windows).height,
        };
        const toSize = {
          width: to.width || (nodeStyles[to.type] || nodeStyles.windows).width,
          height: to.height || (nodeStyles[to.type] || nodeStyles.windows).height,
        };
        const x1 = from.x + fromSize.width / 2;
        const y1 = from.y + fromSize.height / 2;
        const x2 = to.x + toSize.width / 2;
        const y2 = to.y + toSize.height / 2;

        return {
          ...connection,
          x1,
          y1,
          x2,
          y2,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
        };
      })
      .filter(Boolean);
  }, [connections, nodeMap]);

  useEffect(() => {
    if (!draggingNode && !resizingNode && !panningCanvas) return undefined;

    const handleMove = (event) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (draggingNode && canvasRect) {
        setCanvasStateRaw((previous) => {
          const nextNodes = previous.nodes.map((node) => {
            if (node.id !== draggingNode.id) return node;

            const width = node.width || (nodeStyles[node.type] || nodeStyles.windows).width;
            const height = node.height || (nodeStyles[node.type] || nodeStyles.windows).height;
            const nextX = clamp(event.clientX - canvasRect.left - draggingNode.offsetX, 12, workspaceSize.width - width - 12);
            const nextY = clamp(event.clientY - canvasRect.top - draggingNode.offsetY, 12, workspaceSize.height - height - 12);
            return { ...node, x: nextX, y: nextY };
          });

          const nextState = { ...previous, nodes: nextNodes };
          persistSet(`library_attackchain_${pageKey}`, nextState);
          return nextState;
        });
      }

      if (resizingNode) {
        setCanvasStateRaw((previous) => {
          const nextNodes = previous.nodes.map((node) => {
            if (node.id !== resizingNode.id) return node;

            const minWidth = node.type === 'note' ? 220 : 200;
            const minHeight = node.type === 'note' ? 140 : 110;
            const nextWidth = clamp(resizingNode.startWidth + (event.clientX - resizingNode.startX), minWidth, 520);
            const nextHeight = clamp(resizingNode.startHeight + (event.clientY - resizingNode.startY), minHeight, 420);
            return { ...node, width: nextWidth, height: nextHeight };
          });

          const nextState = { ...previous, nodes: nextNodes };
          persistSet(`library_attackchain_${pageKey}`, nextState);
          return nextState;
        });
      }

      if (panningCanvas && viewportRef.current) {
        viewportRef.current.scrollLeft = panningCanvas.startScrollLeft - (event.clientX - panningCanvas.startX);
        viewportRef.current.scrollTop = panningCanvas.startScrollTop - (event.clientY - panningCanvas.startY);
      }
    };

    const handleUp = () => {
      setDraggingNode(null);
      setResizingNode(null);
      setPanningCanvas(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingNode, resizingNode, panningCanvas, pageKey, workspaceSize.height, workspaceSize.width]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollLeft = Math.max((WORKSPACE_MIN_WIDTH - viewportRef.current.clientWidth) / 2, 0);
    viewportRef.current.scrollTop = 80;
  }, []);

  const handleSaveMeta = () => {
    updateMeta(draftMeta);
    setEditingMeta(false);
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    const droppedType = event.dataTransfer.getData('application/x-attack-chain-node');
    if (!droppedType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const style = nodeStyles[droppedType] || nodeStyles.windows;
    const x = clamp(event.clientX - rect.left - style.width / 2, 12, rect.width - style.width - 12);
    const y = clamp(event.clientY - rect.top - style.height / 2, 12, rect.height - style.height - 12);
    const nextNode = makeNode(droppedType, x, y);
    updateCanvasState({ ...canvasState, nodes: [...nodes, nextNode] });
    setSelectedNodeId(nextNode.id);
    setSelectedConnectionId(null);
  };

  const handleNodeMouseDown = (event, node) => {
    if (connectMode) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setDraggingNode({
      id: node.id,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    });
  };

  const handleResizeMouseDown = (event, node) => {
    event.stopPropagation();
    event.preventDefault();
    setResizingNode({
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: node.width || (nodeStyles[node.type] || nodeStyles.windows).width,
      startHeight: node.height || (nodeStyles[node.type] || nodeStyles.windows).height,
    });
  };

  const handleWorkspaceMouseDown = (event) => {
    if (event.target !== event.currentTarget || connectMode) return;
    if (!viewportRef.current) return;
    setPanningCanvas({
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewportRef.current.scrollLeft,
      startScrollTop: viewportRef.current.scrollTop,
    });
  };

  const handleNodeClick = (nodeId) => {
    if (connectMode) {
      if (!pendingConnectionFrom) {
        setPendingConnectionFrom(nodeId);
        setSelectedNodeId(nodeId);
        setSelectedConnectionId(null);
        return;
      }

      if (pendingConnectionFrom === nodeId) {
        setPendingConnectionFrom(null);
        return;
      }

      const duplicate = connections.some(
        (connection) =>
          (connection.fromId === pendingConnectionFrom && connection.toId === nodeId) ||
          (connection.fromId === nodeId && connection.toId === pendingConnectionFrom)
      );

      if (!duplicate) {
        const nextConnection = makeConnection(pendingConnectionFrom, nodeId);
        updateCanvasState({
          ...canvasState,
          connections: [...connections, nextConnection],
        });
        setSelectedConnectionId(nextConnection.id);
      }

      setConnectMode(false);
      setPendingConnectionFrom(null);
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId(nodeId);
    setSelectedConnectionId(null);
  };

  const handleCanvasClick = () => {
    if (connectMode) {
      setPendingConnectionFrom(null);
    }
    setSelectedNodeId(null);
    setSelectedConnectionId(null);
  };

  const updateSelectedNode = (field, value) => {
    if (!selectedNode) return;
    updateCanvasState({
      ...canvasState,
      nodes: nodes.map((node) => (node.id === selectedNode.id ? { ...node, [field]: value } : node)),
    });
  };

  const updateSelectedNodeDimension = (field, value) => {
    if (!selectedNode) return;
    const numeric = Number.parseInt(value, 10);
    if (Number.isNaN(numeric)) return;
    const minValue = field === 'width' ? (selectedNode.type === 'note' ? 220 : 200) : (selectedNode.type === 'note' ? 140 : 110);
    const maxValue = field === 'width' ? 520 : 420;
    updateSelectedNode(field, clamp(numeric, minValue, maxValue));
  };

  const updateSelectedConnection = (field, value) => {
    if (!selectedConnection) return;
    updateCanvasState({
      ...canvasState,
      connections: connections.map((connection) => (
        connection.id === selectedConnection.id ? { ...connection, [field]: value } : connection
      )),
    });
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    updateCanvasState({
      ...canvasState,
      nodes: nodes.filter((node) => node.id !== selectedNode.id),
      connections: connections.filter(
        (connection) => connection.fromId !== selectedNode.id && connection.toId !== selectedNode.id
      ),
    });
    setSelectedNodeId(null);
  };

  const deleteSelectedConnection = () => {
    if (!selectedConnection) return;
    updateCanvasState({
      ...canvasState,
      connections: connections.filter((connection) => connection.id !== selectedConnection.id),
    });
    setSelectedConnectionId(null);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-[#2a2a2a] bg-[#202020] px-6 py-10 text-center">
        {!editingMeta ? (
          <>
            <h1 className={`text-3xl md:text-5xl font-bold tracking-tight ${titleFontClass}`}>
              <span className={titleColorClass}>{meta.title}</span>
            </h1>
            {meta.description && (
              <p className={`mx-auto mt-4 max-w-2xl text-sm ${meta.descriptionFont || 'font-mono'} text-slate-400`}>
                {meta.description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => {
                  setDraftMeta(meta);
                  setEditingMeta(true);
                }}
                className="control-chip inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-mono text-slate-400 transition-all hover:border-slate-500 hover:bg-slate-800 hover:text-slate-200"
              >
                <Pencil className="h-3 w-3" /> Edit Header
              </button>
              <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-[11px] font-mono text-slate-500">
                Drag hosts into the canvas, connect them, and document the pivot path.
              </span>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-xl space-y-4 text-left">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300">Edit Page Header</h3>
            <div>
              <label className="mb-1 block text-xs font-mono text-slate-500">TITLE</label>
              <input
                type="text"
                value={draftMeta.title}
                onChange={(event) => setDraftMeta({ ...draftMeta, title: event.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-slate-200 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-mono text-slate-500">TITLE COLOR</label>
              <div className="flex flex-wrap gap-2">
                {titleColorOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDraftMeta({ ...draftMeta, titleColor: option.value })}
                    className={`control-chip flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono ${
                      draftMeta.titleColor === option.value
                        ? 'border-slate-300 bg-slate-700/90 text-slate-100'
                        : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${option.bg}`} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-mono text-slate-500">TITLE FONT</label>
              <div className="flex flex-wrap gap-2">
                {titleFontOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDraftMeta({ ...draftMeta, titleFont: option.value })}
                    className={`control-chip rounded-lg border px-2.5 py-1.5 text-xs ${
                      draftMeta.titleFont === option.value
                        ? 'border-slate-300 bg-slate-700/90 text-slate-100'
                        : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500'
                    } ${option.value}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-mono text-slate-500">DESCRIPTION</label>
              <textarea
                value={draftMeta.description}
                onChange={(event) => setDraftMeta({ ...draftMeta, description: event.target.value })}
                className="h-24 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-mono text-slate-200 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-mono text-slate-500">DESCRIPTION FONT</label>
              <div className="flex flex-wrap gap-2">
                {titleFontOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDraftMeta({ ...draftMeta, descriptionFont: option.value })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs transition-all border ${(draftMeta.descriptionFont || 'font-mono') === option.value
                      ? 'border-slate-400 bg-slate-700 text-slate-100'
                      : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-500'
                    } ${option.value}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingMeta(false)}
                className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-mono text-slate-300 transition-colors hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMeta}
                className="flex-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-mono font-semibold text-white transition-colors hover:bg-cyan-700"
              >
                <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" /> Save</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="soft-panel rounded-2xl p-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-slate-400">Palette</h2>
          <div className="mt-4 space-y-3">
            {paletteItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('application/x-attack-chain-node', item.type)}
                  className={`control-chip cursor-grab rounded-2xl border bg-gradient-to-br px-4 py-4 ${item.border} ${item.accent}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl border p-2 ${item.border} bg-slate-950/60`}>
                      <Icon className={`h-4 w-4 ${item.text}`} />
                    </div>
                    <div>
                      <p className={`font-mono text-sm font-semibold ${item.text}`}>{item.label}</p>
                      <p className="mt-1 text-[11px] font-mono text-slate-500">Drag onto canvas</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-slate-400">Links</h3>
            <button
              onClick={() => {
                setConnectMode((previous) => !previous);
                setPendingConnectionFrom(null);
                setSelectedConnectionId(null);
              }}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-mono transition-all ${
                connectMode
                  ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <Link2 className="h-4 w-4" /> {connectMode ? 'Cancel Connect Mode' : 'Connect Machines'}
            </button>
            <p className="mt-3 text-[11px] font-mono leading-relaxed text-slate-500">
              {connectMode
                ? pendingConnectionFrom
                  ? 'Select the destination node to create the pivot path.'
                  : 'Select the source node to start a connection.'
                : 'Use connect mode to document how one host led to the next.'}
            </p>
          </div>
        </aside>

        <section className="soft-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-slate-400">Canvas</h2>
              <p className="mt-1 text-[11px] font-mono text-slate-500">Drop Windows/Linux machines and attack notes, then drag them into position.</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-[11px] font-mono text-slate-500">
              {nodes.length} nodes / {connections.length} links
            </span>
          </div>

          <div
            ref={viewportRef}
            className="h-[760px] overflow-auto rounded-2xl border border-slate-800"
          >
          <div
            ref={canvasRef}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
            onClick={handleCanvasClick}
            onMouseDown={handleWorkspaceMouseDown}
            className={`relative overflow-hidden bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,11,18,0.98))] bg-[size:32px_32px,32px_32px,100%_100%] ${panningCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ width: workspaceSize.width, height: workspaceSize.height }}
          >
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-6 text-center">
                  <p className="font-mono text-sm text-slate-300">Drop a host or note here to start the chain</p>
                  <p className="mt-2 font-mono text-[11px] text-slate-500">Drag from the palette to create the first machine in your path.</p>
                </div>
              </div>
            )}

            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {canvasConnections.map((connection) => (
                <g key={connection.id}>
                  <line
                    x1={connection.x1}
                    y1={connection.y1}
                    x2={connection.x2}
                    y2={connection.y2}
                    stroke={selectedConnectionId === connection.id ? '#67e8f9' : 'rgba(148, 163, 184, 0.55)'}
                    strokeWidth={selectedConnectionId === connection.id ? 2.5 : 2}
                    strokeDasharray={selectedConnectionId === connection.id ? '0' : '7 6'}
                  />
                </g>
              ))}
            </svg>

            {canvasConnections.map((connection) => (
              <button
                key={`${connection.id}-label`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedConnectionId(connection.id);
                  setSelectedNodeId(null);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-[11px] font-mono transition-all ${
                  selectedConnectionId === connection.id
                    ? 'border-cyan-400/40 bg-cyan-500/12 text-cyan-100'
                    : 'border-slate-700 bg-slate-950/85 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
                style={{ left: connection.midX, top: connection.midY }}
              >
                {connection.label || 'Link'}
              </button>
            ))}

            {nodes.map((node) => {
              const style = nodeStyles[node.type] || nodeStyles.windows;
              const Icon = style.icon;
              const selected = selectedNodeId === node.id;
              const connectSource = pendingConnectionFrom === node.id;
              const width = node.width || style.width;
              const height = node.height || style.height;
              return (
                <div
                  key={node.id}
                  onMouseDown={(event) => handleNodeMouseDown(event, node)}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNodeClick(node.id);
                  }}
                  className={`absolute cursor-pointer rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-4 shadow-[0_14px_40px_rgba(2,6,23,0.35)] transition-all ${
                    style.border
                  } ${selected ? `ring-2 ${style.ring}` : ''} ${connectSource ? 'ring-2 ring-cyan-300/50' : ''}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width,
                    minHeight: height,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] ${style.chip}`}>
                      <Icon className="h-3 w-3" />
                      {node.type}
                    </span>
                    {selected && (
                      <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                        selected
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-3 text-sm font-semibold ${style.title}`}>{node.title}</h3>
                  <p className={`mt-2 whitespace-pre-wrap text-xs leading-relaxed ${style.body}`}>
                    {node.details || 'Add attack details in the inspector.'}
                  </p>
                  {node.notes && (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Operator Note</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{node.notes}</p>
                    </div>
                  )}
                  <button
                    onMouseDown={(event) => handleResizeMouseDown(event, node)}
                    onClick={(event) => event.stopPropagation()}
                    className="absolute bottom-2 right-2 h-4 w-4 rounded-sm border border-slate-600 bg-slate-800/90 text-slate-400 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
                    title="Resize node"
                  >
                    <span className="absolute bottom-[1px] right-[1px] block h-[6px] w-[6px] border-b border-r border-current" />
                  </button>
                </div>
              );
            })}
          </div>
          </div>
        </section>

        <aside className="soft-panel rounded-2xl p-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-slate-400">Inspector</h2>

          {!selectedNode && !selectedConnection && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-700 bg-slate-950/45 p-4 text-center">
              <p className="font-mono text-sm text-slate-300">Nothing selected</p>
              <p className="mt-2 text-[11px] font-mono text-slate-500">
                Select a host, note, or connection label to edit how the chain progressed.
              </p>
            </div>
          )}

          {selectedNode && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-slate-200">Node Details</h3>
                <button
                  onClick={deleteSelectedNode}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-mono text-red-300 transition-colors hover:bg-red-500/15"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-slate-500">TITLE</label>
                <input
                  type="text"
                  value={selectedNode.title}
                  onChange={(event) => updateSelectedNode('title', event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-slate-500">DETAILS</label>
                <textarea
                  value={selectedNode.details}
                  onChange={(event) => updateSelectedNode('details', event.target.value)}
                  className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-mono text-slate-500">WIDTH</label>
                  <input
                    type="number"
                    min={selectedNode.type === 'note' ? 220 : 200}
                    max={520}
                    value={selectedNode.width || (nodeStyles[selectedNode.type] || nodeStyles.windows).width}
                    onChange={(event) => updateSelectedNodeDimension('width', event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-mono text-slate-500">HEIGHT</label>
                  <input
                    type="number"
                    min={selectedNode.type === 'note' ? 140 : 110}
                    max={420}
                    value={selectedNode.height || (nodeStyles[selectedNode.type] || nodeStyles.windows).height}
                    onChange={(event) => updateSelectedNodeDimension('height', event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-slate-500">OPERATOR NOTES</label>
                <textarea
                  value={selectedNode.notes}
                  onChange={(event) => updateSelectedNode('notes', event.target.value)}
                  placeholder="Commands used, shells landed, creds found, artifacts copied..."
                  className="h-32 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {selectedConnection && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-mono font-bold text-slate-200">Connection Details</h3>
                <button
                  onClick={deleteSelectedConnection}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-mono text-red-300 transition-colors hover:bg-red-500/15"
                >
                  <Unlink className="h-3 w-3" /> Delete
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-slate-500">LINK LABEL</label>
                <input
                  type="text"
                  value={selectedConnection.label}
                  onChange={(event) => updateSelectedConnection('label', event.target.value)}
                  placeholder="RDP, SSH, WinRM, stolen creds, pivot tunnel..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-slate-500">MOVEMENT NOTES</label>
                <textarea
                  value={selectedConnection.notes}
                  onChange={(event) => updateSelectedConnection('notes', event.target.value)}
                  placeholder="How the link was achieved, what creds or route were used, and any blockers."
                  className="h-40 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
