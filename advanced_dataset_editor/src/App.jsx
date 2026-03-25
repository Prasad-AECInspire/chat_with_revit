// Tailwind + minimal CSS via index.html CDN
import React, { useState, useRef, useEffect } from "react";

import {
  Stage,
  Layer,
  Rect,
  Circle,
  Line,
  Text,
  Image as KonvaImage,
} from "react-konva";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import yaml from "js-yaml";
import { useNotification } from "./components/NotificationContext";
import MergeDatasets from "./components/MergeDatasets";
import Dashboard from "./components/Dashboard";
import DatasetMonitor from "./components/DatasetMonitor";
import ContextMenu from "./components/ContextMenu";
// import TestingSection from './TestingSection';
import ImageCropper from "./components/ImageCropper";
import LoadingProgress from "./components/LoadingProgress";
import VirtualImageGrid from "./components/VirtualImageGrid";
import { useMemoryMonitor, formatBytes } from "./hooks/MemoryMonitorHook.js";
import { fileToBlob, cleanupBlobUrls } from "./utils/ImageUtils.js";
import CopyPasteAugmentationApp from "./components/CopyPasteAugmentation";
import ImageUploader from "./components/ImageUploader";
import ImageSelectionModal from "./components/ImageSelectionModal";
import AddClass from "./components/AddClass";
import SearchableDropdown from "./components/SearchableDropdown";
import ImageAugmentationTool from "./components/ImageAugmentationTool";
import {
  onDrop,
  handleIndividualImageUpload,
  getImagesWithClass,
  handleDatasetSplitChange,
  normalizedToPixel,
  handleImageSelect,
  goToPreviousImage,
  goToNextImage,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleAnnotationSelect,
  handleAnnotationDelete,
  handleContextMenu,
  getContextMenuOptions,
  handleMultipleAnnotationDelete,
  handleAnnotationClassChange,
  handleZoom,
  handleStageMouseMove,
  handleStageMouseEnter,
  handleStageMouseLeave,
  handleStageMouseDown,
  saveAnnotations,
  downloadDataset,
  downloadSegmentationDataset,
  applyGlobalPadding,
  resetClassPadding,
  handleClassRename,
  handleConfirmSelection,
  handleGetImage,
  loadDatasetAllSplits,
  handleAnnotationSizeChange,
  updateImageAnnotations
} from "./helpers/helpers.js";

