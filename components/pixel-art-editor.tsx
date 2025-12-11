"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Undo2,
  Redo2,
  Eraser,
  PaintBucket,
  Pencil,
  Grid3X3,
  Pipette,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- Types ---

type PixelGrid = string[][] // hex codes or empty string

interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number // 0-100
  grid: PixelGrid
}

type Tool = "pencil" | "eraser" | "bucket" | "picker"

interface HistoryState {
  layers: Layer[]
  gridSize: number
}

// --- Constants ---

const DEFAULT_GRID_SIZE = 16
const MAX_HISTORY = 20
const COLORS = [
  "#000000",
  "#1a1c2c",
  "#5d275d",
  "#b13e53",
  "#ef7d57",
  "#ffcd75",
  "#a7f070",
  "#38b764",
  "#257179",
  "#29366f",
  "#3b5dc9",
  "#41a6f6",
  "#73eff7",
  "#f4f4f4",
  "#94b0c2",
  "#566c86",
  "#333c57",
  "#ffffff",
  "#ff0044",
  "#00ff99",
  "#ffff00",
  "#00ccff",
  "#9900ff",
  "#ff6600",
]

// --- Helper Functions ---

const createEmptyGrid = (size: number): PixelGrid => {
  return Array(size)
    .fill(null)
    .map(() => Array(size).fill(""))
}

const generateId = () => Math.random().toString(36).substr(2, 9)

// --- Main Component ---

export default function PixelArtEditor() {
  // State
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE)
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-1", name: "Layer 1", visible: true, opacity: 100, grid: createEmptyGrid(DEFAULT_GRID_SIZE) },
  ])
  const [activeLayerId, setActiveLayerId] = useState("layer-1")
  const [selectedColor, setSelectedColor] = useState("#ff6b00")
  const [tool, setTool] = useState<Tool>("pencil")
  const [isDrawing, setIsDrawing] = useState(false)
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showGridLines, setShowGridLines] = useState(true)
  const [zoom, setZoom] = useState(1)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      const initialState = { layers: JSON.parse(JSON.stringify(layers)), gridSize }
      setHistory([initialState])
      setHistoryIndex(0)
    }
  }, [])

  // --- History Management ---

  const addToHistory = useCallback(
    (newLayers: Layer[], newGridSize: number) => {
      const newState = { layers: JSON.parse(JSON.stringify(newLayers)), gridSize: newGridSize }
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(newState)
      if (newHistory.length > MAX_HISTORY) newHistory.shift()

      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    },
    [history, historyIndex],
  )

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setLayers(JSON.parse(JSON.stringify(prevState.layers)))
      setGridSize(prevState.gridSize)
      setHistoryIndex(historyIndex - 1)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setLayers(JSON.parse(JSON.stringify(nextState.layers)))
      setGridSize(nextState.gridSize)
      setHistoryIndex(historyIndex + 1)
    }
  }

  // --- Drawing Logic ---

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    const x = Math.floor(((clientX - rect.left) / rect.width) * gridSize)
    const y = Math.floor(((clientY - rect.top) / rect.height) * gridSize)

    return { x, y }
  }

  const floodFill = (layerIndex: number, x: number, y: number, targetColor: string, replacementColor: string) => {
    if (targetColor === replacementColor) return
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return

    const newLayers = [...layers]
    const grid = newLayers[layerIndex].grid
    const currentColor = grid[y][x]

    if (currentColor !== targetColor) return

    grid[y][x] = replacementColor

    floodFill(layerIndex, x + 1, y, targetColor, replacementColor)
    floodFill(layerIndex, x - 1, y, targetColor, replacementColor)
    floodFill(layerIndex, x, y + 1, targetColor, replacementColor)
    floodFill(layerIndex, x, y - 1, targetColor, replacementColor)

    setLayers(newLayers)
  }

  const handleDraw = (x: number, y: number, isClick = false) => {
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return

    const layerIndex = layers.findIndex((l) => l.id === activeLayerId)
    if (layerIndex === -1 || !layers[layerIndex].visible) return

    const currentLayer = layers[layerIndex]

    // For picker tool
    if (tool === "picker") {
      // Find the top-most visible color at this pixel
      for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].visible && layers[i].grid[y][x]) {
          setSelectedColor(layers[i].grid[y][x])
          setTool("pencil")
          return
        }
      }
      return
    }

    // Clone layers for mutation
    const newLayers = [...layers]
    newLayers[layerIndex] = { ...currentLayer, grid: currentLayer.grid.map((row) => [...row]) }

    if (tool === "bucket" && isClick) {
      const targetColor = newLayers[layerIndex].grid[y][x]
      floodFill(layerIndex, x, y, targetColor, selectedColor)
      addToHistory(newLayers, gridSize)
    } else if (tool === "pencil" || tool === "eraser") {
      const color = tool === "eraser" ? "" : selectedColor
      if (newLayers[layerIndex].grid[y][x] !== color) {
        newLayers[layerIndex].grid[y][x] = color
        setLayers(newLayers)
      }
    }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    const coords = getCoordinates(e)
    if (coords) handleDraw(coords.x, coords.y, true)
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const coords = getCoordinates(e)
    if (coords) handleDraw(coords.x, coords.y)
  }

  const handlePointerUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      addToHistory(layers, gridSize)
    }
  }

  // --- Layer Management ---

  const addLayer = () => {
    const newLayer: Layer = {
      id: generateId(),
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 100,
      grid: createEmptyGrid(gridSize),
    }
    const newLayers = [...layers, newLayer]
    setLayers(newLayers)
    setActiveLayerId(newLayer.id)
    addToHistory(newLayers, gridSize)
  }

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return
    const newLayers = layers.filter((l) => l.id !== id)
    setLayers(newLayers)
    if (activeLayerId === id) {
      setActiveLayerId(newLayers[newLayers.length - 1].id)
    }
    addToHistory(newLayers, gridSize)
  }

  const toggleLayerVisibility = (id: string) => {
    const newLayers = layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    setLayers(newLayers)
    addToHistory(newLayers, gridSize)
  }

  const updateLayerOpacity = (id: string, opacity: number) => {
    const newLayers = layers.map((l) => (l.id === id ? { ...l, opacity } : l))
    setLayers(newLayers)
    // Don't add to history on every slide event, maybe debounce or onMouseUp
  }

  const changeGridSize = (size: number) => {
    if (size === gridSize) return
    // Create new grids with new size, preserving data if possible (top-left aligned)
    const newLayers = layers.map((layer) => {
      const newGrid = createEmptyGrid(size)
      for (let y = 0; y < Math.min(size, gridSize); y++) {
        for (let x = 0; x < Math.min(size, gridSize); x++) {
          newGrid[y][x] = layer.grid[y][x]
        }
      }
      return { ...layer, grid: newGrid }
    })
    setGridSize(size)
    setLayers(newLayers)
    addToHistory(newLayers, size)
  }

  // --- Export ---

  const handleExport = () => {
    const canvas = document.createElement("canvas")
    const scale = 20 // Scale up for export
    canvas.width = gridSize * scale
    canvas.height = gridSize * scale
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Draw checkerboard background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw layers
    layers.forEach((layer) => {
      if (!layer.visible) return
      ctx.globalAlpha = layer.opacity / 100
      layer.grid.forEach((row, y) => {
        row.forEach((color, x) => {
          if (color) {
            ctx.fillStyle = color
            ctx.fillRect(x * scale, y * scale, scale, scale)
          }
        })
      })
    })

    const link = document.createElement("a")
    link.download = "pixel-art.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))

  // --- Rendering ---

  // Render the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw checkerboard background for transparency
    const cellSize = canvas.width / gridSize

    // Draw layers
    layers.forEach((layer) => {
      if (!layer.visible) return
      ctx.globalAlpha = layer.opacity / 100
      layer.grid.forEach((row, y) => {
        row.forEach((color, x) => {
          if (color) {
            ctx.fillStyle = color
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
          }
        })
      })
    })

    // Draw grid lines
    if (showGridLines) {
      ctx.globalAlpha = 0.1
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i <= gridSize; i++) {
        ctx.moveTo(i * cellSize, 0)
        ctx.lineTo(i * cellSize, canvas.height)
        ctx.moveTo(0, i * cellSize)
        ctx.lineTo(canvas.width, i * cellSize)
      }
      ctx.stroke()
    }

    // Reset alpha
    ctx.globalAlpha = 1.0
  }, [layers, gridSize, showGridLines])

  return (
    <div className="flex h-screen w-full bg-[#0f1115] text-[#a1a1aa] font-sans selection:bg-orange-500/30">
      {/* Left Sidebar - Layers & Info */}
      <div className="w-80 flex flex-col border-r border-white/5 p-4 gap-6 bg-[#13151a]">
        {/* Header */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
            <Grid3X3 className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg tracking-tight">Pixel Studio</h1>
            <p className="text-xs text-zinc-500">Untitled Project</p>
          </div>
        </div>

        {/* Layers Panel */}
        <div className="flex-1 flex flex-col bg-[#1c1e24] rounded-2xl overflow-hidden border border-white/5 shadow-xl">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#22242a]">
            <span className="text-sm font-medium text-zinc-300">Layers</span>
            <button
              onClick={addLayer}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {layers
              .slice()
              .reverse()
              .map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayerId(layer.id)}
                  className={cn(
                    "group flex flex-col gap-2 p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                    activeLayerId === layer.id ? "bg-[#2a2d36] border-white/5 shadow-lg" : "hover:bg-white/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLayerVisibility(layer.id)
                        }}
                        className={cn(
                          "p-1 rounded-md transition-colors",
                          layer.visible ? "text-zinc-400 hover:text-white" : "text-zinc-600",
                        )}
                      >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          activeLayerId === layer.id ? "text-white" : "text-zinc-400",
                        )}
                      >
                        {layer.name}
                      </span>
                    </div>
                    {layers.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteLayer(layer.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Opacity Slider */}
                  {activeLayerId === layer.id && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] text-zinc-500 w-8">Opac</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={layer.opacity}
                        onChange={(e) => updateLayerOpacity(layer.id, Number.parseInt(e.target.value))}
                        className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500"
                      />
                      <span className="text-[10px] text-zinc-500 w-6 text-right">{layer.opacity}%</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative bg-[#0f1115] overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#0f1115]/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 bg-[#1c1e24] p-1 rounded-lg border border-white/5">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 hover:bg-white/5 rounded-md disabled:opacity-30 transition-colors"
            >
              <Undo2 size={18} />
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 hover:bg-white/5 rounded-md disabled:opacity-30 transition-colors"
            >
              <Redo2 size={18} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#1c1e24] p-1 rounded-lg border border-white/5">
              <button onClick={handleZoomOut} className="p-2 hover:bg-white/5 rounded-md transition-colors">
                <ZoomOut size={18} />
              </button>
              <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className="p-2 hover:bg-white/5 rounded-md transition-colors">
                <ZoomIn size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-[#1c1e24] px-3 py-1.5 rounded-lg border border-white/5">
              <span className="text-xs font-medium text-zinc-400">Grid</span>
              <select
                value={gridSize}
                onChange={(e) => changeGridSize(Number.parseInt(e.target.value))}
                className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="8">8x8</option>
                <option value="16">16x16</option>
                <option value="32">32x32</option>
                <option value="64">64x64</option>
              </select>
            </div>

            <button
              onClick={() => setShowGridLines(!showGridLines)}
              className={cn(
                "p-2 rounded-lg border border-white/5 transition-colors",
                showGridLines
                  ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                  : "bg-[#1c1e24] hover:bg-white/5",
              )}
            >
              <Grid3X3 size={18} />
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-orange-900/20"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative"
          style={{
            backgroundImage: "radial-gradient(#27272a 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          <div className="min-w-full min-h-full flex items-center justify-center p-16">
            <div
              className="relative shadow-2xl shadow-black/50 transition-all duration-200 ease-out flex-shrink-0"
              style={{
                width: `${600 * zoom}px`,
                height: `${600 * zoom}px`,
              }}
            >
              {/* Checkerboard Background for transparency */}
              <div
                className="absolute inset-0 z-0 rounded-sm"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #1f2126 25%, transparent 25%), linear-gradient(-45deg, #1f2126 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2126 75%), linear-gradient(-45deg, transparent 75%, #1f2126 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                  backgroundColor: "#18181b",
                }}
              />

              <canvas
                ref={canvasRef}
                width={gridSize * 20} // Internal resolution
                height={gridSize * 20}
                className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none image-pixelated rounded-sm border border-white/10"
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          {/* Floating Toolbar */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1c1e24]/90 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-2xl z-50">
            {[
              { id: "pencil", icon: Pencil, label: "Pencil" },
              { id: "eraser", icon: Eraser, label: "Eraser" },
              { id: "bucket", icon: PaintBucket, label: "Fill" },
              { id: "picker", icon: Pipette, label: "Picker" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id as Tool)}
                className={cn(
                  "p-3 rounded-xl transition-all relative group",
                  tool === t.id
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-900/20"
                    : "text-zinc-400 hover:text-white hover:bg-white/5",
                )}
                title={t.label}
              >
                <t.icon size={20} />
                {/* Tooltip */}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {t.label}
                </span>
              </button>
            ))}

            <div className="w-px h-8 bg-white/10 mx-1" />

            {/* Color Picker */}
            <div className="flex items-center gap-2 px-2">
              <div className="relative group">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-8 h-8 rounded-full overflow-hidden cursor-pointer border-2 border-white/20 p-0 bg-transparent"
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "w-4 h-4 rounded-full border border-white/10 transition-transform hover:scale-110",
                      selectedColor === c && "ring-2 ring-white ring-offset-1 ring-offset-[#1c1e24]",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-72 bg-[#13151a] border-l border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-white font-medium mb-1">Properties</h2>
          <p className="text-xs text-zinc-500">Adjust tool settings</p>
        </div>

        <div className="p-6 space-y-8">
          {/* Color Picker */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-lg border transition-all hover:scale-110",
                    selectedColor === color
                      ? "border-white shadow-lg scale-110 ring-2 ring-orange-500/50"
                      : "border-transparent hover:border-white/20",
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
              <label className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors">
                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-500 to-pink-500" />
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="opacity-0 absolute w-0 h-0"
                />
              </label>
            </div>
          </div>

          {/* Tool Info */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Tool</label>
            <div className="bg-[#1c1e24] p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                  {tool === "pencil" && <Pencil size={18} />}
                  {tool === "eraser" && <Eraser size={18} />}
                  {tool === "bucket" && <PaintBucket size={18} />}
                  {tool === "picker" && <Pipette size={18} />}
                </div>
                <div>
                  <div className="text-sm font-medium text-white capitalize">{tool}</div>
                  <div className="text-xs text-zinc-500">
                    {tool === "pencil" && "Click and drag to draw pixels"}
                    {tool === "eraser" && "Click and drag to remove pixels"}
                    {tool === "bucket" && "Fill connected area with color"}
                    {tool === "picker" && "Pick color from canvas"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Info */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Canvas Info</label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Dimensions</span>
                <span className="text-zinc-300">
                  {gridSize} x {gridSize} px
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Layers</span>
                <span className="text-zinc-300">{layers.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total Pixels</span>
                <span className="text-zinc-300">{gridSize * gridSize}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