const App = () => {
  // State management
  const { showNotification } = useNotification();
  const [dataset, setDataset] = useState(null);
  const [datasetConfig, setDatasetConfig] = useState(null); // Store original dataset config
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Selection Modal State
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [candidateFiles, setCandidateFiles] = useState([]);
  const [preloadedImage, setPreloadedImage] = useState(null); // Cache preloaded image
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [classes, setClasses] = useState(["duplex_receptacle"]);
  const [selectedClass, setSelectedClass] = useState("duplex_receptacle");
  const [tool, setTool] = useState("select"); // select, rectangle, polygon
  const [isDrawing, setIsDrawing] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [newAnnotation, setNewAnnotation] = useState(null); // For interactive drawing
  const [newPolygonPoints, setNewPolygonPoints] = useState([]); // For polygon drawing
  const [batchStartIndex, setBatchStartIndex] = useState(0); // For batch navigation
  const [batchSize] = useState(50); // Show 50 images per batch
  const [editingAnnotation, setEditingAnnotation] = useState(null); // For annotation editing
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null); // For hover tooltip
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(null);
  const [crosshairPos, setCrosshairPos] = useState({ x: 0, y: 0 });
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [currentView, setCurrentView] = useState("editor"); // 'editor', 'dashboard', 'merge', 'monitor', or 'testing'
  const [newValue, setNewValue] = useState(1);

  // State for global padding settings
  const [classPadding, setClassPadding] = useState({}); // { classId: { width: 0.1, height: 0.1 } }

  // Store modified images for each split to preserve changes
  const [modifiedImages, setModifiedImages] = useState({});

  // State for dataset split selection
  const [datasetSplit, setDatasetSplit] = useState("train"); // train, valid, test
  const [availableSplits, setAvailableSplits] = useState([
    "train",
    "valid",
    "test",
  ]); // Always include all splits by default

  // State for scratch class names (comma-separated list)
  const [scratchClassNames, setScratchClassNames] = useState("");
  // State for single class addition in sidebar
  const [sidebarClassName, setSidebarClassName] = useState("");

  // State for rectangle dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartAnnotation, setDragStartAnnotation] = useState(null);

  const [isClassWiseBatch, setIsClassWiseBatch] = useState(false);
  const [classWiseBatchClass, setClassWiseBatchClass] = useState(null);

  // State for resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw', 'ne', 'sw', 'se'

  // State for multiple selection
  const [selectedAnnotations, setSelectedAnnotations] = useState([]); // Array of selected annotation IDs

  // State for context menu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    annotation: null,
  });

  // Flag to track if dataset is loaded from ZIP (prevents API calls)
  const [isZipDataset, setIsZipDataset] = useState(false);
  // Track dataset type: 'yolo' or 'segmentation' (detected on upload)
  const [datasetType, setDatasetType] = useState(null);

  // Helper function to check if API calls are allowed
  const canMakeApiCall = () => {
    if (isZipDataset) {
      console.warn(
        "⚠️ API call blocked: Dataset is loaded from ZIP file. No API calls allowed."
      );
      return false;
    }
    return true;
  };

  // Add these to your existing useState declarations
  const [loadingProgress, setLoadingProgress] = useState({
    active: false,
    current: 0,
    total: 0,
    stage: "",
    canCancel: false,
  });

  const [loadingCancelled, setLoadingCancelled] = useState(false);
  const { memoryInfo, checkMemory } = useMemoryMonitor(3000);
  const blobUrlsRef = useRef([]);
  useEffect(() => {
    return () => {
      cleanupBlobUrls(blobUrlsRef.current);
    };
  }, []);

  const onDropHelper = async (acceptedFiles) => {
    await onDrop(
      acceptedFiles,
      acceptedFiles,
      images,
      setImages,
      dataset,
      setDataset,
      setDatasetConfig,
      setClasses,
      setSelectedClass,
      setAvailableSplits,
      availableSplits,
      setModifiedImages,
      setIsZipDataset,
      datasetSplit,
      setDatasetSplit,
      setAnnotations,
      setCurrentImageIndex,
      setLoadingProgress,
      setLoadingCancelled,
      loadingCancelled,
      blobUrlsRef,
      checkMemory,
      setSelectedAnnotation,
      setNewAnnotation,
      setEditingAnnotation,
      setHoveredAnnotation,
      setSelectedAnnotations,
      setScale, // Pass setScale
      setStagePos, // Pass setStagePos
      setDatasetType
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropHelper,
    onDragEnter: () => console.log("🔍 Drag ENTER"),
    onDragLeave: () => console.log("🔍 Drag LEAVE"),
  });

  // Refs
  const stageRef = useRef();
  const imageRef = useRef();
  const fileInputRef = useRef();

  // Current image data
  const currentImage = images[currentImageIndex];

  // Clear polygon points when switching tools
  useEffect(() => {
    if (tool !== "polygon" && tool !== "white-patch") {
      setNewPolygonPoints([]);
    }
  }, [tool]);

  // Keyboard shortcuts for tools and views
  useEffect(() => {
    const onKeyDown = (e) => {
      const key = (e.key || "").toLowerCase();

      // Handle Enter for polygon finalization without needing Ctrl/Cmd
      if (key === "enter") {
        if (
          (tool === "polygon" || tool === "white-patch") &&
          newPolygonPoints.length > 100
        ) {
          e.preventDefault();
          const newAnnotationObj = {
            id: Date.now(),
            classId: classes.indexOf(selectedClass),
            points: newPolygonPoints,
            type: "polygon",
            isWhitePatch: tool === "white-patch",
          };

          const updatedAnnotations = [...annotations, newAnnotationObj];
          setAnnotations(updatedAnnotations);
          setSelectedAnnotation(newAnnotationObj);
          setEditingAnnotation({ ...newAnnotationObj });
          setNewPolygonPoints([]);

          updateImageAnnotations(
            currentImageIndex,
            updatedAnnotations,
            images,
            modifiedImages,
            datasetSplit,
            setImages,
            setModifiedImages,
            isZipDataset
          );
          return;
        }
      }

      const mod = e.ctrlKey || e.metaKey; // support Cmd on Mac
      if (!mod) return;

      // Prevent default browser actions for mapped shortcuts
      if (["s", "q", "p", "d"].includes(key)) e.preventDefault();

      switch (key) {
        case "s": // Ctrl/Cmd+S -> select tool
          setTool("select");
          setCurrentView("editor");
          break;
        case "q": // Ctrl/Cmd+Q -> rectangle tool
          setTool("rectangle");
          setCurrentView("editor");
          break;
        case "p": // Ctrl/Cmd+P -> polygon tool
          setTool("polygon");
          setCurrentView("editor");
          break;
        case "d": // Ctrl/Cmd+D -> dashboard view
          setCurrentView("dashboard");
          break;
        // add more mappings here as needed
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setTool, setCurrentView]);

  // Add keyboard shortcut for Delete/Backspace to remove selected annotations
  useEffect(() => {
    const onKeyDown = (e) => {
      // don't trigger when typing in inputs or editable elements
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedAnnotations.length > 0) {
          handleMultipleAnnotationDelete(
            selectedAnnotations,
            annotations,
            setAnnotations,
            currentImageIndex,
            images,
            modifiedImages,
            datasetSplit,
            setImages,
            setModifiedImages,
            setSelectedAnnotations,
            setSelectedAnnotation,
            setEditingAnnotation,
            isZipDataset
          );
        } else if (selectedAnnotation) {
          const annotationIdentifier =
            selectedAnnotation.unique_id || selectedAnnotation.id;
          handleAnnotationDelete(
            annotationIdentifier,
            annotations,
            setAnnotations,
            currentImageIndex,
            images,
            modifiedImages,
            datasetSplit,
            setImages,
            setModifiedImages,
            selectedAnnotation,
            setSelectedAnnotation,
            setEditingAnnotation,
            hoveredAnnotation,
            setHoveredAnnotation,
            isZipDataset
          );
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedAnnotations,
    selectedAnnotation,
    handleMultipleAnnotationDelete,
    handleAnnotationDelete,
  ]);

  // Preload current image to ensure it loads before rendering
  useEffect(() => {
    if (currentImage && currentImage.src) {
      console.log(`🖼️ Loading image: ${currentImage.name} (${currentImage.src.substring(0, 30)}...)`);
      setPreloadedImage(null); // Clear previous image while loading new one
      setIsImageLoading(true);
      setImageLoadError(null);

      const img = new window.Image();

      // OPTIMIZATION: Conditional crossOrigin
      // Only set for external/http URLs to avoid issues with blobs/base64
      if (currentImage.src.startsWith('http')) {
        img.crossOrigin = "anonymous";
      }

      const handleLoad = () => {
        console.log(`✅ Image loaded: ${currentImage.name} (${img.width}x${img.height})`);
        setPreloadedImage(img);
        setIsImageLoading(false);

        // Dynamic Stage Size Calculation
        const maxWidth = Math.max(800, window.innerWidth * 0.75); // More space
        const maxHeight = Math.max(600, window.innerHeight * 0.85);
        const imageRatio = img.width / img.height;
        const containerRatio = maxWidth / maxHeight;

        let newWidth, newHeight;
        if (imageRatio > containerRatio) {
          newWidth = maxWidth;
          newHeight = maxWidth / imageRatio;
        } else {
          newHeight = maxHeight;
          newWidth = maxHeight * imageRatio;
        }

        setStageSize({ width: newWidth, height: newHeight });
      };

      const handleError = (e) => {
        console.error("❌ Failed to load image:", currentImage.src, e);
        setPreloadedImage(null);
        setIsImageLoading(false);
        setImageLoadError(`Failed to load ${currentImage.name}. Check source or CORS settings.`);
        showNotification(`Failed to load image: ${currentImage.name}`, "error");
      };

      img.onload = handleLoad;
      img.onerror = handleError;
      img.src = currentImage.src;
    } else {
      setIsImageLoading(false);
      setImageLoadError(null);
    }
  }, [currentImage?.src, currentImage?.id]);

  // ============================================
  // OPTIMIZATION: Preload adjacent images for smooth navigation
  // ============================================
  useEffect(() => {
    const preloadAdjacentImages = async () => {
      if (!images || images.length === 0) return;

      // Preload next 2 and previous 2 images
      const indicesToPreload = [
        currentImageIndex - 2,
        currentImageIndex - 1,
        currentImageIndex + 1,
        currentImageIndex + 2,
      ].filter((idx) => idx >= 0 && idx < images.length);

      for (const idx of indicesToPreload) {
        const image = images[idx];

        // If image has a diskPath but no src, load it
        if (image && image.diskPath && !image.src) {
          console.log(`🔄 Preloading image ${idx + 1}/${images.length}`);
          await loadImageFromDisk(image.diskPath);
        }
      }
    };

    preloadAdjacentImages();
  }, [currentImageIndex, images]);

  // Function to get a consistent color for each class
  const getClassColor = (classId) => {
    const colors = [
      "#ba7a0aff",
      "#4ECDC4",
      "#45B7D1",
      "#FFBE0B",
      "#FB5607",
      "#8338EC",
      "#3A86FF",
      "#06D6A0",
      "#118AB2",
      "#073B4C",
      "#EF476F",
      "#FFD166",
      "#073B4C",
      "#118AB2",
      "#06D6A0",
      "#a4854fff",
      "#48a7a0ff",
      "#45B7D1",
      "#72c174ff",
      "#6c3c26ff",
      "#230b45ff",
      "#7f9ed0ff",
      "#2e7965ff",
      "#294e5bff",
      "#2e4d58ff",
      "#6a2233ff",
      "#443513ff",
      "#00bfffff",
      "#ff0606ff",
      "#337866ff",
    ];
    let index = parseInt(classId % colors.length);
    return colors[index];
  };

  // Calculate current batch with class filtering and split filtering for manual datasets
  const isManualDataset =
    dataset &&
    !(dataset instanceof File) &&
    !(dataset instanceof Blob) &&
    dataset.name === "Manual Dataset";

  const splitImages = isManualDataset
    ? images.filter((img, idx) => {
      const trainCount = Math.ceil(images.length * 0.8);
      const split = idx < trainCount ? "train" : "valid";
      return split === datasetSplit;
    })
    : images && images.length > 0
      ? images.filter((img) => img.split === datasetSplit)
      : [];

  const displayImages =
    isClassWiseBatch && classWiseBatchClass !== null
      ? getImagesWithClass(classWiseBatchClass, splitImages)
      : splitImages;

  const currentBatch = displayImages.slice(
    batchStartIndex,
    batchStartIndex + batchSize
  );
  const totalBatches = Math.ceil(displayImages.length / batchSize);
  const currentBatchIndex = Math.floor(batchStartIndex / batchSize) + 1;

  // Calculate the index of the current image within the filtered displayImages
  const localIndex = displayImages.findIndex(
    (img) => img.id === currentImage?.id
  );

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      annotation: null,
    });
  };

  // Handle mouse move for crosshair

  // Handle mouse enter/leave for crosshair visibility

  // Add drag start position tracking

  // Batch navigation
  const goToPreviousBatch = () => {
    if (batchStartIndex >= batchSize) {
      setBatchStartIndex(batchStartIndex - batchSize);
    }
  };

  const goToNextBatch = () => {
    if (batchStartIndex + batchSize < displayImages.length) {
      setBatchStartIndex(batchStartIndex + batchSize);
    }
  };

  // Save annotations

  // Download modified dataset in YOLO format

  // Function to add a new class
  const addNewClass = (className) => {
    const nameToAdd = (typeof className === "string" ? className : "").trim();
    if (!nameToAdd) {
      return;
    }

    // Check if class already exists
    if (classes.includes(nameToAdd)) {
      showNotification(`Class "${nameToAdd}" already exists!`, "warning");
      return;
    }

    // Add new class
    const updatedClasses = [...classes, nameToAdd];
    setClasses(updatedClasses);
  };

  const handleImageUpload = async (imageFiles) => {
    await handleIndividualImageUpload(
      imageFiles,
      images,
      setImages,
      dataset,
      setDataset,
      null,
      datasetSplit
    );
  };

  const handleCroppedImagesExport = (croppedData) => {
    // croppedData can be a single base64 string or an array of base64 strings
    const base64List = Array.isArray(croppedData) ? croppedData : [croppedData];

    const newImages = base64List.map((base64, index) => ({
      id: images.length + index,
      name: `cropped_${Date.now()}_${index}.png`,
      src: base64,
      annotations: [],
      split: datasetSplit || "train",
    }));

    const updatedImages = [...images, ...newImages];
    setImages(updatedImages);

    if (!dataset) {
      setDataset({
        name: "Manual Dataset",
        size: updatedImages.length,
      });
      setIsZipDataset(true);
    } else if (dataset.name === "Manual Dataset") {
      setDataset({
        ...dataset,
        size: updatedImages.length,
      });
    }

    // Switch view back to editor
    setCurrentView("editor");

    // Select the first of the newly added images if we have any
    if (newImages.length > 0) {
      setCurrentImageIndex(images.length);
    }
  };


  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/5 hover:bg-yellow-400/10 border border-white/10 hover:border-yellow-400/40 text-zinc-300 hover:text-yellow-300 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-95";
  const btnDanger = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/50 text-red-400 rounded-lg text-xs font-medium transition-all cursor-pointer active:scale-95";
  const navBtn = "px-3 py-1.5 bg-white/5 hover:bg-yellow-400/10 border border-white/8 hover:border-yellow-400/30 text-zinc-400 hover:text-yellow-300 rounded-lg text-xs font-medium transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-95";
  const inputCls = "w-full bg-black/30 border border-white/8 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/10 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all shadow-inner";
  const selectCls = "w-full bg-black/30 border border-white/8 focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/10 rounded-lg px-3 py-2 text-xs text-zinc-300 outline-none transition-all appearance-none cursor-pointer";
  const labelCls = "block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-1.5 px-0.5";
  const formGroup = "mb-4";
  const toolBtnBase = "flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-left";
  const sectionHeader = "text-[9px] font-black uppercase tracking-[0.2em] text-yellow-600/70 mb-2 flex items-center gap-2 before:flex-1 before:h-px before:bg-yellow-400/10 after:content-none";

  return (

    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans overflow-hidden">

      {currentView === "editor" ? (
        <>
          {/* ── Header ── */}
          <header className="flex items-center justify-between px-4 h-[52px] flex-shrink-0 bg-zinc-950/90 border-b border-yellow-400/10 relative backdrop-blur-xl z-50">
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />
            {/* Logo */}
            <div className="flex items-center gap-2.5 min-w-[160px]">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-400/20">
                <span className="text-black font-black text-xs">DE</span>
              </div>
              <div>
                <h1 className="text-xs font-black tracking-tight text-white leading-none">Dataset Editor</h1>
                {dataset && <p className="text-[9px] text-yellow-600/70 font-mono mt-0.5 truncate max-w-[120px]">{dataset.name}</p>}
              </div>
            </div>

            {/* Nav group */}
            {dataset && (
              <div className="flex items-center gap-1 bg-white/3 border border-white/6 rounded-xl px-1.5 py-1">
                {[
                  { id: "dashboard", label: "Dashboard", icon: "▦" },
                  { id: "monitor", label: "Monitor", icon: "◉" },
                  // { id: "augment", label: "Augment", icon: "⊕" },
                ].map(({ id, label, icon }) => (
                  <button key={id} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 ${currentView === id ? "bg-yellow-400/15 text-yellow-300 border border-yellow-400/25" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"}`}
                    onClick={() => setCurrentView(id)}>
                    <span className="opacity-60">{icon}</span>{label}
                  </button>
                ))}
              </div>
            )}

            {/* Actions group */}
            <div className="flex items-center gap-1.5 min-w-[160px] justify-end">
              {/* Memory pill */}
              {memoryInfo && (
                <div className="hidden xl:flex items-center gap-1 px-2 py-1 rounded-md bg-white/3 border border-white/5 text-[9px] font-mono text-zinc-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 inline-block" />
                  {formatBytes(memoryInfo.usedJSHeapSize ?? 0)}
                </div>
              )}
              {/* <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/90 hover:bg-yellow-300 text-black text-xs font-black rounded-lg transition-all active:scale-95 shadow-md shadow-yellow-400/20"
                onClick={() => saveAnnotations(images, currentImageIndex, datasetSplit, modifiedImages, setModifiedImages, annotations)}>
                ✓ Save
              </button> */}
              {dataset && (
                <div className="flex items-center gap-1">
                  <button
                    className={`${btn} text-[10px] ${datasetType === "segmentation" ? "opacity-40" : ""}`}
                    title="Download YOLO bounding box format"
                    onClick={() => downloadDataset(dataset, images, classes, setLoadingProgress, modifiedImages, datasetSplit, JSZip, loadingCancelled, datasetConfig, availableSplits, yaml)}>
                    {datasetType === "segmentation" ? "⚠ " : "↓"} YOLO
                  </button>
                  <button
                    className={`${btn} text-[10px] ${datasetType === "yolo" ? "opacity-40" : ""}`}
                    title="Download Segmentation polygon format"
                    onClick={() => downloadSegmentationDataset(dataset, images, classes, setLoadingProgress, modifiedImages, datasetSplit, JSZip, loadingCancelled, datasetConfig, availableSplits, yaml)}>
                    {datasetType === "yolo" ? "⚠ " : "↓"} Seg
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* ── Body ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── Sidebar ── */}
            <aside className="w-[300px] flex-shrink-0 bg-zinc-950/60 border-r border-yellow-400/8 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-0.5 custom-scrollbar">
                <div className="animate-in">
                  {!dataset ? (
                    <div {...getRootProps()} className={`group h-full flex flex-col items-center justify-center text-center space-y-6 py-16 border-2 border-dashed rounded-2xl transition-all cursor-pointer ${isDragActive ? "border-yellow-400 bg-yellow-400/10 shadow-[0_0_30px_rgba(245,197,24,0.1)]" : "border-white/5 bg-zinc-950/20 hover:border-yellow-400/20 hover:bg-zinc-900/40"}`}>
                      <input {...getInputProps()} />
                      <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/15 flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform duration-500">📁</div>
                      <div>
                        <h2 className="text-base font-bold text-white mb-1.5">Initialize Dataset</h2>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-[220px] mx-auto">Drop a ZIP archive or browse your local files.</p>
                      </div>
                      <button className={`p-4 text-[10px] bg-yellow-400 border-transparent text-black font-black uppercase tracking-widest rounded-lg hover:bg-yellow-300 active:scale-95 transition-all`} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                        Upload Archive
                      </button>
                      <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.2em]">ZIP · JPG · PNG</p>
                    </div>
                  ) : (
                    <>
                      {/* ── Current image badge ── */}
                      {currentImage && (
                        <div className="mb-3 px-3 py-2 bg-yellow-400/5 border border-yellow-400/15 rounded-xl flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
                          <p className="text-[10px] text-yellow-300/80 font-mono truncate flex-1">{currentImage.name}</p>
                          <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">{localIndex + 1}/{displayImages.length}</span>
                        </div>
                      )}

                      {/* ── Add Images ── */}
                      <div className={formGroup}>
                        <label className={labelCls}>Add Images</label>
                        <div {...getRootProps()} className={`group border-2 border-dashed rounded-xl px-4 py-5 text-center cursor-pointer transition-all ${isDragActive ? "border-yellow-400 bg-yellow-400/5 text-yellow-300" : "border-white/8 text-zinc-600 hover:border-yellow-400/25 hover:bg-zinc-900/50 hover:text-zinc-400"}`}>
                          <input {...getInputProps()} />
                          <div className="text-xl mb-1 group-hover:scale-110 transition-transform">➕</div>
                          <p className="text-[10px] font-medium">Drag & drop or Click</p>
                        </div>
                      </div>

                      {/* ── Dataset split ── */}
                      <div className={formGroup}>
                        <label className={labelCls}>Dataset Split</label>
                        <div className="flex gap-1">
                          {availableSplits.filter((s) => !isManualDataset || s !== "test").map((s) => (
                            <button key={s}
                              className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all capitalize ${datasetSplit === s ? "bg-yellow-400/15 border-yellow-400/35 text-yellow-300" : "bg-white/3 border-white/6 text-zinc-500 hover:text-zinc-300 hover:border-white/15"}`}
                              onClick={() => {
                                const newSplit = s;
                                if (isManualDataset || isZipDataset) {
                                  if (currentImage) {
                                    const upd = { ...modifiedImages };
                                    const imgSplit = currentImage.split || datasetSplit;
                                    const k = `${imgSplit}/${currentImage.name}`;
                                    if (!upd[imgSplit]) upd[imgSplit] = {};
                                    upd[imgSplit][k] = annotations;
                                    setModifiedImages(upd);
                                  }
                                  setDatasetSplit(newSplit);
                                  setBatchStartIndex(0);
                                  const newSplitImages = images.filter((img, idx) => {
                                    let sp = isManualDataset ? (idx < Math.ceil(images.length * 0.8) ? "train" : "valid") : img.split;
                                    return sp === newSplit;
                                  });
                                  if (newSplitImages.length > 0) {
                                    const first = newSplitImages[0];
                                    const ai = images.findIndex((img) => img.id === first.id);
                                    setCurrentImageIndex(ai);
                                    const k = `${newSplit}/${first.name}`;
                                    setAnnotations(modifiedImages[newSplit]?.[k] || first.annotations || []);
                                    setScale(1); setStagePos({ x: 0, y: 0 });
                                  } else {
                                    setAnnotations([]); setCurrentImageIndex(-1); setScale(1); setStagePos({ x: 0, y: 0 });
                                  }
                                } else {
                                  handleDatasetSplitChange(newSplit, datasetSplit, images, annotations, modifiedImages, setModifiedImages, setDatasetSplit, currentImageIndex, JSZip, dataset, datasetConfig, loadDatasetAllSplits, blobUrlsRef, setImages, setAnnotations, setCurrentImageIndex, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setSelectedAnnotations, checkMemory, setScale, setStagePos, showNotification);
                                }
                              }}>
                              {s}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-600 mt-1 pl-0.5">{displayImages.length} images</p>
                      </div>

                      {/* ── Class selector ── */}
                      <div className={formGroup}>
                        <label className={labelCls}>Active Class</label>
                        <SearchableDropdown options={classes} value={selectedClass} onChange={(v) => setSelectedClass(v)} placeholder="Search class…" />
                      </div>

                      {/* ── Global Padding ── */}
                      <div className={formGroup}>
                        <label className={labelCls}>Padding — "{selectedClass}"</label>
                        <div className="flex gap-2 mb-2">
                          <div className="flex-1">
                            <label className="block text-[9px] text-zinc-600 mb-1">W</label>
                            <input type="number" step="0.01" min="-1" max="1" className={inputCls}
                              value={classPadding[classes.indexOf(selectedClass)]?.width || 0}
                              onChange={(e) => { const id = classes.indexOf(selectedClass); setClassPadding((p) => ({ ...p, [id]: { ...(p[id] || { height: 0 }), width: parseFloat(e.target.value) || 0 } })); }} />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[9px] text-zinc-600 mb-1">H</label>
                            <input type="number" step="0.01" min="-1" max="1" className={inputCls}
                              value={classPadding[classes.indexOf(selectedClass)]?.height || 0}
                              onChange={(e) => { const id = classes.indexOf(selectedClass); setClassPadding((p) => ({ ...p, [id]: { ...(p[id] || { width: 0 }), height: parseFloat(e.target.value) || 0 } })); }} />
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button className={`${btn} flex-1 justify-center`} onClick={() => { const id = classes.indexOf(selectedClass); applyGlobalPadding(id, classPadding[id]?.width || 0, classPadding[id]?.height || 0, images, classPadding, setClassPadding, setImages, setAnnotations, currentImageIndex, modifiedImages, setModifiedImages, datasetSplit); }}>
                            Apply All
                          </button>
                          <button className={`${btnDanger} flex-1 justify-center`} onClick={() => resetClassPadding(classes.indexOf(selectedClass), setClassPadding)}>
                            Reset
                          </button>
                        </div>
                        <p className="text-[9px] text-zinc-700 mt-1.5 pl-0.5">−1 to +1 · positive = expand</p>
                      </div>

                      {/* ── Add class ── */}
                      <AddClass setNewClassName={setSidebarClassName} addNewClass={() => { addNewClass(sidebarClassName); setSidebarClassName(""); }} newClassName={sidebarClassName} />

                      {/* ── Batch nav ── */}
                      <div className="py-2 border-t border-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <button className={navBtn} onClick={goToPreviousBatch} disabled={batchStartIndex === 0}>‹</button>
                          <span className="text-[10px] text-zinc-500 font-mono">{currentBatchIndex} / {totalBatches} batches</span>
                          <button className={navBtn} onClick={goToNextBatch} disabled={batchStartIndex + batchSize >= displayImages.length}>›</button>
                        </div>
                      </div>

                      {/* ── Class filter ── */}
                      <div className="pb-2 border-b border-white/5">
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                          <input type="checkbox" checked={isClassWiseBatch} className="accent-yellow-400"
                            onChange={(e) => { setIsClassWiseBatch(e.target.checked); setBatchStartIndex(0); if (e.target.checked) setClassWiseBatchClass(classes.indexOf(selectedClass)); }} />
                          Filter by class
                        </label>
                        {isClassWiseBatch && (
                          <>
                            <div className="mt-2">
                              <SearchableDropdown options={classes} value={classes[classWiseBatchClass ?? classes.indexOf(selectedClass)]} onChange={(v) => { setClassWiseBatchClass(classes.indexOf(v)); setBatchStartIndex(0); }} placeholder="Filter class…" />
                            </div>
                            <p className="text-[9px] text-zinc-600 mt-1">{getImagesWithClass(classWiseBatchClass).length} matches</p>
                          </>
                        )}
                      </div>

                      {/* ── Thumbnail grid ── */}
                      <div className="h-[380px] w-full mt-2">
                        <VirtualImageGrid
                          images={currentBatch}
                          onImageClick={(index) => {
                            const actualIndex = images.findIndex((img) => img.id === currentBatch[index].id);
                            handleImageSelect(actualIndex, images, currentImageIndex, modifiedImages, datasetSplit, annotations, setAnnotations, setCurrentImageIndex, setModifiedImages, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setScale, setStagePos);
                          }}
                          selectedIndex={currentBatch.findIndex((img) => img.id === currentImage?.id)}
                        />
                      </div>

                      {/* ── Annotation edit panel ── */}
                      {selectedAnnotations.length > 0 && (
                        <div className="mt-3 p-3 bg-yellow-400/5 border border-yellow-400/20 border-l-2 border-l-yellow-400 rounded-xl">
                          {selectedAnnotation && selectedAnnotations.length === 1 ? (
                            <>
                              <p className={labelCls}>✏ Edit Annotation</p>
                              <div className={formGroup}>
                                <label className={labelCls}>Class</label>
                                <SearchableDropdown options={classes}
                                  value={classes[editingAnnotation?.classId ?? selectedAnnotation?.classId ?? 0]}
                                  onChange={(val) => {
                                    const nid = classes.indexOf(val);
                                    if (selectedAnnotation) {
                                      handleAnnotationClassChange(selectedAnnotation.id || selectedAnnotation.unique_id, nid, annotations, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, selectedAnnotation, setEditingAnnotation, editingAnnotation, setSelectedAnnotation, setHoveredAnnotation, hoveredAnnotation, isZipDataset);
                                      setEditingAnnotation({ ...editingAnnotation, classId: nid });
                                    }
                                  }} placeholder="Search class…" />
                              </div>
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {[
                                  { label: "W", key: "width" },
                                  { label: "H", key: "height" },
                                ].map(({ label, key }) => (
                                  <div key={key}>
                                    <label className={labelCls}>{label}</label>
                                    <input type="number" step="0.001" className={inputCls}
                                      value={editingAnnotation?.[key] ?? selectedAnnotation?.[key] ?? 0}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        if (selectedAnnotation) {
                                          const w = key === "width" ? v : (editingAnnotation?.width ?? selectedAnnotation?.width ?? 0);
                                          const h = key === "height" ? v : (editingAnnotation?.height ?? selectedAnnotation?.height ?? 0);
                                          handleAnnotationSizeChange(selectedAnnotation.id, w, h, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, selectedAnnotation, setEditingAnnotation, editingAnnotation, setSelectedAnnotation, setHoveredAnnotation, hoveredAnnotation, annotations, isZipDataset);
                                          setEditingAnnotation({ ...editingAnnotation, [key]: v });
                                        }
                                      }} />
                                  </div>
                                ))}
                              </div>
                              <label className="flex items-center gap-2 text-[10px] text-zinc-400 mb-3 cursor-pointer">
                                <input type="checkbox" checked={editingAnnotation?.isWhitePatch || false} className="accent-yellow-400"
                                  onChange={(e) => {
                                    const wp = e.target.checked;
                                    const upd = annotations.map((a) => a.id === selectedAnnotation.id ? { ...a, isWhitePatch: wp } : a);
                                    setAnnotations(upd);
                                    setEditingAnnotation({ ...editingAnnotation, isWhitePatch: wp });
                                    updateImageAnnotations(currentImageIndex, upd, images, modifiedImages, datasetSplit, setImages, setModifiedImages, isZipDataset);
                                  }} />
                                Is White Patch
                              </label>
                              <button className={`${btnDanger} w-full justify-center`}
                                onClick={() => handleAnnotationDelete(selectedAnnotation.id || selectedAnnotation.unique_id, annotations, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, selectedAnnotation, setSelectedAnnotation, setEditingAnnotation, hoveredAnnotation, setHoveredAnnotation, isZipDataset)}>
                                🗑 Delete
                              </button>
                            </>
                          ) : selectedAnnotations.length > 1 ? (
                            <>
                              <p className={labelCls}>✏ {selectedAnnotations.length} Selected</p>
                              <button className={`${btnDanger} w-full justify-center`}
                                onClick={() => handleMultipleAnnotationDelete(selectedAnnotations, annotations, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, setSelectedAnnotations, setSelectedAnnotation, setEditingAnnotation, isZipDataset)}>
                                🗑 Delete All Selected
                              </button>
                            </>
                          ) : null}
                        </div>
                      )}

                      {/* ── Annotations list ── */}
                      {annotations.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className={labelCls}>Annotations ({annotations.length})</p>
                            {selectedAnnotations.length > 1 && (
                              <button className={btnDanger}
                                onClick={() => handleMultipleAnnotationDelete(selectedAnnotations, annotations, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, setSelectedAnnotations, setSelectedAnnotation, setEditingAnnotation, isZipDataset)}>
                                🗑 {selectedAnnotations.length}
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {annotations.map((ann, i) => {
                              const cls = classes[ann.classId] || "?";
                              const hue = (ann.classId * 47 + 30) % 360;
                              const isSel = selectedAnnotations.includes(ann.id);
                              return (
                                <div key={ann.id}
                                  className={`px-2.5 py-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${isSel ? "bg-yellow-400/8 border-yellow-400/30" : "bg-zinc-900/60 border-white/5 hover:border-white/12 hover:bg-zinc-800/60"}`}
                                  onClick={(e) => handleAnnotationSelect(ann, e, selectedAnnotations, setSelectedAnnotations, setSelectedAnnotation, setEditingAnnotation, setHoveredAnnotation)}>
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: `hsl(${hue},70%,55%)` }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold text-zinc-300 truncate">{cls}</p>
                                    <p className="text-[9px] text-zinc-600 font-mono">
                                      {ann.centerX !== undefined ? ann.centerX.toFixed(3) : "–"}, {ann.centerY !== undefined ? ann.centerY.toFixed(3) : "–"}
                                    </p>
                                  </div>
                                  <button className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0 text-xs"
                                    onClick={(e) => { e.stopPropagation(); handleAnnotationDelete(ann.unique_id || ann.id, annotations, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, selectedAnnotation, setSelectedAnnotation, setEditingAnnotation, hoveredAnnotation, setHoveredAnnotation, isZipDataset); }}>
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </aside>

            {/* ── Canvas Container ── */}
            <div className="flex-1 flex flex-col overflow-hidden relative">

              {/* Floating Tool Buttons */}
              <div className="absolute top-4 left-4 z-50 flex flex-col gap-0.5 bg-zinc-950/90 backdrop-blur-2xl border border-yellow-400/10 rounded-2xl p-1.5 shadow-2xl shadow-black/50">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-yellow-600/50 text-center py-0.5 mb-0.5">Tools</p>
                {[
                  { id: "select", label: "Select", icon: "↖", hint: "S" },
                  { id: "rectangle", label: "Box", icon: "⬚", hint: "Q" },
                  { id: "polygon", label: "Poly", icon: "⬡", hint: "P" },
                  { id: "white-patch", label: "Patch", icon: "▪", hint: "W" },
                ].map(({ id, label, icon, hint }) => (
                  <button key={id} title={`${label} (${hint})`}
                    onClick={() => setTool(id)}
                    className={`${toolBtnBase} ${tool === id
                      ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300 shadow-[0_0_12px_rgba(245,197,24,0.12)]"
                      : "bg-transparent border-transparent text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                      }`}>
                    <span className="text-sm w-5 text-center leading-none">{icon}</span>
                    <span className="flex-1">{label}</span>
                    <kbd className="text-[8px] opacity-25 font-mono bg-white/5 rounded px-1">{hint}</kbd>
                  </button>
                ))}
                <div className="my-1 mx-1 h-px bg-yellow-400/10" />
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-600 text-center py-0.5">Views</p>
                {[
                  { id: "imageUploader", label: "Upload", icon: "↑" },
                  { id: "cropper", label: "Crop", icon: "✂" },
                  { id: "merge", label: "Merge", icon: "⊕" },
                  // { id: "CopyPasteAugmentation", label: "C&P Aug", icon: "⎘" },
                ].map(({ id, label, icon }) => (
                  <button key={id} onClick={() => setCurrentView(id)}
                    className={`${toolBtnBase} bg-transparent border-transparent text-zinc-600 hover:bg-white/5 hover:text-zinc-300`}>
                    <span className="text-sm w-5 text-center leading-none">{icon}</span>
                    <span className="flex-1">{label}</span>
                  </button>
                ))}
              </div>

              {/* Canvas wrapper */}
              <div className="flex-1 flex items-center justify-center overflow-auto bg-zinc-950 relative"
                style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
                  backgroundSize: "40px 40px",
                }}>

                {/* Image Loading / Error Overlays */}
                {isImageLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-10 h-10 border-3 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin mb-3" />
                    <p className="text-[10px] font-black text-yellow-400/60 uppercase tracking-[0.2em]">Loading…</p>
                  </div>
                )}

                {imageLoadError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-md p-8 text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <h4 className="text-lg font-bold text-white mb-2">Image Loading Failed</h4>
                    <p className="text-sm text-red-400 max-w-md">{imageLoadError}</p>
                    <button className={`${btn} mt-6`} onClick={() => window.location.reload()}>🔄 Refresh Editor</button>
                  </div>
                )}

                {currentImage ? (
                  <Stage
                    ref={stageRef}
                    width={stageSize.width}
                    height={stageSize.height}
                    onMouseDown={(e) => {
                      if (tool === "polygon") {
                        const stage = e.target.getStage();
                        const pointer = stage.getPointerPosition();
                        const x = (pointer.x - stagePos.x) / scale;
                        const y = (pointer.y - stagePos.y) / scale;
                        const np = { x: x / stageSize.width, y: y / stageSize.height };
                        if (newPolygonPoints.length > 0) {
                          const last = newPolygonPoints[newPolygonPoints.length - 1];
                          if (Math.sqrt(Math.pow(np.x - last.x, 2) + Math.pow(np.y - last.y, 2)) < 0.005) return;
                        }
                        setNewPolygonPoints((prev) => [...prev, np]);
                        return;
                      }
                      handleMouseDown(e, currentImage, stagePos, scale, stageSize, selectedAnnotation, tool, normalizedToPixel, setNewAnnotation, setIsDragging, setIsResizing, setResizeHandle, setDragStartPos, setDragStartAnnotation, setIsDrawing);
                      handleStageMouseDown(e, stagePos, scale, setDragStartPos);
                    }}
                    onDblClick={(e) => {
                      if (tool === "polygon" && newPolygonPoints.length > 2) {
                        const obj = { id: Date.now(), classId: classes.indexOf(selectedClass), points: newPolygonPoints, type: "polygon", isWhitePatch: tool === "white-patch" };
                        const upd = [...annotations, obj];
                        setAnnotations(upd); setSelectedAnnotation(obj); setEditingAnnotation({ ...obj });
                        updateImageAnnotations(currentImageIndex, upd, images, modifiedImages, datasetSplit, setImages, setModifiedImages, isZipDataset);
                        setNewPolygonPoints([]);
                      }
                    }}
                    onMouseMove={(e) => {
                      handleMouseMove(e, currentImage, stagePos, scale, stageSize, selectedAnnotation, normalizedToPixel, setNewAnnotation, setCrosshairPos, dragStartPos, dragStartAnnotation, resizeHandle, isResizing, isDragging, isDrawing, newAnnotation, setAnnotations, annotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, setSelectedAnnotation, setEditingAnnotation, editingAnnotation, isZipDataset, setStagePos);
                      handleStageMouseMove(e, currentImage, stagePos, scale, setCrosshairPos);
                    }}
                    onMouseUp={(e) => handleMouseUp(currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, selectedAnnotation, isDragging, isResizing, dragStartAnnotation, newAnnotation, isDrawing, currentImage, setIsDragging, setIsResizing, setResizeHandle, setDragStartPos, setDragStartAnnotation, setNewAnnotation, setIsDrawing, isZipDataset, classes, currentImageIndex, imageRef, selectedClass, setAnnotations, annotations)}
                    onWheel={(e) => handleZoom(e, stageRef, setScale, setStagePos)}
                    scaleX={scale} scaleY={scale} x={stagePos.x} y={stagePos.y}
                    style={{
                      cursor: tool === "rectangle" ? "crosshair" : isDragging || isResizing ? "move" : "default",
                      background: 'transparent',
                    }}
                    onMouseEnter={() => handleStageMouseEnter(setShowCrosshair)}
                    onMouseLeave={() => handleStageMouseLeave(setShowCrosshair)}
                  >
                    <Layer>
                      <KonvaImage ref={imageRef} image={preloadedImage} x={0} y={0} width={stageSize.width} height={stageSize.height} />
                      {showCrosshair && tool === "rectangle" && (
                        <>
                          <Line points={[crosshairPos.x, 0, crosshairPos.x, stageSize.height]} stroke="#fff200" strokeWidth={0.5} dash={[4, 4]} opacity={0.3} />
                          <Line points={[0, crosshairPos.y, stageSize.width, crosshairPos.y]} stroke="#fff200" strokeWidth={0.5} dash={[4, 4]} opacity={0.3} />
                        </>
                      )}
                      {annotations.map((annotation) => {
                        const pc = normalizedToPixel(annotation, stageSize.width, stageSize.height);
                        const x = pc.x - pc.width / 2;
                        const y = pc.y - pc.height / 2;
                        const cc = getClassColor(annotation.classId);
                        const isSel = (selectedAnnotation?.id === annotation.id) || selectedAnnotations.includes(annotation.id);
                        const stroke = annotation.isWhitePatch ? "#fff200" : isSel ? "#ff0000" : cc;
                        const fill = annotation.isWhitePatch ? "#fff200" : isSel ? "rgba(255,0,0,0.25)" : `rgba(${parseInt(cc.slice(1, 3), 16)},${parseInt(cc.slice(3, 5), 16)},${parseInt(cc.slice(5, 7), 16)},0.18)`;
                        const sw = isSel ? 3 : 2;
                        const evtProps = {
                          onClick: (e) => handleAnnotationSelect(annotation, e.evt, selectedAnnotations, setSelectedAnnotations, setSelectedAnnotation, setEditingAnnotation, setHoveredAnnotation),
                          onContextMenu: (e) => handleContextMenu(e, annotation, setContextMenu),
                          onMouseEnter: () => setHoveredAnnotation(annotation),
                          onMouseLeave: () => setHoveredAnnotation(null),
                        };
                        return (
                          <React.Fragment key={annotation.id}>
                            {annotation.type === "polygon" ? (
                              <>
                                <Line points={annotation.points.flatMap((p) => [p.x * stageSize.width, p.y * stageSize.height])} stroke={stroke} strokeWidth={sw} fill={fill} closed={true} {...evtProps} />
                                {isSel && annotation.points.map((p, i) => (
                                  <Circle
                                    key={`pt-${i}`}
                                    x={p.x * stageSize.width}
                                    y={p.y * stageSize.height}
                                    radius={5 / scale}
                                    fill="#fff"
                                    stroke={cc}
                                    strokeWidth={1.5 / scale}
                                    draggable
                                    onDragMove={(e) => {
                                      const nx = e.target.x() / stageSize.width;
                                      const ny = e.target.y() / stageSize.height;
                                      const newPoints = annotation.points.map((pt, pi) => pi === i ? { x: nx, y: ny } : pt);
                                      const updated = { ...annotation, points: newPoints };
                                      const newAnns = annotations.map((a) => a.id === annotation.id ? updated : a);
                                      setAnnotations(newAnns);
                                      setSelectedAnnotation(updated);
                                    }}
                                    onDragEnd={(e) => {
                                      const nx = e.target.x() / stageSize.width;
                                      const ny = e.target.y() / stageSize.height;
                                      const newPoints = annotation.points.map((pt, pi) => pi === i ? { x: nx, y: ny } : pt);
                                      const updated = { ...annotation, points: newPoints };
                                      const newAnns = annotations.map((a) => a.id === annotation.id ? updated : a);
                                      updateImageAnnotations(currentImageIndex, newAnns, images, modifiedImages, datasetSplit, setImages, setModifiedImages, isZipDataset);
                                    }}
                                  />
                                ))}
                              </>
                            ) : (
                              <Rect x={x} y={y} width={pc.width} height={pc.height} stroke={stroke} strokeWidth={sw} fill={fill} {...evtProps} />
                            )}
                            {selectedAnnotation?.id === annotation.id && annotation.type !== "polygon" && (
                              <>
                                {[[x, y, "nw"], [x + pc.width, y, "ne"], [x, y + pc.height, "sw"], [x + pc.width, y + pc.height, "se"]].map(([hx, hy, handle], i) => (
                                  <Circle
                                    key={i}
                                    x={hx}
                                    y={hy}
                                    radius={5 / scale}
                                    fill="#fff"
                                    stroke="#000"
                                    strokeWidth={1 / scale}
                                    draggable
                                    onDragMove={(e) => {
                                      const nx = e.target.x();
                                      const ny = e.target.y();
                                      let newX = x, newY = y, newW = pc.width, newH = pc.height;
                                      if (handle === "nw") { newX = nx; newY = ny; newW = (x + pc.width) - nx; newH = (y + pc.height) - ny; }
                                      else if (handle === "ne") { newY = ny; newW = nx - x; newH = (y + pc.height) - ny; }
                                      else if (handle === "sw") { newX = nx; newW = (x + pc.width) - nx; newH = ny - y; }
                                      else if (handle === "se") { newW = nx - x; newH = ny - y; }
                                      if (newW < 5 || newH < 5) return;
                                      const cx2 = (newX + newW / 2) / stageSize.width;
                                      const cy2 = (newY + newH / 2) / stageSize.height;
                                      const updated = { ...annotation, centerX: cx2, centerY: cy2, width: newW / stageSize.width, height: newH / stageSize.height };
                                      setAnnotations(annotations.map((a) => a.id === annotation.id ? updated : a));
                                      setSelectedAnnotation(updated);
                                    }}
                                    onDragEnd={() => {
                                      updateImageAnnotations(currentImageIndex, annotations, images, modifiedImages, datasetSplit, setImages, setModifiedImages, isZipDataset);
                                    }}
                                  />
                                ))}
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {hoveredAnnotation && (() => {
                        const pc = normalizedToPixel(hoveredAnnotation, stageSize.width, stageSize.height);
                        const label = classes[hoveredAnnotation.classId] || "?";
                        const fontSize = Math.max(11, Math.min(16, pc.width / 8));
                        const lx = pc.x - pc.width / 2;
                        const ly = pc.y - pc.height / 2;
                        // For polygons, compute center from points
                        let cx = pc.x, cy = pc.y;
                        if (hoveredAnnotation.type === "polygon" && hoveredAnnotation.points?.length) {
                          cx = hoveredAnnotation.points.reduce((s, p) => s + p.x * stageSize.width, 0) / hoveredAnnotation.points.length;
                          cy = hoveredAnnotation.points.reduce((s, p) => s + p.y * stageSize.height, 0) / hoveredAnnotation.points.length;
                        }
                        const cc = getClassColor(hoveredAnnotation.classId);
                        const textW = label.length * fontSize * 0.6 + 16;
                        return (
                          <>
                            <Rect x={cx - textW / 2} y={cy - fontSize - 4} width={textW} height={fontSize + 8} fill="rgba(0,0,0,0.65)" cornerRadius={4} />
                            <Text x={cx - textW / 2 + 8} y={cy - fontSize} text={label} fill={cc} fontSize={fontSize} fontStyle="bold" shadowColor="black" shadowBlur={1} shadowOpacity={0.8} />
                          </>
                        );
                      })()}
                      {newAnnotation && (
                        <Rect x={Math.min(newAnnotation.x, newAnnotation.x + newAnnotation.width)} y={Math.min(newAnnotation.y, newAnnotation.y + newAnnotation.height)} width={Math.abs(newAnnotation.width)} height={Math.abs(newAnnotation.height)} stroke={newAnnotation.isWhitePatch ? "#fff" : "#f00"} strokeWidth={2} dash={newAnnotation.isWhitePatch ? [] : [5, 5]} fill={newAnnotation.isWhitePatch ? "#fff" : "rgba(255,0,0,0.08)"} />
                      )}
                      <>
                        <Line points={[...newPolygonPoints.flatMap((p) => [p.x * stageSize.width, p.y * stageSize.height]), crosshairPos.x, crosshairPos.y]} stroke={tool === "white-patch" ? "#fff" : "#f00"} strokeWidth={2} closed={newPolygonPoints.length > 2} />
                        {newPolygonPoints.map((p, i) => <Rect key={`np-${i}`} x={p.x * stageSize.width - 4 / scale} y={p.y * stageSize.height - 4 / scale} width={8 / scale} height={8 / scale} fill="#fff" stroke="#f00" strokeWidth={1 / scale} />)}
                      </>
                    </Layer>
                  </Stage>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 opacity-25 select-none">
                    <div className="text-6xl">🖼</div>
                    <div className="text-center">
                      <p className="text-sm font-bold tracking-widest uppercase text-zinc-400">No Image Selected</p>
                      <p className="text-xs text-zinc-600 mt-1">Pick an image from the sidebar</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Bottom navigation bar ── */}
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-950/80 border-t border-yellow-400/8 flex-shrink-0">
                <button className={navBtn} disabled={localIndex <= 0}
                  onClick={() => { const prev = displayImages[localIndex - 1]; handleImageSelect(images.findIndex((img) => img.id === prev.id), images, currentImageIndex, modifiedImages, datasetSplit, annotations, setAnnotations, setCurrentImageIndex, setModifiedImages, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setScale, setStagePos); }}>
                  ‹ Prev
                </button>

                {/* Filename center */}
                <div className="flex-1 flex flex-col items-center min-w-0">
                  <p className="text-[10px] font-mono text-zinc-400 truncate max-w-[300px]">{currentImage?.name || "—"}</p>
                  <p className="text-[9px] text-zinc-700 font-mono">{localIndex + 1} / {displayImages.length}</p>
                </div>

                <button className={navBtn} disabled={localIndex >= displayImages.length - 1}
                  onClick={() => { const next = displayImages[localIndex + 1]; handleImageSelect(images.findIndex((img) => img.id === next.id), images, currentImageIndex, modifiedImages, datasetSplit, annotations, setAnnotations, setCurrentImageIndex, setModifiedImages, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setScale, setStagePos); }}>
                  Next ›
                </button>
                <div className="w-px h-4 bg-white/8 mx-0.5" />
                <div className="flex items-center gap-1.5">
                  <input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="w-14 bg-black/40 border border-white/8 focus:border-yellow-400/40 rounded-lg px-2 py-1 text-[10px] font-mono text-zinc-400 outline-none text-center" placeholder="#" />
                  <button className={navBtn} disabled={newValue > displayImages.length}
                    onClick={() => { const img = displayImages[newValue - 1]; if (img) handleImageSelect(images.findIndex((i) => i.id === img.id), images, currentImageIndex, modifiedImages, datasetSplit, annotations, setAnnotations, setCurrentImageIndex, setModifiedImages, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setScale, setStagePos); }}>
                    Go
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Status bar ── */}
          <div className="flex items-center justify-between px-4 h-6 bg-zinc-950 border-t border-yellow-400/8 text-[9px] font-mono flex-shrink-0">
            <div className="flex items-center gap-3">
              {tool === "rectangle" && <span className="text-yellow-500/70 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> Box mode — drag to draw</span>}
              {tool === "polygon" && <span className="text-yellow-500/70 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> Polygon — click points, dbl-click to close</span>}
              {tool === "select" && selectedAnnotation && <span className="text-yellow-500/70 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" /> Selected — drag to move, handles to resize</span>}
              {tool === "select" && !selectedAnnotation && <span className="text-zinc-700">Select tool active</span>}
            </div>
            <div className="flex items-center gap-3 text-zinc-700">
              {annotations.length > 0 && <span>{annotations.length} annotation{annotations.length !== 1 ? "s" : ""}</span>}
              {scale !== 1 && <span>zoom {Math.round(scale * 100)}%</span>}
              {currentImage && <span className="text-zinc-800">{datasetSplit}</span>}
            </div>
          </div>

          <ContextMenu x={contextMenu.x} y={contextMenu.y} visible={contextMenu.visible} onClose={closeContextMenu}
            options={getContextMenuOptions(contextMenu.annotation?.unique_id || contextMenu.annotation?.id, annotations, setAnnotations, currentImageIndex, images, modifiedImages, datasetSplit, setImages, setModifiedImages, selectedAnnotations, setSelectedAnnotations, setSelectedAnnotation, setEditingAnnotation, setHoveredAnnotation, null, isZipDataset)}
            annotation={contextMenu.annotation} />
        </>

      ) : currentView === "dashboard" ? (
        <Dashboard addNewClass={addNewClass} images={images || []} classes={classes} onBackToEditor={() => setCurrentView("editor")} sidebarClassName={sidebarClassName} setSidebarClassName={setSidebarClassName}
          onImagesUpdate={(updatedData) => {
            const updatedImages = updatedData?.images ? updatedData.images : Array.isArray(updatedData) ? updatedData : updatedData?.images || [];
            const updatedClasses = updatedData?.classes || classes;
            setModifiedImages((prev) => { const next = { ...prev }; updatedImages.forEach((img) => { if (!img?.name || !img?.split) return; const k = `${img.split}/${img.name}`; next[img.split] = { ...next[img.split], [k]: img.annotations || [] }; }); return next; });
            setImages(updatedImages);
            if (images?.length > 0 && currentImageIndex < images.length) {
              const m = updatedImages.find((img) => (images[currentImageIndex]?.id !== undefined && img.id === images[currentImageIndex]?.id) || img.name === images[currentImageIndex]?.name) || updatedImages[0];
              if (m) { setAnnotations(m.annotations || []); const ni = updatedImages.findIndex((img) => img.id === m.id); setCurrentImageIndex(ni !== -1 ? ni : 0); setScale(1); setStagePos({ x: 0, y: 0 }); }
            }
            if (updatedData?.classes) handleClassRename(updatedImages, updatedClasses, setImages, setModifiedImages, setClasses, setAnnotations, setSelectedClass, datasetSplit, currentImageIndex, selectedClass);
          }} />

      ) : currentView === "merge" ? (
        <MergeDatasets onBackToEditor={() => setCurrentView("editor")} />

      ) : currentView === "monitor" ? (
        <DatasetMonitor images={images} classes={classes} datasetSplit={datasetSplit} availableSplits={availableSplits}
          onDatasetSplitChange={(ns) => handleDatasetSplitChange(ns, datasetSplit, images, annotations, modifiedImages, setModifiedImages, setDatasetSplit, currentImageIndex, JSZip, dataset, datasetConfig, loadDatasetAllSplits, blobUrlsRef, setImages, setAnnotations, setCurrentImageIndex, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setSelectedAnnotations, checkMemory, setScale, setStagePos, showNotification)}
          onImageSelect={(idx) => handleImageSelect(idx, images, currentImageIndex, modifiedImages, datasetSplit, annotations, setAnnotations, setCurrentImageIndex, setModifiedImages, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation, setScale, setStagePos)}
          onBackToEditor={() => setCurrentView("editor")} />

      ) : currentView === "cropper" ? (
        <ImageCropper setCurrentView={setCurrentView} onImagesExport={handleCroppedImagesExport} />

      ) : currentView === "CopyPasteAugmentation" ? (
        <CopyPasteAugmentationApp setCurrentView={setCurrentView} images={images} classes={classes} datasetConfig={datasetConfig} />

      ) : currentView === "augment" ? (
        <ImageAugmentationTool onBackToEditor={() => setCurrentView("editor")} />

      ) : (
        <ImageUploader onUpload={handleImageUpload} setCurrentView={setCurrentView} />
      )}

      {loadingProgress.active && (
        <LoadingProgress current={loadingProgress.current} total={loadingProgress.total} stage={loadingProgress.stage} memoryUsage={memoryInfo} showMemory={true} onCancel={loadingProgress.canCancel ? () => setLoadingCancelled(true) : null} />
      )}

      <ImageSelectionModal isOpen={isSelectionModalOpen} files={candidateFiles}
        onConfirm={(sp) => handleConfirmSelection(sp, setImages, setDataset, setCurrentImageIndex, setIsSelectionModalOpen, setCandidateFiles)}
        onCancel={() => { setIsSelectionModalOpen(false); setCandidateFiles([]); }} />

      {/* Hidden file input for dataset import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files?.length > 0) {
            onDropHelper(Array.from(e.target.files));
          }
        }}
        multiple
        className="hidden"
      />
    </div>
  );
};

export default App;
